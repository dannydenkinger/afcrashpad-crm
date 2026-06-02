import "server-only"
import { adminDb } from "@/lib/firebase-admin"
import { PLANS, type PlanTier } from "@/lib/billing/plans"
import { getStripe, isStripeConfigured } from "@/lib/billing/credit-topups"
import type Stripe from "stripe"

export interface WorkspaceRow {
    id: string
    name: string
    slug: string
    ownerId: string
    ownerEmail: string
    ownerName: string
    plan: PlanTier
    planStatus: string
    planExpiresAt: string | null
    memberCount: number
    contactCap: number | null
    contactCount: number
    dealCount: number
    automationCount: number
    campaignCount: number
    lastActiveAt: string | null
    createdAt: string | null
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    monthlyRevenueCents: number
    firsts: Record<string, string | null>
    deletionScheduledAt: string | null
    health: "engaged" | "active" | "idle" | "churn_risk" | "cap_approaching" | "past_due" | "deleting"
}

function toIso(ts: unknown): string | null {
    if (!ts) return null
    if (typeof ts === "string") return ts
    if (ts instanceof Date) return ts.toISOString()
    const t = ts as { toDate?: () => Date }
    if (typeof t.toDate === "function") return t.toDate().toISOString()
    return null
}

function safePlan(raw: unknown): PlanTier {
    return raw === "pro" || raw === "max" ? raw : "free"
}

/**
 * Per-month price for a plan tier in cents. Approximate revenue
 * (yearly subs spread evenly). Includes the base plan only — seat
 * overage isn't tracked yet.
 */
function monthlyCentsForPlan(tier: PlanTier, cadence: string | null | undefined): number {
    if (tier === "free") return 0
    const plan = PLANS[tier]
    if (cadence === "yearly") return Math.round(plan.yearlyCents / 12)
    return plan.monthlyCents
}

interface SubscriptionLookup {
    cadence: string | null
    status: string | null
    currentPeriodEnd: string | null
}

async function getSubscriptionsLookup(): Promise<Map<string, SubscriptionLookup>> {
    const result = new Map<string, SubscriptionLookup>()
    if (!isStripeConfigured()) return result
    try {
        const stripe = getStripe()
        for await (const sub of stripe.subscriptions.list({
            status: "all",
            limit: 100,
            expand: ["data.items.data.price"],
        })) {
            const cadence =
                (sub.metadata?.cadence as string) ||
                (sub.items.data[0]?.price?.recurring?.interval === "year"
                    ? "yearly"
                    : "monthly")
            const periodEndUnix = (sub as unknown as { current_period_end?: number })
                .current_period_end
            result.set(sub.id, {
                cadence,
                status: sub.status,
                currentPeriodEnd: periodEndUnix
                    ? new Date(periodEndUnix * 1000).toISOString()
                    : null,
            })
        }
    } catch {
        // Stripe outage / missing key — fall back to no extra data.
    }
    return result
}

async function countCollectionByWorkspace(
    collection: string,
    workspaceId: string,
): Promise<number> {
    try {
        const agg = await adminDb
            .collection(collection)
            .where("workspaceId", "==", workspaceId)
            .count()
            .get()
        return agg.data().count
    } catch {
        return 0
    }
}

async function lastActiveAtForWorkspace(workspaceId: string): Promise<string | null> {
    try {
        const snap = await adminDb
            .collection("audit_logs")
            .where("workspaceId", "==", workspaceId)
            .orderBy("at", "desc")
            .limit(1)
            .get()
        if (snap.empty) return null
        const data = snap.docs[0].data()
        return toIso(data.at) || toIso(data.timestamp) || toIso(data.createdAt)
    } catch {
        return null
    }
}

function computeHealth(row: Omit<WorkspaceRow, "health">): WorkspaceRow["health"] {
    if (row.deletionScheduledAt) return "deleting"
    if (row.planStatus === "past_due") return "past_due"
    if (row.contactCap != null && row.contactCap > 0) {
        const pct = row.contactCount / row.contactCap
        if (pct >= 0.8) return "cap_approaching"
    }
    const lastActive = row.lastActiveAt ? new Date(row.lastActiveAt).getTime() : 0
    const now = Date.now()
    if (!lastActive) return "idle"
    const days = (now - lastActive) / (1000 * 60 * 60 * 24)
    if (days > 14) return "churn_risk"
    if (days < 7) {
        const hasFeature = Object.values(row.firsts).some((v) => v)
        return hasFeature ? "engaged" : "active"
    }
    return "active"
}

/**
 * Fetch every workspace with enriched stats. Powers the workspaces
 * list, insights overview, and revenue rollups. ~1 read per
 * workspace + 5 aggregate-count reads per workspace, plus the Stripe
 * subscription list. Acceptable up to ~few hundred workspaces; if the
 * operator base grows past that we'll paginate.
 */
export async function listWorkspaces(): Promise<WorkspaceRow[]> {
    const wsSnap = await adminDb.collection("workspaces").get()
    const subs = await getSubscriptionsLookup()

    const rows: WorkspaceRow[] = await Promise.all(
        wsSnap.docs.map(async (doc) => {
            const data = doc.data()
            const id = doc.id
            const plan = safePlan(data.plan)
            const planStatus = (data.planStatus as string) || "active"
            const planExpiresAt = toIso(data.planExpiresAt)
            const memberCount = typeof data.memberCount === "number" ? data.memberCount : 0
            const contactCap = PLANS[plan].limits.contactsCap
            const ownerId = (data.ownerId as string) || ""

            let ownerEmail = ""
            let ownerName = ""
            if (ownerId) {
                try {
                    const ownerDoc = await adminDb.collection("users").doc(ownerId).get()
                    ownerEmail = (ownerDoc.data()?.email as string) || ""
                    ownerName = (ownerDoc.data()?.name as string) || ""
                } catch {
                    // owner record may be missing — leave blank
                }
            }

            const [contactCount, dealCount, automationCount, campaignCount, lastActiveAt] =
                await Promise.all([
                    countCollectionByWorkspace("contacts", id),
                    countCollectionByWorkspace("opportunities", id),
                    countCollectionByWorkspace("automations", id),
                    countCollectionByWorkspace("email_campaigns", id),
                    lastActiveAtForWorkspace(id),
                ])

            const stripeSubscriptionId = (data.stripeSubscriptionId as string) || null
            const subLookup = stripeSubscriptionId ? subs.get(stripeSubscriptionId) : null
            const monthlyRevenueCents = monthlyCentsForPlan(plan, subLookup?.cadence ?? null)

            const firstsRaw = (data.firsts as Record<string, unknown>) || {}
            const firsts: Record<string, string | null> = {
                contactCreatedAt: toIso(firstsRaw.contactCreatedAt),
                dealCreatedAt: toIso(firstsRaw.dealCreatedAt),
                emailSentAt: toIso(firstsRaw.emailSentAt),
                automationCreatedAt: toIso(firstsRaw.automationCreatedAt),
            }

            const base = {
                id,
                name: (data.name as string) || "(unnamed)",
                slug: (data.slug as string) || "",
                ownerId,
                ownerEmail,
                ownerName,
                plan,
                planStatus,
                planExpiresAt,
                memberCount,
                contactCap,
                contactCount,
                dealCount,
                automationCount,
                campaignCount,
                lastActiveAt,
                createdAt: toIso(data.createdAt),
                stripeCustomerId: (data.stripeCustomerId as string) || null,
                stripeSubscriptionId,
                monthlyRevenueCents,
                firsts,
                deletionScheduledAt: toIso(data.deletionScheduledAt),
            }
            return { ...base, health: computeHealth(base) }
        }),
    )

    return rows.sort((a, b) => {
        const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
        const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
        return bTime - aTime
    })
}

export interface OverviewMetrics {
    totalWorkspaces: number
    paidWorkspaces: number
    freeWorkspaces: number
    pastDueWorkspaces: number
    deletingWorkspaces: number
    activeLast7d: number
    activeLast30d: number
    signupsToday: number
    signupsLast7d: number
    signupsLast30d: number
    paidSignupsLast30d: number
    freeToPaidConversionPct: number
    churnRiskCount: number
    capApproachingCount: number
    mrrCents: number
    arrCents: number
    arpuCents: number
    netNewMrrCentsThisMonth: number
    churnedMrrCentsThisMonth: number
}

export function computeOverview(rows: WorkspaceRow[]): OverviewMetrics {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000

    let mrrCents = 0
    let paidWorkspaces = 0
    let freeWorkspaces = 0
    let pastDueWorkspaces = 0
    let deletingWorkspaces = 0
    let activeLast7d = 0
    let activeLast30d = 0
    let signupsToday = 0
    let signupsLast7d = 0
    let signupsLast30d = 0
    let paidSignupsLast30d = 0
    let churnRiskCount = 0
    let capApproachingCount = 0
    let netNewMrrCentsThisMonth = 0
    let churnedMrrCentsThisMonth = 0

    const thirtyDaysAgo = now - 30 * day
    const sevenDaysAgo = now - 7 * day
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    for (const row of rows) {
        mrrCents += row.monthlyRevenueCents
        if (row.plan === "free") freeWorkspaces++
        else paidWorkspaces++
        if (row.planStatus === "past_due") pastDueWorkspaces++
        if (row.deletionScheduledAt) deletingWorkspaces++

        const created = row.createdAt ? new Date(row.createdAt).getTime() : 0
        const lastActive = row.lastActiveAt ? new Date(row.lastActiveAt).getTime() : 0

        if (lastActive && lastActive >= sevenDaysAgo) activeLast7d++
        if (lastActive && lastActive >= thirtyDaysAgo) activeLast30d++
        if (created >= todayStart.getTime()) signupsToday++
        if (created >= sevenDaysAgo) signupsLast7d++
        if (created >= thirtyDaysAgo) {
            signupsLast30d++
            if (row.plan !== "free") paidSignupsLast30d++
        }
        if (row.health === "churn_risk") churnRiskCount++
        if (row.health === "cap_approaching") capApproachingCount++

        // MRR movement this month: new paid workspaces created this
        // month contribute net-new; canceled subscriptions whose period
        // ended this month contribute to churn.
        if (row.plan !== "free" && created >= monthStart.getTime()) {
            netNewMrrCentsThisMonth += row.monthlyRevenueCents
        }
        if (row.planStatus === "canceled" && row.planExpiresAt) {
            const expires = new Date(row.planExpiresAt).getTime()
            if (expires >= monthStart.getTime() && expires <= now) {
                churnedMrrCentsThisMonth += row.monthlyRevenueCents
            }
        }
    }

    const arrCents = mrrCents * 12
    const arpuCents = paidWorkspaces > 0 ? Math.round(mrrCents / paidWorkspaces) : 0
    const freeToPaidConversionPct =
        signupsLast30d > 0 ? (paidSignupsLast30d / signupsLast30d) * 100 : 0

    return {
        totalWorkspaces: rows.length,
        paidWorkspaces,
        freeWorkspaces,
        pastDueWorkspaces,
        deletingWorkspaces,
        activeLast7d,
        activeLast30d,
        signupsToday,
        signupsLast7d,
        signupsLast30d,
        paidSignupsLast30d,
        freeToPaidConversionPct,
        churnRiskCount,
        capApproachingCount,
        mrrCents,
        arrCents,
        arpuCents,
        netNewMrrCentsThisMonth,
        churnedMrrCentsThisMonth,
    }
}

export interface WorkspaceDetail extends WorkspaceRow {
    members: Array<{ userId: string; email: string; name: string; role: string }>
    auditLog: Array<{
        id: string
        at: string | null
        userEmail: string
        userName: string
        action: string
        entity: string
        entityId: string
        entityName: string
    }>
    stripeSubscription: {
        status: string | null
        cadence: string | null
        currentPeriodEnd: string | null
        cancelAt: string | null
        latestInvoiceUrl: string | null
    } | null
}

export async function getWorkspaceDetail(workspaceId: string): Promise<WorkspaceDetail | null> {
    const all = await listWorkspaces()
    const row = all.find((r) => r.id === workspaceId)
    if (!row) return null

    // Members
    const memberSnap = await adminDb
        .collection("workspace_members")
        .where("workspaceId", "==", workspaceId)
        .get()
    const members = await Promise.all(
        memberSnap.docs.map(async (m) => {
            const userId = (m.data().userId as string) || ""
            let email = ""
            let name = ""
            if (userId) {
                const u = await adminDb.collection("users").doc(userId).get()
                email = (u.data()?.email as string) || ""
                name = (u.data()?.name as string) || ""
            }
            return {
                userId,
                email,
                name,
                role: (m.data().role as string) || "MEMBER",
            }
        }),
    )

    // Recent audit log
    let auditLog: WorkspaceDetail["auditLog"] = []
    try {
        const auditSnap = await adminDb
            .collection("audit_logs")
            .where("workspaceId", "==", workspaceId)
            .orderBy("at", "desc")
            .limit(30)
            .get()
        auditLog = auditSnap.docs.map((d) => {
            const data = d.data()
            return {
                id: d.id,
                at: toIso(data.at) || toIso(data.timestamp) || toIso(data.createdAt),
                userEmail: (data.userEmail as string) || "",
                userName: (data.userName as string) || "",
                action: (data.action as string) || "",
                entity: (data.entity as string) || "",
                entityId: (data.entityId as string) || "",
                entityName: (data.entityName as string) || "",
            }
        })
    } catch {
        auditLog = []
    }

    // Stripe subscription info
    let stripeSubscription: WorkspaceDetail["stripeSubscription"] = null
    if (row.stripeSubscriptionId && isStripeConfigured()) {
        try {
            const stripe = getStripe()
            const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId, {
                expand: ["items.data.price", "latest_invoice"],
            })
            const cadence =
                (sub.metadata?.cadence as string) ||
                (sub.items.data[0]?.price?.recurring?.interval === "year"
                    ? "yearly"
                    : "monthly")
            const periodEndUnix = (sub as unknown as { current_period_end?: number })
                .current_period_end
            const cancelAtUnix = (sub as unknown as { cancel_at?: number | null }).cancel_at
            const latestInvoice = sub.latest_invoice as Stripe.Invoice | null
            stripeSubscription = {
                status: sub.status,
                cadence,
                currentPeriodEnd: periodEndUnix
                    ? new Date(periodEndUnix * 1000).toISOString()
                    : null,
                cancelAt: cancelAtUnix ? new Date(cancelAtUnix * 1000).toISOString() : null,
                latestInvoiceUrl: latestInvoice?.hosted_invoice_url ?? null,
            }
        } catch {
            // Stripe outage — show the doc-level fields without
            // enrichment.
        }
    }

    return { ...row, members, auditLog, stripeSubscription }
}

export interface FunnelStep {
    label: string
    count: number
    pct: number
}

export interface FunnelData {
    title: string
    description: string
    steps: FunnelStep[]
}

export function computeOnboardingFunnel(rows: WorkspaceRow[]): FunnelData {
    const total = rows.length
    const created = total
    const firstContact = rows.filter((r) => r.firsts.contactCreatedAt).length
    const firstDeal = rows.filter((r) => r.firsts.dealCreatedAt).length
    const firstEmail = rows.filter((r) => r.firsts.emailSentAt).length
    const firstAutomation = rows.filter((r) => r.firsts.automationCreatedAt).length
    const paid = rows.filter((r) => r.plan !== "free").length

    const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)

    return {
        title: "Onboarding funnel",
        description: "Cumulative — % of all workspaces that reached this milestone, ever.",
        steps: [
            { label: "Workspace created", count: created, pct: pct(created) },
            { label: "First contact created", count: firstContact, pct: pct(firstContact) },
            { label: "First deal created", count: firstDeal, pct: pct(firstDeal) },
            { label: "First email sent", count: firstEmail, pct: pct(firstEmail) },
            {
                label: "First automation created",
                count: firstAutomation,
                pct: pct(firstAutomation),
            },
            { label: "Upgraded to paid", count: paid, pct: pct(paid) },
        ],
    }
}

export interface CohortRow {
    cohort: string
    workspaces: number
    paid: number
    conversionPct: number
}

/**
 * Group workspaces by signup week (Monday-based ISO week) and report
 * how many converted to paid. Useful for spotting onboarding flow
 * changes that move the needle.
 */
export function computeSignupCohorts(rows: WorkspaceRow[]): CohortRow[] {
    const buckets = new Map<string, { workspaces: number; paid: number }>()
    for (const row of rows) {
        if (!row.createdAt) continue
        const d = new Date(row.createdAt)
        const weekKey = isoWeekKey(d)
        const b = buckets.get(weekKey) ?? { workspaces: 0, paid: 0 }
        b.workspaces++
        if (row.plan !== "free") b.paid++
        buckets.set(weekKey, b)
    }
    return Array.from(buckets.entries())
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .slice(0, 12)
        .map(([cohort, b]) => ({
            cohort,
            workspaces: b.workspaces,
            paid: b.paid,
            conversionPct: b.workspaces > 0 ? (b.paid / b.workspaces) * 100 : 0,
        }))
}

function isoWeekKey(d: Date): string {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`
}

export function computePlanDistribution(rows: WorkspaceRow[]) {
    const dist: Record<PlanTier, { count: number; mrrCents: number }> = {
        free: { count: 0, mrrCents: 0 },
        pro: { count: 0, mrrCents: 0 },
        max: { count: 0, mrrCents: 0 },
    }
    for (const row of rows) {
        dist[row.plan].count++
        dist[row.plan].mrrCents += row.monthlyRevenueCents
    }
    return dist
}
