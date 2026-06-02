/**
 * Per-user Gmail integration token storage and management.
 *
 * Each user who signs in with Google gets their own Gmail token record,
 * stored in the `gmail_integrations` collection. This replaces the older
 * workspace-scoped token storage in `oauth_tokens` and `settings`.
 */

import { adminDb } from "@/lib/firebase-admin"

export interface GmailIntegration {
    userId: string
    workspaceId: string
    email: string
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
    historyId?: string
    watchExpiration?: number
    lastSyncAt?: string
    createdAt: string
    updatedAt: string
}

/**
 * Get the Gmail integration for a specific user in a workspace.
 */
export async function getGmailIntegration(
    workspaceId: string,
    userId: string
): Promise<GmailIntegration | null> {
    const docId = `${workspaceId}_${userId}`
    const doc = await adminDb.collection("gmail_integrations").doc(docId).get()
    if (!doc.exists) return null
    return doc.data() as GmailIntegration
}

/**
 * Create or update a Gmail integration for a user.
 */
export async function upsertGmailIntegration(
    workspaceId: string,
    userId: string,
    data: Partial<GmailIntegration>
): Promise<void> {
    const docId = `${workspaceId}_${userId}`
    await adminDb.collection("gmail_integrations").doc(docId).set(
        {
            ...data,
            userId,
            workspaceId,
            updatedAt: new Date().toISOString(),
        },
        { merge: true }
    )
}

/**
 * Get a valid (non-expired) access token for a user, auto-refreshing if needed.
 */
export async function getValidGmailToken(
    workspaceId: string,
    userId: string
): Promise<string> {
    const integration = await getGmailIntegration(workspaceId, userId)
    if (!integration) {
        throw new Error("No Gmail integration found. User must sign in with Google.")
    }

    // Return existing token if still valid (with 60s buffer)
    if (integration.accessTokenExpires && Date.now() < integration.accessTokenExpires - 60_000) {
        return integration.accessToken
    }

    // Refresh the token
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: integration.refreshToken,
        }),
    })

    const refreshed = await response.json()
    if (!refreshed.access_token) {
        throw new Error(
            `Failed to refresh Gmail token: ${refreshed.error || refreshed.error_description || JSON.stringify(refreshed)}`
        )
    }

    const newExpires = Date.now() + refreshed.expires_in * 1000

    await upsertGmailIntegration(workspaceId, userId, {
        accessToken: refreshed.access_token,
        accessTokenExpires: newExpires,
    })

    return refreshed.access_token
}

/**
 * Get the Gmail email address for a user.
 */
export async function getUserGmailEmail(
    workspaceId: string,
    userId: string
): Promise<string | null> {
    const integration = await getGmailIntegration(workspaceId, userId)
    return integration?.email ?? null
}

/**
 * Find a Gmail integration by email address (used by Pub/Sub webhook).
 */
export async function findGmailIntegrationByEmail(
    email: string
): Promise<GmailIntegration | null> {
    const snap = await adminDb
        .collection("gmail_integrations")
        .where("email", "==", email)
        .limit(1)
        .get()
    if (snap.empty) return null
    return snap.docs[0].data() as GmailIntegration
}

/**
 * Get all Gmail integrations with expiring watches (for cron renewal).
 */
export async function getExpiringWatches(
    withinMs: number = 24 * 60 * 60 * 1000
): Promise<GmailIntegration[]> {
    const threshold = Date.now() + withinMs
    const snap = await adminDb
        .collection("gmail_integrations")
        .where("watchExpiration", "<", threshold)
        .where("watchExpiration", ">", 0)
        .get()
    return snap.docs.map((doc) => doc.data() as GmailIntegration)
}
