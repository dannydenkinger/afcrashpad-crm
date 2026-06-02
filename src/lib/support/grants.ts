import "server-only"
import crypto from "node:crypto"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

export type GrantScope = "full" | "read"
export type GrantStatus = "active" | "revoked" | "expired"

export interface SupportGrant {
    id: string
    workspaceId: string
    grantedByUserId: string
    grantedByEmail: string
    grantedByName: string
    grantedAt: string
    expiresAt: string
    status: GrantStatus
    scope: GrantScope
    /** Optional: lock the grant to a single agent email. */
    supportEmail: string | null
    revokedAt: string | null
    revokedByEmail: string | null
    lastUsedAt: string | null
    useCount: number
}

const DURATIONS_MS = {
    "1h": 60 * 60 * 1000,
    "8h": 8 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
} as const

export type GrantDuration = keyof typeof DURATIONS_MS

function getSecret(): string {
    const secret = process.env.SUPPORT_GRANT_SECRET
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("SUPPORT_GRANT_SECRET must be set in production")
        }
        return "vesta-dev-fallback-support-secret"
    }
    return secret
}

export function hashToken(token: string): string {
    return crypto.createHmac("sha256", getSecret()).update(token).digest("hex")
}

function generateToken(): string {
    // 32 bytes → 43-char URL-safe base64. Stored only as a hash on
    // the grant doc; raw value is shown to the owner exactly once.
    return crypto
        .randomBytes(32)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

function toIso(ts: unknown): string {
    if (!ts) return new Date().toISOString()
    if (typeof ts === "string") return ts
    if (ts instanceof Date) return ts.toISOString()
    const t = ts as { toDate?: () => Date }
    if (typeof t.toDate === "function") return t.toDate().toISOString()
    return new Date().toISOString()
}

function effectiveStatus(raw: GrantStatus, expiresAt: string): GrantStatus {
    if (raw === "revoked") return "revoked"
    if (new Date(expiresAt).getTime() < Date.now()) return "expired"
    return raw
}

function rowToGrant(id: string, data: FirebaseFirestore.DocumentData): SupportGrant {
    const expiresAt = toIso(data.expiresAt)
    return {
        id,
        workspaceId: (data.workspaceId as string) || "",
        grantedByUserId: (data.grantedByUserId as string) || "",
        grantedByEmail: (data.grantedByEmail as string) || "",
        grantedByName: (data.grantedByName as string) || "",
        grantedAt: toIso(data.grantedAt),
        expiresAt,
        status: effectiveStatus((data.status as GrantStatus) || "active", expiresAt),
        scope: (data.scope as GrantScope) || "full",
        supportEmail: (data.supportEmail as string) || null,
        revokedAt: data.revokedAt ? toIso(data.revokedAt) : null,
        revokedByEmail: (data.revokedByEmail as string) || null,
        lastUsedAt: data.lastUsedAt ? toIso(data.lastUsedAt) : null,
        useCount: typeof data.useCount === "number" ? data.useCount : 0,
    }
}

export interface CreateGrantInput {
    workspaceId: string
    grantedByUserId: string
    grantedByEmail: string
    grantedByName: string
    duration: GrantDuration
    scope?: GrantScope
    supportEmail?: string | null
}

/**
 * Mint a new support grant. Returns the raw token ONCE — caller is
 * responsible for surfacing it to the workspace owner. Only the hash
 * is persisted, so the token can't be recovered later.
 */
export async function createGrant(
    input: CreateGrantInput,
): Promise<{ grant: SupportGrant; token: string }> {
    const token = generateToken()
    const tokenHash = hashToken(token)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + DURATIONS_MS[input.duration])

    const doc = {
        workspaceId: input.workspaceId,
        grantedByUserId: input.grantedByUserId,
        grantedByEmail: input.grantedByEmail,
        grantedByName: input.grantedByName,
        grantedAt: now,
        expiresAt,
        status: "active" as GrantStatus,
        scope: input.scope ?? "full",
        supportEmail: input.supportEmail ? input.supportEmail.toLowerCase() : null,
        tokenHash,
        useCount: 0,
        lastUsedAt: null,
        revokedAt: null,
        revokedByEmail: null,
    }

    const ref = await adminDb.collection("support_grants").add(doc)
    const snap = await ref.get()
    return { grant: rowToGrant(ref.id, snap.data()!), token }
}

export async function listGrantsForWorkspace(workspaceId: string): Promise<SupportGrant[]> {
    const snap = await adminDb
        .collection("support_grants")
        .where("workspaceId", "==", workspaceId)
        .orderBy("grantedAt", "desc")
        .limit(50)
        .get()
    return snap.docs.map((d) => rowToGrant(d.id, d.data()))
}

export async function getGrant(id: string): Promise<SupportGrant | null> {
    const snap = await adminDb.collection("support_grants").doc(id).get()
    if (!snap.exists) return null
    return rowToGrant(snap.id, snap.data()!)
}

export async function revokeGrant(
    id: string,
    workspaceId: string,
    revokedByEmail: string,
): Promise<{ success: boolean; error?: string }> {
    const ref = adminDb.collection("support_grants").doc(id)
    const snap = await ref.get()
    if (!snap.exists) return { success: false, error: "Not found" }
    const data = snap.data()!
    if (data.workspaceId !== workspaceId) {
        return { success: false, error: "Not in this workspace" }
    }
    if (data.status === "revoked") return { success: true }
    await ref.update({
        status: "revoked",
        revokedAt: new Date(),
        revokedByEmail,
    })
    return { success: true }
}

export interface ValidGrant {
    grant: SupportGrant
    /** The raw token, useful when the cookie still holds it. */
    tokenHash: string
}

/**
 * Validate a raw token presented at redemption or on every request
 * (via cookie). Returns the grant if it's active, scoped to the
 * agent email when set. Auto-marks expired grants if their expiry
 * has passed.
 */
export async function findGrantByToken(
    token: string,
    agentEmail: string,
): Promise<ValidGrant | null> {
    if (!token) return null
    const tokenHash = hashToken(token)
    const snap = await adminDb
        .collection("support_grants")
        .where("tokenHash", "==", tokenHash)
        .limit(1)
        .get()
    if (snap.empty) return null
    const doc = snap.docs[0]
    const data = doc.data()
    const grant = rowToGrant(doc.id, data)

    if (grant.status === "revoked") return null
    if (grant.status === "expired") return null

    if (grant.supportEmail && grant.supportEmail.toLowerCase() !== agentEmail.toLowerCase()) {
        return null
    }

    // Suspended workspaces can't be accessed via support sessions —
    // matches the operator's intent when they suspend.
    try {
        const ws = await adminDb.collection("workspaces").doc(grant.workspaceId).get()
        if ((ws.data()?.status as string) === "suspended") return null
    } catch {
        return null
    }

    return { grant, tokenHash }
}

/**
 * Bump useCount + lastUsedAt without blocking the request path.
 * Fire-and-forget at call sites.
 */
export async function bumpGrantUsage(grantId: string): Promise<void> {
    try {
        await adminDb.collection("support_grants").doc(grantId).update({
            lastUsedAt: new Date(),
            useCount: FieldValue.increment(1),
        })
    } catch {
        // Best-effort — failure here shouldn't break the support session.
    }
}

export function isSupportAgentEmail(email: string | null | undefined): boolean {
    if (!email) return false
    const raw = process.env.SUPPORT_AGENT_EMAILS || ""
    const allow = new Set(
        raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
    )
    return allow.has(email.toLowerCase())
}
