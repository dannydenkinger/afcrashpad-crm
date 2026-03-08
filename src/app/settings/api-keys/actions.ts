"use server"

import { z } from "zod"
import crypto from "crypto"
import { adminDb } from "@/lib/firebase-admin"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"
import { auth } from "@/auth"
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
    await requireAdmin()

    const parsed = generateApiKeySchema.safeParse({ name })
    if (!parsed.success) throw new Error("Invalid input")

    const session = await auth()
    if (!session?.user?.email) throw new Error("Unauthorized")

    // Generate a random 32-byte key, base64url encoded
    const rawKey = crypto.randomBytes(32).toString("base64url")
    const fullKey = `afcp_${rawKey}`
    const keyHash = hashKey(fullKey)
    const keyPrefix = fullKey.substring(0, 12) + "..."

    const ref = await adminDb.collection("api_keys").add({
        name: parsed.data.name,
        keyHash,
        keyPrefix,
        userId: (session.user as any).id || session.user.email,
        createdAt: new Date(),
        lastUsedAt: null,
        active: true,
    })

    logAudit({
        userId: (session.user as any).id || "",
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
    await requireAdmin()

    const snapshot = await adminDb.collection("api_keys").orderBy("createdAt", "desc").get()

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
    await requireAdmin()

    if (!id || id.length > 128) throw new Error("Invalid key ID")

    const doc = await adminDb.collection("api_keys").doc(id).get()
    if (!doc.exists) throw new Error("API key not found")

    await adminDb.collection("api_keys").doc(id).update({
        active: false,
        revokedAt: new Date(),
    })

    const session = await auth()
    if (session?.user) {
        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "delete",
            entity: "api_key",
            entityId: id,
            entityName: doc.data()?.name || "",
        }).catch(() => {})
    }

    revalidatePath("/settings")
    return { success: true }
}
