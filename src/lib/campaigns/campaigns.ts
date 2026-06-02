import { adminDb } from "@/lib/firebase-admin"
import { sendEmail, SesIdentityNotReadyError } from "@/lib/ses/sender"
import { InsufficientCreditsError } from "@/lib/credits/email-credits"
import { logActivity } from "@/lib/activities/timeline"
import { unionMembers } from "@/lib/lists/contact-lists"
import type {
    CampaignABTest,
    CampaignAudienceType,
    CampaignStatus,
    EmailCampaign,
} from "@/types"

function tsToISO(ts: unknown): string {
    if (!ts) return ""
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
        return (ts as { toDate: () => Date }).toDate().toISOString()
    }
    if (ts instanceof Date) return ts.toISOString()
    return typeof ts === "string" ? ts : ""
}

function mapCampaign(id: string, data: Record<string, unknown>): EmailCampaign {
    const stats = (data.stats as EmailCampaign["stats"]) ?? {
        targeted: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
    }
    return {
        id,
        workspaceId: (data.workspaceId as string) ?? "",
        name: (data.name as string) ?? "",
        subject: (data.subject as string) ?? "",
        templateId: (data.templateId as string) ?? null,
        renderedHtml: (data.renderedHtml as string) ?? "",
        audienceType: (data.audienceType as CampaignAudienceType) ?? "all_contacts",
        audienceValue: (data.audienceValue as string[] | null) ?? null,
        excludeListIds: (data.excludeListIds as string[] | null) ?? null,
        status: (data.status as CampaignStatus) ?? "draft",
        scheduledAt: data.scheduledAt ? tsToISO(data.scheduledAt) : undefined,
        stats,
        abTest: (data.abTest as CampaignABTest) ?? undefined,
        createdBy: (data.createdBy as string) ?? null,
        createdAt: tsToISO(data.createdAt),
        updatedAt: tsToISO(data.updatedAt),
        sentAt: data.sentAt ? tsToISO(data.sentAt) : undefined,
    }
}

export async function listCampaigns(workspaceId: string): Promise<EmailCampaign[]> {
    if (!workspaceId) throw new Error("workspaceId required")
    const snap = await adminDb
        .collection("email_campaigns")
        .where("workspaceId", "==", workspaceId)
        .orderBy("createdAt", "desc")
        .limit(200)
        .get()
    return snap.docs.map((d) => mapCampaign(d.id, d.data()))
}

export async function getCampaign(
    workspaceId: string,
    id: string,
): Promise<EmailCampaign | null> {
    const doc = await adminDb.collection("email_campaigns").doc(id).get()
    if (!doc.exists) return null
    const data = doc.data()!
    if (data.workspaceId !== workspaceId) return null
    return mapCampaign(doc.id, data)
}

export interface CreateCampaignInput {
    workspaceId: string
    name: string
    subject: string
    templateId?: string | null
    renderedHtml: string
    audienceType: CampaignAudienceType
    audienceValue?: string[] | null
    excludeListIds?: string[] | null
    abTest?: CampaignABTest | null
    createdBy?: string | null
    scheduledAt?: Date | null
}

export async function createCampaign(input: CreateCampaignInput): Promise<EmailCampaign> {
    if (!input.workspaceId) throw new Error("workspaceId required")
    if (!input.name) throw new Error("name required")
    if (!input.subject) throw new Error("subject required")
    if (!input.renderedHtml) throw new Error("renderedHtml required")

    const now = new Date()
    const status: CampaignStatus = input.scheduledAt ? "scheduled" : "draft"
    const ref = await adminDb.collection("email_campaigns").add({
        workspaceId: input.workspaceId,
        name: input.name,
        subject: input.subject,
        templateId: input.templateId ?? null,
        renderedHtml: input.renderedHtml,
        audienceType: input.audienceType,
        audienceValue: input.audienceValue ?? null,
        excludeListIds: input.excludeListIds ?? null,
        status,
        scheduledAt: input.scheduledAt ?? null,
        stats: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
        abTest: input.abTest ?? null,
        createdBy: input.createdBy ?? null,
        createdAt: now,
        updatedAt: now,
    })
    const snap = await ref.get()
    return mapCampaign(ref.id, snap.data()!)
}

export interface UpdateCampaignInput {
    name?: string
    subject?: string
    templateId?: string | null
    renderedHtml?: string
    audienceType?: CampaignAudienceType
    audienceValue?: string[] | null
    excludeListIds?: string[] | null
    abTest?: CampaignABTest | null
    scheduledAt?: Date | null
}

export async function updateCampaign(
    workspaceId: string,
    id: string,
    patch: UpdateCampaignInput,
): Promise<EmailCampaign> {
    const ref = adminDb.collection("email_campaigns").doc(id)
    const doc = await ref.get()
    if (!doc.exists) throw new Error("Campaign not found")
    const existing = doc.data()!
    if (existing.workspaceId !== workspaceId) throw new Error("Forbidden")
    if (existing.status !== "draft" && existing.status !== "scheduled") {
        throw new Error(`Cannot edit campaign in status '${existing.status}'`)
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.name !== undefined) updates.name = patch.name
    if (patch.subject !== undefined) updates.subject = patch.subject
    if (patch.templateId !== undefined) updates.templateId = patch.templateId
    if (patch.renderedHtml !== undefined) updates.renderedHtml = patch.renderedHtml
    if (patch.audienceType !== undefined) updates.audienceType = patch.audienceType
    if (patch.audienceValue !== undefined) updates.audienceValue = patch.audienceValue
    if (patch.excludeListIds !== undefined) updates.excludeListIds = patch.excludeListIds
    if (patch.abTest !== undefined) updates.abTest = patch.abTest
    if (patch.scheduledAt !== undefined) {
        updates.scheduledAt = patch.scheduledAt
        // Status follows the schedule: presence of a date = scheduled, absence = draft
        updates.status = patch.scheduledAt ? "scheduled" : "draft"
    }

    await ref.update(updates)
    const updated = await ref.get()
    return mapCampaign(ref.id, updated.data()!)
}

export async function deleteCampaign(workspaceId: string, id: string): Promise<void> {
    const ref = adminDb.collection("email_campaigns").doc(id)
    const doc = await ref.get()
    if (!doc.exists) return
    const data = doc.data()!
    if (data.workspaceId !== workspaceId) throw new Error("Forbidden")
    if (data.status === "sending") throw new Error("Cannot delete a campaign while it is sending")
    await ref.delete()
}

/**
 * Duplicate a campaign as a fresh draft. Resets stats/status/schedule,
 * appends "(copy)" to the name. Useful for "Send another to the same audience"
 * or "Iterate on the design without losing the sent version."
 */
export async function duplicateCampaign(
    workspaceId: string,
    id: string,
    createdBy: string | null,
): Promise<EmailCampaign> {
    const ref = adminDb.collection("email_campaigns").doc(id)
    const doc = await ref.get()
    if (!doc.exists) throw new Error("Campaign not found")
    const data = doc.data()!
    if (data.workspaceId !== workspaceId) throw new Error("Forbidden")

    const now = new Date()
    const newRef = await adminDb.collection("email_campaigns").add({
        workspaceId,
        name: `${data.name ?? "Untitled"} (copy)`,
        subject: data.subject ?? "",
        templateId: data.templateId ?? null,
        renderedHtml: data.renderedHtml ?? "",
        audienceType: data.audienceType ?? "all_contacts",
        audienceValue: data.audienceValue ?? null,
        excludeListIds: data.excludeListIds ?? null,
        status: "draft",
        scheduledAt: null,
        stats: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
        abTest: data.abTest ?? null,
        createdBy: createdBy ?? null,
        createdAt: now,
        updatedAt: now,
    })
    const snap = await newRef.get()
    return mapCampaign(newRef.id, snap.data()!)
}

/**
 * Pull the email addresses of contacts who were sent the campaign but did
 * NOT open it. Used by "Resend to non-openers" — feeds the new campaign's
 * `audienceValue` as a list of email addresses (audienceType "by_emails"
 * fallback: we treat it as a one-off custom set via a helper-list scope).
 *
 * Returns up to `limit` rows. Pages would be added later if anyone needs > 5k.
 */
export async function getCampaignNonOpeners(
    workspaceId: string,
    campaignId: string,
    limit = 5000,
): Promise<{ contactIds: string[]; emails: string[] }> {
    const snap = await adminDb
        .collection("email_logs")
        .where("workspaceId", "==", workspaceId)
        .where("campaignId", "==", campaignId)
        .limit(limit)
        .get()

    const contactIds: string[] = []
    const emails: string[] = []
    for (const doc of snap.docs) {
        const data = doc.data()
        // Skip recipients who DID open or who never delivered
        if (data.openedAt) continue
        if (data.status !== "sent" && data.status !== "delivered") continue
        const cid = data.contactId as string | undefined
        const to = data.to as string | undefined
        if (cid) contactIds.push(cid)
        if (to) emails.push(to)
    }
    return { contactIds: Array.from(new Set(contactIds)), emails: Array.from(new Set(emails)) }
}

/**
 * Aggregate per-link click counts for a campaign's report. Pulls every
 * email_log for the campaign, counts entries in `data.clicks` (array of
 * { url, at } records written by the click-tracking redirect).
 *
 * Older logs (pre per-URL tracking) only have `clickedAt` and no `clicks`
 * array — those count toward the campaign's overall click rate but not
 * any specific URL.
 */
export async function getCampaignLinkBreakdown(
    workspaceId: string,
    campaignId: string,
    limit = 5000,
): Promise<Array<{ url: string; clicks: number; uniqueClickers: number }>> {
    const snap = await adminDb
        .collection("email_logs")
        .where("workspaceId", "==", workspaceId)
        .where("campaignId", "==", campaignId)
        .limit(limit)
        .get()

    const totals = new Map<string, { clicks: number; clickers: Set<string> }>()
    for (const doc of snap.docs) {
        const data = doc.data()
        const clicks = (data.clicks as Array<{ url?: string }> | undefined) ?? []
        const recipientKey = (data.contactId as string) || (data.to as string) || doc.id
        for (const c of clicks) {
            if (!c?.url) continue
            const entry = totals.get(c.url) ?? { clicks: 0, clickers: new Set<string>() }
            entry.clicks += 1
            entry.clickers.add(recipientKey)
            totals.set(c.url, entry)
        }
    }
    return Array.from(totals.entries())
        .map(([url, v]) => ({ url, clicks: v.clicks, uniqueClickers: v.clickers.size }))
        .sort((a, b) => b.clicks - a.clicks)
}

/**
 * Engagement timeline: for each delivered log, bucket by date (UTC).
 * Returns one row per day with sent / opened / clicked counts.
 *
 * Used by the campaign performance dashboard area chart.
 */
export interface EngagementDayRow {
    date: string // ISO date YYYY-MM-DD
    sent: number
    opened: number
    clicked: number
}

export async function getCampaignEngagementTimeline(
    workspaceId: string,
    campaignId: string,
    limit = 5000,
): Promise<EngagementDayRow[]> {
    const snap = await adminDb
        .collection("email_logs")
        .where("workspaceId", "==", workspaceId)
        .where("campaignId", "==", campaignId)
        .limit(limit)
        .get()

    const days = new Map<string, EngagementDayRow>()
    const bucket = (raw: unknown): string | null => {
        if (!raw) return null
        const d =
            typeof (raw as { toDate?: () => Date }).toDate === "function"
                ? (raw as { toDate: () => Date }).toDate()
                : raw instanceof Date
                  ? raw
                  : new Date(String(raw))
        if (isNaN(d.getTime())) return null
        return d.toISOString().slice(0, 10)
    }

    for (const doc of snap.docs) {
        const data = doc.data()
        const sentDay = bucket(data.sentAt) ?? bucket(data.createdAt)
        if (sentDay) {
            const row = days.get(sentDay) ?? { date: sentDay, sent: 0, opened: 0, clicked: 0 }
            row.sent += 1
            days.set(sentDay, row)
        }
        const openedDay = bucket(data.openedAt)
        if (openedDay) {
            const row = days.get(openedDay) ?? { date: openedDay, sent: 0, opened: 0, clicked: 0 }
            row.opened += 1
            days.set(openedDay, row)
        }
        const clickedDay = bucket(data.clickedAt)
        if (clickedDay) {
            const row = days.get(clickedDay) ?? { date: clickedDay, sent: 0, opened: 0, clicked: 0 }
            row.clicked += 1
            days.set(clickedDay, row)
        }
    }

    return Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date))
}

interface AudienceContact {
    /** Empty string for external (CSV-imported) emails — they have no contact doc. */
    id: string
    email: string
    /** True for CSV-imported emails that aren't tied to a CRM contact. */
    external?: boolean
    /** Optional display name (used by personalization tokens for externals). */
    name?: string
}

async function resolveContactsByIds(
    workspaceId: string,
    ids: string[],
): Promise<AudienceContact[]> {
    if (ids.length === 0) return []
    const out: AudienceContact[] = []
    for (let i = 0; i < ids.length; i += 30) {
        const chunk = ids.slice(i, i + 30)
        const snap = await adminDb
            .collection("contacts")
            .where("workspaceId", "==", workspaceId)
            .where("__name__", "in", chunk)
            .get()
        for (const d of snap.docs) {
            const email = (d.data().email as string) ?? ""
            if (email && email.includes("@")) out.push({ id: d.id, email })
        }
    }
    return out
}

/**
 * Workspace-wide email marketing health summary, computed from campaign
 * stats over the last `windowDays` days. Cheap to run — uses the
 * pre-aggregated counters on each campaign rather than scanning email_logs.
 */
export async function getWorkspaceEmailStats(
    workspaceId: string,
    windowDays = 30,
): Promise<{
    totalSent: number
    totalDelivered: number
    avgOpenRate: number
    avgClickRate: number
    avgBounceRate: number
    activeCampaigns: number
    last30Sent: number
}> {
    const since = new Date()
    since.setDate(since.getDate() - windowDays)

    const snap = await adminDb
        .collection("email_campaigns")
        .where("workspaceId", "==", workspaceId)
        .limit(500)
        .get()

    let totalSent = 0
    let totalDelivered = 0
    let openSum = 0
    let clickSum = 0
    let bounceSum = 0
    let withStats = 0
    let activeCampaigns = 0
    let last30Sent = 0

    for (const doc of snap.docs) {
        const d = doc.data()
        const status = d.status as string
        if (status === "draft" || status === "scheduled" || status === "sending") {
            activeCampaigns += 1
            continue
        }

        const stats = (d.stats as Record<string, number> | undefined) ?? {}
        const sent = stats.sent ?? 0
        const failed = stats.failed ?? 0
        if (sent === 0) continue
        totalSent += sent
        totalDelivered += Math.max(0, sent - failed)
        const open = stats.opened ?? 0
        const click = stats.clicked ?? 0
        const bounce = stats.bounced ?? 0
        if (sent > 0) {
            openSum += open / sent
            clickSum += click / sent
            bounceSum += bounce / sent
            withStats += 1
        }

        const sentAt =
            (d.sentAt && typeof (d.sentAt as { toDate?: () => Date }).toDate === "function"
                ? (d.sentAt as { toDate: () => Date }).toDate()
                : null) ?? null
        if (sentAt && sentAt >= since) {
            last30Sent += sent
        }
    }

    return {
        totalSent,
        totalDelivered,
        avgOpenRate: withStats > 0 ? (openSum / withStats) * 100 : 0,
        avgClickRate: withStats > 0 ? (clickSum / withStats) * 100 : 0,
        avgBounceRate: withStats > 0 ? (bounceSum / withStats) * 100 : 0,
        activeCampaigns,
        last30Sent,
    }
}

export async function previewAudienceCount(
    workspaceId: string,
    audienceType: CampaignAudienceType,
    audienceValue: string[] | null,
    excludeListIds: string[] | null = null,
): Promise<{ count: number; capped: boolean }> {
    // Reuses the resolver to ensure preview matches send-time audience
    const cap = 5000
    const audience = await resolveAudience(
        workspaceId,
        audienceType,
        audienceValue,
        excludeListIds,
        cap,
    )
    return { count: audience.length, capped: audience.length === cap }
}

async function resolveAudience(
    workspaceId: string,
    audienceType: CampaignAudienceType,
    audienceValue: string[] | null,
    excludeListIds: string[] | null = null,
    limit = 5000,
): Promise<AudienceContact[]> {
    let base: AudienceContact[] = []

    if (audienceType === "all_contacts") {
        const snap = await adminDb
            .collection("contacts")
            .where("workspaceId", "==", workspaceId)
            .limit(limit)
            .get()
        base = snap.docs
            .map((d) => ({ id: d.id, email: (d.data().email as string) ?? "" }))
            .filter((c) => c.email && c.email.includes("@"))
    } else if (audienceType === "by_ids") {
        base = await resolveContactsByIds(workspaceId, audienceValue ?? [])
    } else if (audienceType === "by_list") {
        const listIds = audienceValue ?? []
        if (listIds.length === 0) return []
        // by_list now includes both CRM contacts AND external CSV-imported
        // emails (those don't have a contact doc, so they bypass the contacts
        // lookup and ride along as { id: "", email, external: true, name? }).
        const { contactIds, externalEmails } = await unionMembers(
            workspaceId,
            listIds,
            limit,
        )
        const crmContacts = await resolveContactsByIds(workspaceId, contactIds)
        // Dedupe externals against any CRM contacts that share the same email
        const knownEmails = new Set(crmContacts.map((c) => c.email.toLowerCase()))
        const externals: AudienceContact[] = externalEmails
            .filter((e) => !knownEmails.has(e.email.toLowerCase()))
            .map((e) => ({
                id: "",
                email: e.email,
                external: true,
                name: e.name,
            }))
        base = [...crmContacts, ...externals]
    }

    if (audienceType === "by_tag") {
        const tags = audienceValue ?? []
        if (tags.length === 0) return []
        const snap = await adminDb
            .collection("contacts")
            .where("workspaceId", "==", workspaceId)
            .where("tags", "array-contains-any", tags.slice(0, 10))
            .limit(limit)
            .get()
        base = snap.docs
            .map((d) => ({ id: d.id, email: (d.data().email as string) ?? "" }))
            .filter((c) => c.email && c.email.includes("@"))
    }

    // Exclusion step: filter out any audience entries that appear in the
    // excludeListIds. Excludes by contactId AND by lower-cased email so
    // CSV-imported externals on the exclude list are honored too.
    if (excludeListIds && excludeListIds.length > 0) {
        const excluded = await unionMembers(workspaceId, excludeListIds, limit)
        const excludedIds = new Set(excluded.contactIds)
        const excludedEmails = new Set(
            excluded.externalEmails.map((e) => e.email.toLowerCase()),
        )
        base = base.filter(
            (c) =>
                !excludedIds.has(c.id) &&
                !excludedEmails.has((c.email ?? "").toLowerCase()),
        )
    }

    return base
}

export interface SendCampaignResult {
    ok: boolean
    campaignId: string
    targeted: number
    sent: number
    failed: number
    skipped: number
    error?: string
}

/** Stable hash for shuffling — keeps the A/B split idempotent across retries. */
function stableHash(s: string): number {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}

/** Number of recipients sent in parallel within a single campaign. */
const SEND_CONCURRENCY = 5

/** Retry transient SES failures (network blips, throttle) up to this many times. */
const SEND_MAX_ATTEMPTS = 3

/** Backoff between retries. */
const SEND_RETRY_BASE_MS = 250

function isTransientError(err: unknown): boolean {
    if (err instanceof SesIdentityNotReadyError) return false
    if (err instanceof InsufficientCreditsError) return false
    const message = err instanceof Error ? err.message : String(err)
    // Treat AWS throttles, 5xx, and network errors as transient. Anything that
    // looks like a permanent bounce / config issue is left alone.
    return /(throttl|timeout|temporar|service unavailable|internal server|ECONN|ETIMEDOUT|ENETUNREACH|fetch failed)/i.test(
        message,
    )
}

async function sendOneWithRetry(
    args: Parameters<typeof sendEmail>[0],
): Promise<{ ok: boolean; fatal?: Error }> {
    let lastError: unknown
    for (let attempt = 1; attempt <= SEND_MAX_ATTEMPTS; attempt++) {
        try {
            const result = await sendEmail(args)
            if (result.ok) return { ok: true }
            // Soft-fail (e.g. invalid recipient) — don't retry.
            return { ok: false }
        } catch (err) {
            lastError = err
            if (
                err instanceof SesIdentityNotReadyError ||
                err instanceof InsufficientCreditsError
            ) {
                return { ok: false, fatal: err }
            }
            if (attempt < SEND_MAX_ATTEMPTS && isTransientError(err)) {
                await new Promise((r) => setTimeout(r, SEND_RETRY_BASE_MS * 2 ** (attempt - 1)))
                continue
            }
            return { ok: false }
        }
    }
    // Shouldn't get here, but TypeScript wants a return.
    void lastError
    return { ok: false }
}

export async function sendCampaign(
    workspaceId: string,
    campaignId: string,
): Promise<SendCampaignResult> {
    const ref = adminDb.collection("email_campaigns").doc(campaignId)

    // Race-safe claim: atomically transition status (draft|scheduled) → sending.
    // Prevents double-sends if the cron fires twice or a manual send overlaps
    // a scheduled tick.
    const claimResult = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists) throw new Error("Campaign not found")
        const data = snap.data()!
        if (data.workspaceId !== workspaceId) throw new Error("Forbidden")
        if (data.status !== "draft" && data.status !== "scheduled") {
            return {
                claimed: false as const,
                status: data.status as CampaignStatus,
                data,
            }
        }
        tx.update(ref, { status: "sending", updatedAt: new Date() })
        return { claimed: true as const, status: data.status, data }
    })

    if (!claimResult.claimed) {
        return {
            ok: false,
            campaignId,
            targeted: 0,
            sent: 0,
            failed: 0,
            skipped: 0,
            error: `Cannot send campaign in status '${claimResult.status}'`,
        }
    }

    const data = claimResult.data

    let sent = 0
    let failed = 0
    let skipped = 0
    let targeted = 0
    let fatalError: string | undefined

    try {
        const audience = await resolveAudience(
            workspaceId,
            data.audienceType as CampaignAudienceType,
            (data.audienceValue as string[] | null) ?? null,
            (data.excludeListIds as string[] | null) ?? null,
        )
        targeted = audience.length

        // A/B test: pick a test pool of `testPercentage`% of the audience,
        // split it 50/50 between the two subject variants, leave the
        // remainder for the cron to fire later with the winning subject.
        const abTest = (data.abTest as CampaignABTest | null) ?? null
        const isABInitialSend =
            !!abTest?.enabled &&
            abTest.variants?.length === 2 &&
            !abTest.winnerVariant

        let sendList = audience
        let abVariantPerRecipient: Array<0 | 1> | null = null

        if (isABInitialSend) {
            const pct = Math.min(50, Math.max(10, abTest.testPercentage))
            // Use a stable, content-derived shuffle seed so the same audience
            // always splits the same way (idempotency for retries)
            const shuffled = [...audience].sort((a, b) =>
                stableHash(a.email + ":" + campaignId) -
                stableHash(b.email + ":" + campaignId),
            )
            const poolSize = Math.max(2, Math.floor((shuffled.length * pct) / 100))
            const pool = shuffled.slice(0, poolSize)
            sendList = pool
            // Alternate variant assignment 0,1,0,1...
            abVariantPerRecipient = pool.map((_, i) => (i % 2 === 0 ? 0 : 1) as 0 | 1)
        }

        // Send in parallel chunks. Stops fast if we hit a fatal error
        // (SES not ready / out of credits) — skip remainder of audience.
        for (let i = 0; i < sendList.length; i += SEND_CONCURRENCY) {
            if (fatalError) break
            const chunk = sendList.slice(i, i + SEND_CONCURRENCY)
            const results = await Promise.all(
                chunk.map((contact, j) => {
                    const variantIdx = abVariantPerRecipient
                        ? abVariantPerRecipient[i + j]
                        : null
                    const subject =
                        variantIdx !== null && abTest
                            ? abTest.variants[variantIdx]
                            : data.subject
                    // If bodyVariants is set, also swap the body per variant.
                    // Otherwise both variants share data.renderedHtml.
                    const html =
                        variantIdx !== null && abTest?.bodyVariants?.[variantIdx]
                            ? abTest.bodyVariants[variantIdx]
                            : data.renderedHtml
                    // Append "::ab=0|1" to campaignId so we can compute
                    // per-variant open/click stats from email_logs later.
                    const campaignKey =
                        variantIdx !== null
                            ? `${campaignId}::ab=${variantIdx}`
                            : campaignId
                    return sendOneWithRetry({
                        workspaceId,
                        to: contact.email,
                        subject,
                        html,
                        contactId: contact.external ? undefined : contact.id,
                        campaignId: campaignKey,
                        autoResolveContact: false,
                    })
                }),
            )
            for (const r of results) {
                if (r.fatal) {
                    fatalError = r.fatal.message
                    if (r.fatal instanceof InsufficientCreditsError) {
                        skipped = sendList.length - sent - failed - 1
                    }
                    break
                }
                if (r.ok) sent += 1
                else failed += 1
            }
        }

        // For A/B initial send, leave campaign in a special "test in flight"
        // state so the winner-picker cron can find it. We piggyback on the
        // existing status field plus an abTest marker.
        if (isABInitialSend && !fatalError) {
            const winnerEligibleAt = new Date(
                Date.now() + abTest.testDurationHours * 60 * 60 * 1000,
            )
            await ref.update({
                status: "sending",
                stats: { targeted, sent, failed, skipped },
                abTest: {
                    ...abTest,
                    // Reuse winnerSelectedAt slot? No — we store the eligibility
                    // window separately so the cron can query for it.
                    testWindowEndsAt: winnerEligibleAt,
                },
                updatedAt: new Date(),
            })

            await logActivity({
                workspaceId,
                type: "email_sent",
                source: "ses",
                subject: `Campaign "${data.name}" — A/B test sent`,
                body: `Test pool: ${sent}/${sendList.length} delivered. Winner picks at ${winnerEligibleAt.toISOString()}.`,
                metadata: { campaignId, abTest: true },
                sourceRef: campaignId,
            })

            return {
                ok: true,
                campaignId,
                targeted,
                sent,
                failed,
                skipped,
                error: undefined,
            }
        }

        const finalStatus: CampaignStatus =
            fatalError || failed > 0 ? "sent_with_errors" : "sent"

        await ref.update({
            status: finalStatus,
            stats: { targeted, sent, failed, skipped },
            sentAt: new Date(),
            updatedAt: new Date(),
        })

        await logActivity({
            workspaceId,
            type: "email_sent",
            source: "ses",
            subject: `Campaign "${data.name}" completed`,
            body: `${sent}/${targeted} sent, ${failed} failed, ${skipped} skipped.`,
            metadata: { campaignId },
            sourceRef: campaignId,
        })

        return {
            ok: !fatalError,
            campaignId,
            targeted,
            sent,
            failed,
            skipped,
            error: fatalError,
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await ref.update({
            status: "failed",
            stats: { targeted, sent, failed, skipped },
            updatedAt: new Date(),
        })
        return {
            ok: false,
            campaignId,
            targeted,
            sent,
            failed,
            skipped,
            error: message,
        }
    }
}

// ── A/B test winner finalization ──────────────────────────────────────────

interface VariantStats {
    sent: number
    opens: number
    clicks: number
}

async function variantStatsFor(
    workspaceId: string,
    campaignId: string,
    variant: 0 | 1,
): Promise<VariantStats> {
    const snap = await adminDb
        .collection("email_logs")
        .where("workspaceId", "==", workspaceId)
        .where("campaignId", "==", `${campaignId}::ab=${variant}`)
        .limit(10_000)
        .get()
    let opens = 0
    let clicks = 0
    for (const d of snap.docs) {
        const data = d.data()
        if (data.openedAt) opens += 1
        if (data.clickedAt) clicks += 1
    }
    return { sent: snap.size, opens, clicks }
}

/**
 * Pick the winning variant for an A/B campaign whose test window has
 * elapsed, then send the winning subject to the rest of the audience.
 * Idempotent — bails if winnerVariant is already set.
 */
export async function finalizeABTest(
    workspaceId: string,
    campaignId: string,
): Promise<{ ok: boolean; winnerVariant?: 0 | 1; sent?: number; error?: string }> {
    const ref = adminDb.collection("email_campaigns").doc(campaignId)
    const doc = await ref.get()
    if (!doc.exists) return { ok: false, error: "Campaign not found" }
    const data = doc.data()!
    if (data.workspaceId !== workspaceId) return { ok: false, error: "Forbidden" }

    const ab = (data.abTest as CampaignABTest | null) ?? null
    if (!ab?.enabled) return { ok: false, error: "Not an A/B campaign" }
    if (ab.winnerVariant !== undefined) {
        return { ok: false, error: "Winner already picked" }
    }

    const [v0, v1] = await Promise.all([
        variantStatsFor(workspaceId, campaignId, 0),
        variantStatsFor(workspaceId, campaignId, 1),
    ])

    const metric = ab.metric ?? "opens"
    const score = (v: VariantStats) => (metric === "clicks" ? v.clicks : v.opens)
    // Tie-break: pick variant 0 (first one)
    const winner: 0 | 1 = score(v1) > score(v0) ? 1 : 0
    const winningSubject = ab.variants[winner]
    const winningHtml = ab.bodyVariants?.[winner] ?? (data.renderedHtml as string)

    // Send winning subject to the audience MINUS recipients who already
    // received the test (by email).
    const audience = await resolveAudience(
        workspaceId,
        data.audienceType as CampaignAudienceType,
        (data.audienceValue as string[] | null) ?? null,
        (data.excludeListIds as string[] | null) ?? null,
    )
    const alreadyEmailed = new Set<string>()
    const testLogsSnap = await adminDb
        .collection("email_logs")
        .where("workspaceId", "==", workspaceId)
        .where("campaignId", "in", [`${campaignId}::ab=0`, `${campaignId}::ab=1`])
        .limit(10_000)
        .get()
    for (const d of testLogsSnap.docs) {
        const e = ((d.data().to as string) ?? "").toLowerCase()
        if (e) alreadyEmailed.add(e)
    }

    const remainder = audience.filter(
        (c) => !alreadyEmailed.has(c.email.toLowerCase()),
    )

    let sent = 0
    let failed = 0
    let fatal: string | undefined

    for (let i = 0; i < remainder.length; i += SEND_CONCURRENCY) {
        if (fatal) break
        const chunk = remainder.slice(i, i + SEND_CONCURRENCY)
        const results = await Promise.all(
            chunk.map((c) =>
                sendOneWithRetry({
                    workspaceId,
                    to: c.email,
                    subject: winningSubject,
                    html: winningHtml,
                    contactId: c.external ? undefined : c.id,
                    campaignId, // winner send uses bare campaignId, no ::ab=N
                    autoResolveContact: false,
                }),
            ),
        )
        for (const r of results) {
            if (r.fatal) {
                fatal = r.fatal.message
                break
            }
            if (r.ok) sent += 1
            else failed += 1
        }
    }

    const totalSent = (data.stats?.sent ?? 0) + sent
    const totalFailed = (data.stats?.failed ?? 0) + failed
    const finalStatus: CampaignStatus =
        fatal || totalFailed > 0 ? "sent_with_errors" : "sent"

    await ref.update({
        status: finalStatus,
        stats: {
            targeted: data.stats?.targeted ?? audience.length,
            sent: totalSent,
            failed: totalFailed,
            skipped: data.stats?.skipped ?? 0,
        },
        abTest: {
            ...ab,
            winnerVariant: winner,
            winnerSelectedAt: new Date(),
            variantStats: [v0, v1],
        },
        sentAt: new Date(),
        updatedAt: new Date(),
    })

    await logActivity({
        workspaceId,
        type: "email_sent",
        source: "ses",
        subject: `Campaign "${data.name}" — winner picked`,
        body: `Variant ${winner} won (${score(winner === 0 ? v0 : v1)} ${metric} vs ${score(winner === 0 ? v1 : v0)}). Sent winning subject to ${sent} more recipients.`,
        metadata: { campaignId, winner, abTest: true },
        sourceRef: campaignId,
    })

    return { ok: true, winnerVariant: winner, sent }
}

/**
 * Find A/B campaigns whose test window has elapsed and are awaiting winner
 * selection. Used by the cron to drive finalizeABTest.
 */
export async function findDueABCampaigns(
    limit = 20,
): Promise<Array<{ id: string; workspaceId: string }>> {
    const now = new Date()
    // Status="sending" + abTest.enabled + winnerVariant unset + testWindowEndsAt <= now
    const snap = await adminDb
        .collection("email_campaigns")
        .where("status", "==", "sending")
        .where("abTest.enabled", "==", true)
        .where("abTest.testWindowEndsAt", "<=", now)
        .limit(limit)
        .get()
    return snap.docs
        .filter((d) => d.data().abTest?.winnerVariant === undefined)
        .map((d) => ({ id: d.id, workspaceId: d.data().workspaceId as string }))
}
