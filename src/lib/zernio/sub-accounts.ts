/**
 * Zernio sub-account management.
 *
 * In the GHL model, each workspace = one Zernio sub-account. We store
 * `zernio_account_id` on the workspace doc and a richer `social_connections`
 * doc tracking which individual social accounts (facebook, instagram, etc.)
 * the tenant has linked.
 *
 * Flow:
 *   1. createConnectLink(workspaceId) -> returns a one-time URL
 *   2. User opens the URL in a popup, completes OAuth with their platform(s)
 *   3. Zernio redirects to our /api/social/callback with the account ID
 *   4. completeConnection() writes the ID and refreshes the linked accounts list
 */

import { adminDb } from "@/lib/firebase-admin"
import { zernioRequest } from "@/lib/zernio/client"
import type { SocialAccount, SocialConnection, SocialPlatform } from "@/types"

export interface CreateConnectLinkResult {
    url: string
    expiresAt: string | null
    zernioAccountId?: string
}

export async function createConnectLink(
    workspaceId: string,
    redirectUrl: string,
    existingAccountId?: string,
): Promise<CreateConnectLinkResult> {
    if (!workspaceId) throw new Error("workspaceId required")
    if (!redirectUrl) throw new Error("redirectUrl required")

    const payload: Record<string, unknown> = {
        redirect_url: redirectUrl,
        external_id: workspaceId,
    }
    if (existingAccountId) payload.sub_account_id = existingAccountId

    const res = await zernioRequest<{
        url: string
        expires_at?: string
        sub_account_id?: string
    }>("/v1/connect-links", { method: "POST", body: payload })

    return {
        url: res.url,
        expiresAt: res.expires_at ?? null,
        zernioAccountId: res.sub_account_id,
    }
}

export async function fetchLinkedAccounts(
    zernioAccountId: string,
): Promise<SocialAccount[]> {
    const res = await zernioRequest<{
        accounts: Array<{
            platform: string
            handle?: string
            id: string
            connected_at?: string
        }>
    }>(`/v1/sub-accounts/${zernioAccountId}/accounts`)

    return (res.accounts ?? []).map((a) => ({
        platform: normalizePlatform(a.platform),
        handle: a.handle ?? a.id,
        externalId: a.id,
        connectedAt: a.connected_at ?? new Date().toISOString(),
    }))
}

function normalizePlatform(raw: string): SocialPlatform {
    const p = raw.toLowerCase()
    const allowed: SocialPlatform[] = [
        "facebook",
        "instagram",
        "twitter",
        "linkedin",
        "tiktok",
        "pinterest",
        "youtube",
        "threads",
    ]
    return (allowed as string[]).includes(p) ? (p as SocialPlatform) : "facebook"
}

export async function getConnection(workspaceId: string): Promise<SocialConnection | null> {
    const snap = await adminDb
        .collection("social_connections")
        .where("workspaceId", "==", workspaceId)
        .limit(1)
        .get()
    if (snap.empty) return null
    const doc = snap.docs[0]
    const data = doc.data()
    return {
        id: doc.id,
        workspaceId: data.workspaceId,
        zernioAccountId: data.zernioAccountId,
        accounts: (data.accounts as SocialAccount[]) ?? [],
        connectedAt: data.connectedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
    }
}

export async function completeConnection(
    workspaceId: string,
    zernioAccountId: string,
): Promise<SocialConnection> {
    if (!workspaceId) throw new Error("workspaceId required")
    if (!zernioAccountId) throw new Error("zernioAccountId required")

    let accounts: SocialAccount[] = []
    try {
        accounts = await fetchLinkedAccounts(zernioAccountId)
    } catch (err) {
        console.error("[Zernio] fetchLinkedAccounts failed:", err)
    }

    const existing = await getConnection(workspaceId)
    const now = new Date()

    if (existing) {
        await adminDb.collection("social_connections").doc(existing.id).update({
            zernioAccountId,
            accounts,
            updatedAt: now,
        })
    } else {
        await adminDb.collection("social_connections").add({
            workspaceId,
            zernioAccountId,
            accounts,
            connectedAt: now,
            updatedAt: now,
        })
    }

    await adminDb.collection("workspaces").doc(workspaceId).update({
        zernio_account_id: zernioAccountId,
        updatedAt: now,
    })

    const updated = await getConnection(workspaceId)
    if (!updated) throw new Error("Failed to persist connection")
    return updated
}

export async function refreshLinkedAccounts(workspaceId: string): Promise<SocialConnection | null> {
    const connection = await getConnection(workspaceId)
    if (!connection) return null
    const accounts = await fetchLinkedAccounts(connection.zernioAccountId)
    await adminDb.collection("social_connections").doc(connection.id).update({
        accounts,
        updatedAt: new Date(),
    })
    return { ...connection, accounts }
}

export async function disconnect(workspaceId: string): Promise<void> {
    const connection = await getConnection(workspaceId)
    if (!connection) return

    try {
        await zernioRequest(`/v1/sub-accounts/${connection.zernioAccountId}`, {
            method: "DELETE",
        })
    } catch (err) {
        console.error("[Zernio] delete sub-account failed (continuing):", err)
    }

    await adminDb.collection("social_connections").doc(connection.id).delete()
    await adminDb.collection("workspaces").doc(workspaceId).update({
        zernio_account_id: null,
        updatedAt: new Date(),
    })
}
