/**
 * Marketing reporting aggregations.
 *
 * Pulls from the read side: contacts (growth), email_logs (campaign perf
 * + open/click rates), email_campaigns (counts/status), automations
 * (runs + goal-reached), appointments (booking volume).
 *
 * Optimized for "good enough" — pulls bounded slices and aggregates
 * in-memory rather than running expensive Firestore aggregations. Solid
 * through ~10k contacts; v2 would pre-compute daily snapshots.
 */

import { adminDb } from "@/lib/firebase-admin"

const DAY_MS = 24 * 60 * 60 * 1000

function asDate(v: unknown): Date | null {
    if (!v) return null
    if (v instanceof Date) return v
    if (typeof (v as { toDate?: () => Date }).toDate === "function") {
        return (v as { toDate: () => Date }).toDate()
    }
    if (typeof v === "string") {
        const d = new Date(v)
        return isNaN(d.getTime()) ? null : d
    }
    return null
}

function dayKey(d: Date): string {
    return d.toISOString().slice(0, 10)
}

export interface MarketingStats {
    /** Top counters for the workspace */
    totals: {
        contacts: number
        contactsThisMonth: number
        contactsLast7d: number
        campaignsSent: number
        emailsSent30d: number
        emailsOpened30d: number
        emailsClicked30d: number
        emailsBounced30d: number
        automationsActive: number
        automationRuns30d: number
        automationGoals30d: number
        appointmentsUpcoming: number
        appointments30d: number
    }
    /** Daily contact-creation count for the last 90 days. */
    contactGrowth: Array<{ date: string; count: number }>
    /** Per-campaign performance, last 20 campaigns sorted by sentAt desc. */
    campaignPerf: Array<{
        id: string
        name: string
        sent: number
        opens: number
        clicks: number
        openRate: number
        clickRate: number
        sentAt: string
    }>
    /** Per-automation: runs started + completed + goals (top 10 by runs). */
    automationPerf: Array<{
        id: string
        name: string
        runs: number
        completed: number
        goalsReached: number
        conversionRate: number
    }>
}

export async function getMarketingStats(workspaceId: string): Promise<MarketingStats> {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const week = new Date(now.getTime() - 7 * DAY_MS)
    const window30 = new Date(now.getTime() - 30 * DAY_MS)
    const window90 = new Date(now.getTime() - 90 * DAY_MS)

    const contactsAggPromise = adminDb
        .collection("contacts")
        .where("workspaceId", "==", workspaceId)
        .count()
        .get()
        .catch(async () => {
            const snap = await adminDb
                .collection("contacts")
                .where("workspaceId", "==", workspaceId)
                .limit(10_000)
                .get()
            return { data: () => ({ count: snap.size }) } as { data: () => { count: number } }
        })

    const contactsRecentPromise = adminDb
        .collection("contacts")
        .where("workspaceId", "==", workspaceId)
        .where("createdAt", ">=", window90)
        .orderBy("createdAt", "asc")
        .limit(5000)
        .get()

    const campaignsPromise = adminDb
        .collection("email_campaigns")
        .where("workspaceId", "==", workspaceId)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get()

    const emailLogs30Promise = adminDb
        .collection("email_logs")
        .where("workspaceId", "==", workspaceId)
        .where("sentAt", ">=", window30)
        .limit(10_000)
        .get()

    const automationsPromise = adminDb
        .collection("automations")
        .where("workspaceId", "==", workspaceId)
        .limit(200)
        .get()

    const runs30Promise = adminDb
        .collection("automation_runs")
        .where("workspaceId", "==", workspaceId)
        .where("startedAt", ">=", window30)
        .limit(10_000)
        .get()

    // Appointments are workspace-wide; gracefully no-op if the index isn't
    // deployed yet for this workspace.
    const appointmentsPromise = adminDb
        .collection("appointments")
        .where("workspaceId", "==", workspaceId)
        .where("startsAt", ">=", window30)
        .limit(2000)
        .get()
        .catch(() => null)

    const [
        contactsAggSnap,
        contactsRecentSnap,
        campaignsSnap,
        emailLogs30Snap,
        automationsSnap,
        runs30Snap,
        appointmentsSnap,
    ] = await Promise.all([
        contactsAggPromise,
        contactsRecentPromise,
        campaignsPromise,
        emailLogs30Promise,
        automationsPromise,
        runs30Promise,
        appointmentsPromise,
    ])

    const totalContacts = contactsAggSnap.data().count
    const contactsThisMonth = contactsRecentSnap.docs.filter((d) => {
        const created = asDate(d.data().createdAt)
        return created && created >= monthStart
    }).length
    const contactsLast7d = contactsRecentSnap.docs.filter((d) => {
        const created = asDate(d.data().createdAt)
        return created && created >= week
    }).length

    // Contact growth (last 90 days)
    const growthByDay = new Map<string, number>()
    for (let i = 89; i >= 0; i--) {
        const d = new Date(now.getTime() - i * DAY_MS)
        growthByDay.set(dayKey(d), 0)
    }
    for (const d of contactsRecentSnap.docs) {
        const created = asDate(d.data().createdAt)
        if (!created) continue
        const key = dayKey(created)
        if (growthByDay.has(key)) {
            growthByDay.set(key, (growthByDay.get(key) ?? 0) + 1)
        }
    }
    const contactGrowth = [...growthByDay.entries()].map(([date, count]) => ({
        date,
        count,
    }))

    // Email log stats (last 30d)
    let emailsSent30d = 0
    let emailsOpened30d = 0
    let emailsClicked30d = 0
    let emailsBounced30d = 0
    const perCampaign = new Map<string, { sent: number; opens: number; clicks: number }>()
    for (const d of emailLogs30Snap.docs) {
        const data = d.data()
        const status = data.status as string
        const cId = ((data.campaignId as string) ?? "").replace(/::ab=\d+$/, "")
        const ent = perCampaign.get(cId) ?? { sent: 0, opens: 0, clicks: 0 }
        if (status === "sent" || status === "delivered") {
            emailsSent30d += 1
            ent.sent += 1
        }
        if (data.openedAt) {
            emailsOpened30d += 1
            ent.opens += 1
        }
        if (data.clickedAt) {
            emailsClicked30d += 1
            ent.clicks += 1
        }
        if (status === "bounced") emailsBounced30d += 1
        if (cId) perCampaign.set(cId, ent)
    }

    // Campaign performance (join with campaign docs for names + sentAt)
    const campaignDocsById = new Map<string, FirebaseFirestore.DocumentData>()
    for (const d of campaignsSnap.docs) campaignDocsById.set(d.id, d.data())
    const campaignPerf: MarketingStats["campaignPerf"] = []
    for (const [cId, stats] of perCampaign.entries()) {
        const cDoc = campaignDocsById.get(cId)
        if (!cDoc) continue
        const sent = stats.sent
        campaignPerf.push({
            id: cId,
            name: (cDoc.name as string) ?? "(untitled)",
            sent,
            opens: stats.opens,
            clicks: stats.clicks,
            openRate: sent > 0 ? Math.round((stats.opens / sent) * 1000) / 10 : 0,
            clickRate: sent > 0 ? Math.round((stats.clicks / sent) * 1000) / 10 : 0,
            sentAt: asDate(cDoc.sentAt)?.toISOString() ?? "",
        })
    }
    campaignPerf.sort((a, b) => b.sentAt.localeCompare(a.sentAt))

    // Automations
    let automationsActive = 0
    const autoNamesById = new Map<string, string>()
    for (const d of automationsSnap.docs) {
        const data = d.data()
        if (data.enabled) automationsActive += 1
        autoNamesById.set(d.id, (data.name as string) ?? "(untitled)")
    }

    // Runs in last 30d
    let automationRuns30d = 0
    let automationGoals30d = 0
    const perAuto = new Map<string, { runs: number; completed: number; goals: number }>()
    for (const d of runs30Snap.docs) {
        const data = d.data()
        const aId = (data.automationId as string) ?? ""
        if (!aId) continue
        const ent = perAuto.get(aId) ?? { runs: 0, completed: 0, goals: 0 }
        ent.runs += 1
        automationRuns30d += 1
        if (data.status === "completed") ent.completed += 1
        if (data.status === "goal_reached") {
            ent.goals += 1
            automationGoals30d += 1
        }
        perAuto.set(aId, ent)
    }
    const automationPerf: MarketingStats["automationPerf"] = [...perAuto.entries()]
        .map(([id, s]) => ({
            id,
            name: autoNamesById.get(id) ?? "(unknown)",
            runs: s.runs,
            completed: s.completed,
            goalsReached: s.goals,
            conversionRate:
                s.runs > 0 ? Math.round((s.goals / s.runs) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.runs - a.runs)
        .slice(0, 10)

    // Appointments (null if collection/index not present yet)
    let appointmentsUpcoming = 0
    let appointments30d = 0
    if (appointmentsSnap) {
        for (const d of appointmentsSnap.docs) {
            const data = d.data()
            if (data.status === "cancelled") continue
            const startsAt = asDate(data.startsAt)
            if (!startsAt) continue
            if (startsAt > now) appointmentsUpcoming += 1
            if (startsAt >= window30) appointments30d += 1
        }
    }

    return {
        totals: {
            contacts: totalContacts,
            contactsThisMonth,
            contactsLast7d,
            campaignsSent: campaignsSnap.docs.filter((d) => {
                const status = d.data().status as string
                return status === "sent" || status === "sent_with_errors"
            }).length,
            emailsSent30d,
            emailsOpened30d,
            emailsClicked30d,
            emailsBounced30d,
            automationsActive,
            automationRuns30d,
            automationGoals30d,
            appointmentsUpcoming,
            appointments30d,
        },
        contactGrowth,
        campaignPerf,
        automationPerf,
    }
}
