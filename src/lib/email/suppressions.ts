/**
 * Email suppression list — workspace-scoped record of addresses that should
 * NEVER receive email from this workspace, for any reason. Auto-populated
 * from SES bounce/complaint webhooks and from one-click unsubscribes.
 *
 * Storage:
 *   email_suppressions/{workspaceId}__{emailHash}
 *     {
 *       workspaceId,
 *       email,                    // lower-cased, normalized
 *       reason: "bounce"|"complaint"|"unsubscribe"|"manual",
 *       source?: string,          // optional free-text context
 *       sourceCampaignId?: string,
 *       sourceMessageId?: string,
 *       addedAt
 *     }
 *
 * Doc ID is a deterministic hash so re-suppression of an already-suppressed
 * address is a no-op (idempotent).
 */

import crypto from "node:crypto"
import { adminDb } from "@/lib/firebase-admin"

export type SuppressionReason = "bounce" | "complaint" | "unsubscribe" | "manual"

export interface SuppressionEntry {
    workspaceId: string
    email: string
    reason: SuppressionReason
    source?: string
    sourceCampaignId?: string
    sourceMessageId?: string
    addedAt: string
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
}

function suppressionDocId(workspaceId: string, email: string): string {
    const normalized = normalizeEmail(email)
    const hash = crypto
        .createHash("sha256")
        .update(`${workspaceId}:${normalized}`)
        .digest("hex")
        .slice(0, 24)
    return `${workspaceId}__${hash}`
}

function tsToISO(ts: unknown): string {
    if (!ts) return new Date().toISOString()
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
        return (ts as { toDate: () => Date }).toDate().toISOString()
    }
    if (ts instanceof Date) return ts.toISOString()
    return typeof ts === "string" ? ts : new Date().toISOString()
}

export interface AddSuppressionInput {
    workspaceId: string
    email: string
    reason: SuppressionReason
    source?: string
    sourceCampaignId?: string
    sourceMessageId?: string
}

/**
 * Add a single email to the suppression list. Idempotent — repeated calls
 * for the same email/workspace just refresh the metadata.
 */
export async function addSuppression(input: AddSuppressionInput): Promise<void> {
    const email = normalizeEmail(input.email)
    if (!email || !email.includes("@")) return
    const docId = suppressionDocId(input.workspaceId, email)
    const data: Record<string, unknown> = {
        workspaceId: input.workspaceId,
        email,
        reason: input.reason,
        addedAt: new Date(),
    }
    if (input.source) data.source = input.source
    if (input.sourceCampaignId) data.sourceCampaignId = input.sourceCampaignId
    if (input.sourceMessageId) data.sourceMessageId = input.sourceMessageId
    await adminDb.collection("email_suppressions").doc(docId).set(data, { merge: true })
}

/**
 * Check whether a single email is suppressed for a workspace. Used at send
 * time as the last line of defense — even if a campaign somehow targets a
 * suppressed address, this short-circuits the actual SES call.
 */
export async function isSuppressed(
    workspaceId: string,
    email: string,
): Promise<boolean> {
    if (!workspaceId || !email) return false
    const docId = suppressionDocId(workspaceId, email)
    const doc = await adminDb.collection("email_suppressions").doc(docId).get()
    return doc.exists
}

/**
 * Bulk variant: returns the subset of `emails` that are suppressed. Chunks
 * Firestore reads in batches of 100. Useful in the campaign send pipeline
 * to filter the audience up-front rather than doing N round-trips.
 */
export async function findSuppressed(
    workspaceId: string,
    emails: string[],
): Promise<Set<string>> {
    const suppressed = new Set<string>()
    if (emails.length === 0) return suppressed
    const docIds = emails.map((e) => suppressionDocId(workspaceId, e))
    const CHUNK = 100
    for (let i = 0; i < docIds.length; i += CHUNK) {
        const chunk = docIds.slice(i, i + CHUNK)
        const refs = chunk.map((id) =>
            adminDb.collection("email_suppressions").doc(id),
        )
        const snaps = await adminDb.getAll(...refs)
        snaps.forEach((snap, idx) => {
            if (snap.exists) {
                const email = (snap.data()?.email as string) ?? emails[i + idx]
                suppressed.add(normalizeEmail(email))
            }
        })
    }
    return suppressed
}

export async function removeSuppression(
    workspaceId: string,
    email: string,
): Promise<void> {
    const docId = suppressionDocId(workspaceId, email)
    await adminDb.collection("email_suppressions").doc(docId).delete()
}

export interface ListSuppressionsOptions {
    limit?: number
    reason?: SuppressionReason
}

export async function listSuppressions(
    workspaceId: string,
    options: ListSuppressionsOptions = {},
): Promise<SuppressionEntry[]> {
    const limit = options.limit ?? 200
    let query = adminDb
        .collection("email_suppressions")
        .where("workspaceId", "==", workspaceId)
    if (options.reason) {
        query = query.where("reason", "==", options.reason)
    }
    // Note: ordering by addedAt requires a composite index when combined with
    // `reason`. Without `reason`, single-field index on workspaceId+addedAt is
    // auto-created by Firestore.
    const snap = await query.orderBy("addedAt", "desc").limit(limit).get()
    return snap.docs.map((d) => {
        const data = d.data()
        return {
            workspaceId: (data.workspaceId as string) ?? workspaceId,
            email: (data.email as string) ?? "",
            reason: (data.reason as SuppressionReason) ?? "manual",
            source: (data.source as string) || undefined,
            sourceCampaignId: (data.sourceCampaignId as string) || undefined,
            sourceMessageId: (data.sourceMessageId as string) || undefined,
            addedAt: tsToISO(data.addedAt),
        }
    })
}

export async function countSuppressions(workspaceId: string): Promise<number> {
    try {
        const agg = await adminDb
            .collection("email_suppressions")
            .where("workspaceId", "==", workspaceId)
            .count()
            .get()
        return agg.data().count
    } catch {
        const snap = await adminDb
            .collection("email_suppressions")
            .where("workspaceId", "==", workspaceId)
            .limit(10_000)
            .get()
        return snap.size
    }
}
