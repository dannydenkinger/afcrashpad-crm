"use server"

import { z } from "zod"
import crypto from "crypto"
import { tenantDb } from "@/lib/tenant-db"
import { requireAdmin } from "@/lib/auth-guard"
import { requirePlan } from "@/lib/billing/plans-server"
import { logAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import type { ApiKeyInfo } from "./types"

const generateApiKeySchema = z.object({
    name: z.string().min(1).max(100),
})

function hashKey(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex")
}

/**
 * Generate a new API key. Returns the plain-text key (shown once to user).
 */
export async function generateApiKey(name: string): Promise<{ key: string; id: string }> {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    await requirePlan(workspaceId, "pro", "API access")
    const db = tenantDb(workspaceId)

    const parsed = generateApiKeySchema.safeParse({ name })
    if (!parsed.success) throw new Error("Invalid input")

    // Generate a random 32-byte key, base64url encoded
    const rawKey = crypto.randomBytes(32).toString("base64url")
    const fullKey = `afcp_${rawKey}`
    const keyHash = hashKey(fullKey)
    const keyPrefix = fullKey.substring(0, 12) + "..."

    const ref = await db.add("api_keys", {
        name: parsed.data.name,
        keyHash,
        keyPrefix,
        userId: session.user.id || session.user.email,
        createdAt: new Date(),
        lastUsedAt: null,
        active: true,
    })

    logAudit(workspaceId, {
        userId: session.user.id || "",
        userEmail: session.user.email || "",
        userName: session.user.name || "",
        action: "create",
        entity: "api_key",
        entityId: ref.id,
        entityName: parsed.data.name,
    }).catch(() => {})

    revalidatePath("/settings")

    return { key: fullKey, id: ref.id }
}

/**
 * List all API keys (masked).
 */
export async function getApiKeys(): Promise<ApiKeyInfo[]> {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    const snapshot = await db.collection("api_keys").orderBy("createdAt", "desc").get()

    return snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
            id: doc.id,
            name: data.name,
            keyPrefix: data.keyPrefix || "afcp_...",
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
            lastUsedAt: data.lastUsedAt?.toDate?.()?.toISOString?.() || null,
            active: data.active !== false,
        }
    })
}

/**
 * Revoke (deactivate) an API key.
 */
export async function revokeApiKey(id: string): Promise<{ success: boolean }> {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    if (!id || id.length > 128) throw new Error("Invalid key ID")

    const doc = await db.doc("api_keys", id).get()
    if (!doc.exists) throw new Error("API key not found")

    await db.doc("api_keys", id).update({
        active: false,
        revokedAt: new Date(),
    })

    logAudit(workspaceId, {
        userId: session.user.id || "",
        userEmail: session.user.email || "",
        userName: session.user.name || "",
        action: "delete",
        entity: "api_key",
        entityId: id,
        entityName: doc.data()?.name || "",
    }).catch(() => {})

    revalidatePath("/settings")
    return { success: true }
}
