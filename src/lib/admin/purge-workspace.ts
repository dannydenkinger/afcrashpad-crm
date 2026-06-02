import "server-only"
import { adminDb, getAdminStorageBucket } from "@/lib/firebase-admin"
import { captureError } from "@/lib/error-tracking"
import { getStripe, isStripeConfigured } from "@/lib/billing/credit-topups"

/** Every workspace-scoped collection. Keep in sync when adding new collections. */
const PURGE_COLLECTIONS = [
    "activities",
    "api_keys",
    "appointments",
    "assignment_rules",
    "audit_logs",
    "automation_runs",
    "automations",
    "booking_pages",
    "calendar_integrations",
    "campaign_recipients",
    "contact_lists",
    "contact_statuses",
    "contacts",
    "credit_ledger",
    "custom_fields",
    "document_signature_configs",
    "documents",
    "email_campaigns",
    "email_logs",
    "email_sequence_log",
    "email_sequences",
    "email_suppressions",
    "email_templates",
    "email_tracking",
    "esign_envelopes",
    "form_submissions",
    "gmail_integrations",
    "haro_batches",
    "haro_queries",
    "lead_forms",
    "lead_sources",
    "notifications",
    "opportunities",
    "pipelines",
    "required_docs",
    "scheduled_reports",
    "signature_requests",
    "sms_logs",
    "snippets",
    "social_connections",
    "social_posts",
    "tags",
    "tasks",
    "tracking_emails",
    "webhooks",
    "workflows",
    "workspace_invitations",
    "workspace_members",
] as const

const CONTACT_SUBCOLLECTIONS = ["notes", "tasks", "messages", "documents", "timeline"] as const

const STORAGE_PREFIXES = (workspaceId: string): string[] => [
    `branding/${workspaceId}/`,
    `lead-forms/${workspaceId}/`,
    `workspaces/${workspaceId}/`,
]

export interface PurgeResult {
    workspaceId: string
    stripe: { canceled: boolean; error?: string }
    collections: Record<string, number>
    subcollections: number
    settings: number
    storage: { deleted: number; errors: number }
}

async function purgeCollection(collection: string, workspaceId: string): Promise<number> {
    let deleted = 0
    while (true) {
        const snap = await adminDb
            .collection(collection)
            .where("workspaceId", "==", workspaceId)
            .limit(400)
            .get()
        if (snap.empty) break
        const batch = adminDb.batch()
        snap.docs.forEach((d) => batch.delete(d.ref))
        await batch.commit()
        deleted += snap.size
        if (snap.size < 400) break
    }
    return deleted
}

async function purgeContactSubcollections(workspaceId: string): Promise<number> {
    let deleted = 0
    let lastContact: FirebaseFirestore.QueryDocumentSnapshot | null = null
    while (true) {
        let q = adminDb
            .collection("contacts")
            .where("workspaceId", "==", workspaceId)
            .limit(100)
        if (lastContact) q = q.startAfter(lastContact)
        const contactsSnap = await q.get()
        if (contactsSnap.empty) break
        for (const contactDoc of contactsSnap.docs) {
            for (const sub of CONTACT_SUBCOLLECTIONS) {
                const subSnap = await contactDoc.ref.collection(sub).limit(400).get()
                if (subSnap.empty) continue
                const batch = adminDb.batch()
                subSnap.docs.forEach((d) => batch.delete(d.ref))
                await batch.commit()
                deleted += subSnap.size
            }
        }
        lastContact = contactsSnap.docs[contactsSnap.docs.length - 1]
        if (contactsSnap.size < 100) break
    }
    return deleted
}

async function purgeSettings(workspaceId: string): Promise<number> {
    let deleted = 0
    while (true) {
        const snap = await adminDb
            .collection("settings")
            .where("workspaceId", "==", workspaceId)
            .limit(400)
            .get()
        if (snap.empty) break
        const batch = adminDb.batch()
        snap.docs.forEach((d) => batch.delete(d.ref))
        await batch.commit()
        deleted += snap.size
        if (snap.size < 400) break
    }
    return deleted
}

async function purgeStorage(workspaceId: string): Promise<{ deleted: number; errors: number }> {
    let deleted = 0
    let errors = 0
    try {
        const bucket = getAdminStorageBucket()
        for (const prefix of STORAGE_PREFIXES(workspaceId)) {
            try {
                const [files] = await bucket.getFiles({ prefix })
                await Promise.all(
                    files.map((f) =>
                        f.delete().then(
                            () => { deleted++ },
                            () => { errors++ },
                        ),
                    ),
                )
            } catch (err) {
                errors++
                captureError(err, { scope: "purge-storage-prefix", workspaceId, prefix })
            }
        }
    } catch (err) {
        captureError(err, { scope: "purge-storage", workspaceId })
        errors++
    }
    return { deleted, errors }
}

async function cancelStripeSubscription(
    wsData: FirebaseFirestore.DocumentData,
): Promise<{ canceled: boolean; error?: string }> {
    if (!isStripeConfigured()) return { canceled: false }
    const subId = wsData.stripeSubscriptionId as string | undefined
    if (!subId) return { canceled: false }
    try {
        const stripe = getStripe()
        await stripe.subscriptions.cancel(subId)
        return { canceled: true }
    } catch (err) {
        captureError(err, { scope: "purge-stripe-cancel", subId })
        const message = err instanceof Error ? err.message : "Stripe cancel failed"
        return { canceled: false, error: message }
    }
}

/**
 * Hard-delete one workspace: Stripe subscription canceled, all
 * workspace-scoped Firestore collections cleaned, contact
 * subcollections cleaned, settings + storage prefixes wiped, then
 * the workspace doc itself deleted. Used by both the daily purge
 * cron and the operator "Force purge now" action.
 */
export async function purgeWorkspace(workspaceId: string): Promise<PurgeResult> {
    const wsRef = adminDb.collection("workspaces").doc(workspaceId)
    const wsSnap = await wsRef.get()
    if (!wsSnap.exists) {
        return {
            workspaceId,
            stripe: { canceled: false },
            collections: {},
            subcollections: 0,
            settings: 0,
            storage: { deleted: 0, errors: 0 },
        }
    }
    const wsData = wsSnap.data() || {}

    const stripe = await cancelStripeSubscription(wsData)

    const subcollections = await purgeContactSubcollections(workspaceId).catch((err) => {
        captureError(err, { scope: "purge-contact-subcollections", workspaceId })
        return -1
    })

    const collections: Record<string, number> = {}
    for (const col of PURGE_COLLECTIONS) {
        try {
            collections[col] = await purgeCollection(col, workspaceId)
        } catch (err) {
            captureError(err, { scope: "purge-collection", col, workspaceId })
            collections[col] = -1
        }
    }

    const settings = await purgeSettings(workspaceId).catch((err) => {
        captureError(err, { scope: "purge-settings", workspaceId })
        return -1
    })

    const storage = await purgeStorage(workspaceId)
    await wsRef.delete()

    return { workspaceId, stripe, collections, subcollections, settings, storage }
}

/**
 * Look up due workspaces (deletionPurgeAt <= now) and purge each.
 * Returns one PurgeResult per workspace processed.
 */
export async function purgeDueWorkspaces(limit = 10): Promise<PurgeResult[]> {
    const due = await adminDb
        .collection("workspaces")
        .where("deletionPurgeAt", "<=", new Date())
        .limit(limit)
        .get()
    const results: PurgeResult[] = []
    for (const wsDoc of due.docs) {
        results.push(await purgeWorkspace(wsDoc.id))
    }
    return results
}
