"use server"

import { tenantDb } from "@/lib/tenant-db"
import { getAuthSession } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import type { LeaderboardAgent, LeaderboardData, DashboardData, ActivityItem } from "./types"
import { getCachedPipelines, getCachedStageMap, getCachedUsers } from "@/lib/cached-queries"
import { SMART_PROBABILITY_MIN_SAMPLES } from "@/app/settings/pipeline/types"

const STAGE_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4']
const BASE_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4']
function formatShortDate(d: Date): string {
    return `${d.getMonth() + 1}/${d.getDate()}`
}

export async function getDashboardData(startDate?: string, endDate?: string): Promise<{ success: boolean; data?: DashboardData; error?: string }> {
    const session = await getAuthSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }
    if (!session.user.workspaceId) return { success: false, error: "No workspace selected" }

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    // Parse date range filter
    const rangeStart = startDate ? new Date(startDate + 'T00:00:00') : null
    const rangeEnd = endDate ? new Date(endDate + 'T23:59:59.999') : null

    try {
        // Use cached pipelines/stages/users to avoid redundant Firestore reads
        const [cachedPipelines, cachedStageMapData, oppsSnap, contactsSnap, tasksSnap, cachedUsersData] = await Promise.all([
            getCachedPipelines(workspaceId),
            getCachedStageMap(workspaceId),
            db.collection('opportunities').get(),
            db.collection('contacts').get(),
            db.collection('tasks').orderBy('dueDate', 'asc').get(),
            getCachedUsers(workspaceId),
        ])

        // Build maps from cached data
        const pipelinesList = cachedPipelines.map(p => ({ id: p.id, name: p.name }))
        const stageMap: Record<string, { pipelineId: string; name: string; order: number }> = {}
        const stageManualProbMap: Record<string, number> = {}
        const stageProbModeMap: Record<string, "manual" | "smart"> = {}
        for (const [id, info] of Object.entries(cachedStageMapData)) {
            stageMap[id] = { pipelineId: info.pipelineId, name: info.name, order: info.order }
            stageManualProbMap[id] = info.probability
            stageProbModeMap[id] = info.probabilityMode
        }

        // Build users snapshot equivalent from cache
        const usersSnap = { docs: cachedUsersData.map(u => ({ id: u.id, data: () => u })) }

        // Determine closed/booked stage IDs
        const closedNames = new Set(['Booked', 'Closed', 'Signed', 'Closed Won', 'Lost', 'Abandoned'])
        const closedStageIds = new Set(
            Object.entries(stageMap)
                .filter(([, info]) => closedNames.has(info.name))
                .map(([id]) => id)
        )
        const bookedNames = new Set(['Booked', 'Closed', 'Signed', 'Closed Won'])
        const bookedStageIds = new Set(
            Object.entries(stageMap)
                .filter(([, info]) => bookedNames.has(info.name))
                .map(([id]) => id)
        )

        // Compute smart probabilities from historical opportunities. For each
        // stage, count how many deals ever entered it and what fraction reached
        // a booked stage. We require SMART_PROBABILITY_MIN_SAMPLES historical
        // deals before trusting the smart number — below that we silently fall
        // back to the manual % (the editor surfaces the warning to the user).
        const stageSamples: Record<string, { entered: number; wins: number }> = {}
        for (const sDoc of oppsSnap.docs) {
            const od = sDoc.data()
            const history = Array.isArray(od.stageHistory) ? od.stageHistory : []
            const enteredStageIds = new Set<string>()
            for (const h of history) {
                if (h && typeof h.stageId === "string") enteredStageIds.add(h.stageId)
            }
            if (typeof od.pipelineStageId === "string") enteredStageIds.add(od.pipelineStageId)

            const finalStageId = (od.pipelineStageId as string) || ''
            const finalStatus = (od.status as string) || 'open'
            const isWon = finalStatus === 'closed_won' || bookedStageIds.has(finalStageId)

            for (const sid of enteredStageIds) {
                if (!stageSamples[sid]) stageSamples[sid] = { entered: 0, wins: 0 }
                stageSamples[sid].entered++
                if (isWon) stageSamples[sid].wins++
            }
        }

        // Effective probability per stage = smart if mode=smart and enough
        // samples; otherwise the saved manual %.
        const stageProbMap: Record<string, number> = {}
        for (const [id, manualProb] of Object.entries(stageManualProbMap)) {
            const mode = stageProbModeMap[id] || 'manual'
            const sample = stageSamples[id]
            if (mode === 'smart' && sample && sample.entered >= SMART_PROBABILITY_MIN_SAMPLES) {
                stageProbMap[id] = (sample.wins / sample.entered) * 100
            } else {
                stageProbMap[id] = manualProb
            }
        }

        // Helper to convert Firestore timestamps to Date
        const toDate = (v: unknown): Date => {
            if (v && typeof v === 'object' && 'toDate' in v && typeof (v as any).toDate === 'function') return (v as any).toDate()
            if (v instanceof Date) return v
            if (typeof v === 'string') return new Date(v)
            if (v && typeof v === 'object' && '_seconds' in v && typeof (v as any)._seconds === 'number') return new Date((v as any)._seconds * 1000)
            return new Date()
        }

        // Contact base map for fallback (deal base falls back to its contact's militaryBase)
        const contactBaseMap: Record<string, string> = {}
        contactsSnap.docs.forEach(doc => {
            const base = doc.data().militaryBase
            if (base) contactBaseMap[doc.id] = base
        })

        // Process opportunities
        const allOpps = oppsSnap.docs.map(doc => {
            const d = doc.data()
            const stageInfo = d.pipelineStageId ? stageMap[d.pipelineStageId] : undefined
            return {
                pipelineId: stageInfo?.pipelineId || null,
                stageId: (d.pipelineStageId as string) || '',
                stageName: stageInfo?.name || 'Unknown',
                status: (d.status as string) || 'open',
                value: Number(d.opportunityValue) || 0,
                militaryBase: d.militaryBase || (d.contactId ? contactBaseMap[d.contactId as string] : null) || null,
                utmSource: (d.utmSource as string) || null,
                createdAt: toDate(d.createdAt),
                estimatedProfit: Number(doc.data().estimatedProfit) || 0,
            }
        })

        // Fallback: non-open deals with no valid pipeline assignment go to the first pipeline
        const firstPipelineId = pipelinesList[0]?.id || null
        for (const opp of allOpps) {
            if (!opp.pipelineId && opp.status !== 'open' && firstPipelineId) {
                opp.pipelineId = firstPipelineId
            }
        }

        // Apply date range filter
        const opps = (rangeStart || rangeEnd)
            ? allOpps.filter(o => {
                if (rangeStart && o.createdAt < rangeStart) return false
                if (rangeEnd && o.createdAt > rangeEnd) return false
                return true
            })
            : allOpps

        // Source attribution from UTM data
        const sourceCounts: Record<string, { count: number; value: number }> = {}
        for (const opp of opps) {
            const src = opp.utmSource || "Direct / Unknown"
            if (!sourceCounts[src]) sourceCounts[src] = { count: 0, value: 0 }
            sourceCounts[src].count++
            sourceCounts[src].value += opp.value
        }
        const sourceAttribution = Object.entries(sourceCounts)
            .map(([source, data]) => ({ source, count: data.count, value: data.value }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)

        // Filter contacts by date range if specified
        const filteredContactDocs = (rangeStart || rangeEnd)
            ? contactsSnap.docs.filter(doc => {
                const ca = toDate(doc.data().createdAt)
                if (rangeStart && ca < rangeStart) return false
                if (rangeEnd && ca > rangeEnd) return false
                return true
            })
            : contactsSnap.docs

        // KPIs
        const activeStayCount = filteredContactDocs.filter(doc => doc.data().status === 'Active Stay').length
        const totalContacts = filteredContactDocs.length
        const totalPipelineValue = opps.reduce((sum, o) => sum + o.value, 0)
        const openInquiries = opps.filter(o => o.status === "open" && !closedStageIds.has(o.stageId)).length
        const bookedCount = opps.filter(o => o.status === "closed_won" || bookedStageIds.has(o.stageId)).length
        const conversionRate = opps.length > 0 ? Math.round((bookedCount / opps.length) * 1000) / 10 : 0

        // Monthly revenue
        const now2 = new Date()
        const thisMonthStart = new Date(now2.getFullYear(), now2.getMonth(), 1)
        const lastMonthStart = new Date(now2.getFullYear(), now2.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now2.getFullYear(), now2.getMonth(), 0, 23, 59, 59)

        const monthlyRevenue = opps
            .filter(o => (o.status === "closed_won" || bookedStageIds.has(o.stageId)) && o.createdAt >= thisMonthStart)
            .reduce((sum, o) => sum + o.value, 0)
        const previousMonthRevenue = opps
            .filter(o => (o.status === "closed_won" || bookedStageIds.has(o.stageId)) && o.createdAt >= lastMonthStart && o.createdAt <= lastMonthEnd)
            .reduce((sum, o) => sum + o.value, 0)
        const revenueTrend = previousMonthRevenue > 0
            ? Math.round(((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 1000) / 10
            : null

        // Lead velocity
        const thirtyDaysAgo = new Date(now2.getTime() - 30 * 86400000)
        const sixtyDaysAgo = new Date(now2.getTime() - 60 * 86400000)
        const contactsForVelocity = (rangeStart || rangeEnd) ? filteredContactDocs : contactsSnap.docs
        const leadVelocity = contactsForVelocity.filter(doc => {
            const ca = toDate(doc.data().createdAt)
            return ca >= thirtyDaysAgo
        }).length
        const previousLeadVelocity = contactsForVelocity.filter(doc => {
            const ca = toDate(doc.data().createdAt)
            return ca >= sixtyDaysAgo && ca < thirtyDaysAgo
        }).length
        const leadVelocityTrend = previousLeadVelocity > 0
            ? Math.round(((leadVelocity - previousLeadVelocity) / previousLeadVelocity) * 1000) / 10
            : null

        // Avg deal value (booked deals)
        const bookedOpps = opps.filter(o => bookedStageIds.has(o.stageId))
        const avgDealValue = bookedOpps.length > 0 ? Math.round(bookedOpps.reduce((s, o) => s + o.value, 0) / bookedOpps.length) : 0

        // Closed profit metrics
        const totalClosedProfit = opps
            .filter(o => bookedStageIds.has(o.stageId))
            .reduce((sum, o) => sum + o.estimatedProfit, 0)
        const avgProfitPerDeal = bookedCount > 0 ? Math.round(totalClosedProfit / bookedCount) : 0

        // Weighted forecast
        // Each open deal contributes value × probability to the forecast.
        // For the confidence band, we treat each deal as an independent
        // Bernoulli outcome — Var(value × X) = value² × p × (1-p) where
        // X is the close outcome (0 or 1). Summing across deals and taking
        // the square root gives a 1-σ range we can display as `± stddev`.
        // Not a hard statistical bound (deals aren't fully independent and
        // probabilities are themselves noisy), but a useful "how spread
        // out could the actual outcome be" intuition for the operator.
        const openDeals = opps.filter(o => !closedStageIds.has(o.stageId))
        let weightedForecast = 0
        let forecastVariance = 0
        for (const o of openDeals) {
            const p = (stageProbMap[o.stageId] ?? 0) / 100
            weightedForecast += o.value * p
            forecastVariance += (o.value * o.value) * p * (1 - p)
        }
        const forecastStdDev = Math.sqrt(forecastVariance)

        // Per-pipeline data
        const pipelineData: DashboardData['pipelineData'] = {}
        const now = new Date()

        for (const pipeline of pipelinesList) {
            const pipelineOpps = opps.filter(o => o.pipelineId === pipeline.id)

            // Stage distribution
            const stageOrder = Object.entries(stageMap)
                .filter(([, info]) => info.pipelineId === pipeline.id)
                .sort(([, a], [, b]) => a.order - b.order)
                .map(([, info]) => info.name)

            const stageCounts: Record<string, { count: number; value: number }> = {}
            const openPipelineOpps = pipelineOpps.filter(o => o.status === "open")
            for (const opp of openPipelineOpps) {
                if (!stageCounts[opp.stageName]) stageCounts[opp.stageName] = { count: 0, value: 0 }
                stageCounts[opp.stageName].count++
                stageCounts[opp.stageName].value += opp.value
            }

            const stageDistribution = stageOrder.map((name, i) => ({
                name,
                count: stageCounts[name]?.count || 0,
                value: stageCounts[name]?.value || 0,
                color: STAGE_COLORS[i % STAGE_COLORS.length],
            })).filter(s => s.count > 0)

            // --- Value over time ---
            const daily: { name: string; value: number }[] = []
            for (let i = 29; i >= 0; i--) {
                const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
                const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1)
                daily.push({
                    name: formatShortDate(dayStart),
                    value: pipelineOpps.filter(o => o.createdAt >= dayStart && o.createdAt < dayEnd).reduce((s, o) => s + o.value, 0),
                })
            }

            const weekly: { name: string; value: number }[] = []
            for (let i = 25; i >= 0; i--) {
                const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7)
                const weekStart = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate() - 7)
                weekly.push({
                    name: formatShortDate(weekStart),
                    value: pipelineOpps.filter(o => o.createdAt >= weekStart && o.createdAt < weekEnd).reduce((s, o) => s + o.value, 0),
                })
            }

            const monthly: { name: string; value: number }[] = []
            for (let i = 11; i >= 0; i--) {
                const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
                const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
                const label = mStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                monthly.push({
                    name: label,
                    value: pipelineOpps.filter(o => o.createdAt >= mStart && o.createdAt <= mEnd).reduce((s, o) => s + o.value, 0),
                })
            }

            // Status distribution
            const pipelineClosedNotWon = new Set(
                [...closedStageIds].filter(id => !bookedStageIds.has(id))
            )
            let openCount = 0, wonCount = 0, lostCount = 0, archivedCount = 0
            for (const opp of pipelineOpps) {
                if (opp.status === 'archive') { archivedCount++ }
                else if (opp.status === 'closed_lost') { lostCount++ }
                else if (opp.status === 'closed_won') { wonCount++ }
                else if (bookedStageIds.has(opp.stageId)) { wonCount++ }
                else if (pipelineClosedNotWon.has(opp.stageId)) { lostCount++ }
                else { openCount++ }
            }
            const statusDistribution = [
                { name: 'Open', count: openCount, color: '#3b82f6' },
                { name: 'Won', count: wonCount, color: '#10b981' },
                { name: 'Lost', count: lostCount, color: '#f43f5e' },
                { name: 'Archived', count: archivedCount, color: '#6b7280' },
            ].filter(s => s.count > 0)

            // Deals by base (top-8 military bases by deal count)
            const baseCounts: Record<string, number> = {}
            for (const opp of pipelineOpps) {
                if (opp.militaryBase) baseCounts[opp.militaryBase] = (baseCounts[opp.militaryBase] || 0) + 1
            }
            const dealsByBase = Object.entries(baseCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([name, deals], i) => ({ name, deals, color: BASE_COLORS[i % BASE_COLORS.length] }))

            pipelineData[pipeline.id] = {
                stageDistribution,
                statusDistribution,
                valueOverTime: { "1m": daily, "6m": weekly, "1y": monthly },
                dealsByBase,
                totalValue: pipelineOpps.reduce((s, o) => s + o.value, 0),
                totalDeals: pipelineOpps.length,
            }
        }

        // Tasks
        const userNames: Record<string, string> = {}
        usersSnap.docs.forEach(doc => { userNames[doc.id] = doc.data().name || 'Unknown' })

        const tasks = tasksSnap.docs.map(doc => {
            const d = doc.data()
            const due = d.dueDate?.toDate ? d.dueDate.toDate() : (d.dueDate ? new Date(d.dueDate) : null)
            return {
                id: doc.id,
                title: d.title || 'Untitled',
                assignee: d.assigneeId ? (userNames[d.assigneeId] || 'Unknown') : 'Unassigned',
                dueDate: due && !isNaN(due.getTime()) ? due.toISOString().split('T')[0] : '',
                priority: d.priority === 'HIGH' ? 'High' : d.priority === 'LOW' ? 'Low' : 'Medium',
                status: d.completed ? 'Completed' : 'Pending',
                _createdAt: toDate(d.createdAt || d.dueDate),
            }
        })
        .filter(t => {
            if (!rangeStart && !rangeEnd) return true
            const taskDate = t._createdAt
            if (rangeStart && taskDate < rangeStart) return false
            if (rangeEnd && taskDate > rangeEnd) return false
            return true
        })
        .map(({ _createdAt, ...rest }) => rest)
        .slice(0, 50)

        return {
            success: true,
            data: {
                pipelines: pipelinesList,
                kpi: {
                    activeStayCount, totalContacts, conversionRate, totalPipelineValue, openInquiries,
                    monthlyRevenue, revenueTrend,
                    leadVelocity, leadVelocityTrend, avgDealValue,
                    weightedForecast: Math.round(weightedForecast),
                    forecastStdDev: Math.round(forecastStdDev),
                    totalClosedProfit: Math.round(totalClosedProfit),
                    avgProfitPerDeal,
                },
                pipelineData,
                sourceAttribution,
                tasks,
            }
        }
    } catch (error) {
        console.error("Dashboard data error:", error)
        return { success: false, error: "Failed to fetch dashboard data" }
    }
}

/** Call this to invalidate dashboard caches after deal mutations */
export async function invalidateDashboardCache() {
    revalidatePath("/dashboard")
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

export async function getRecentActivity(): Promise<{ success: boolean; data?: ActivityItem[]; error?: string }> {
    const session = await getAuthSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }
    if (!session.user.workspaceId) return { success: false, error: "No workspace selected" }

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const activities: ActivityItem[] = []

        // Helper to convert Firestore timestamps to Date
        const toDate = (v: unknown): Date => {
            if (v && typeof v === 'object' && 'toDate' in v && typeof (v as any).toDate === 'function') return (v as any).toDate()
            if (v instanceof Date) return v
            if (typeof v === 'string') return new Date(v)
            if (v && typeof v === 'object' && '_seconds' in v && typeof (v as any)._seconds === 'number') return new Date((v as any)._seconds * 1000)
            return new Date()
        }

        // Parallelize all independent Firestore reads
        const [pipelinesSnap, oppsSnap, contactsSnap, tasksSnap] = await Promise.all([
            db.collection('pipelines').get(),
            db.collection('opportunities').orderBy('updatedAt', 'desc').limit(30).get(),
            db.collection('contacts').orderBy('createdAt', 'desc').limit(20).get(),
            db.collection('tasks').where('completed', '==', true).orderBy('updatedAt', 'desc').limit(20).get(),
        ])

        // Build stage name lookup — use subcollection helper for tenant-safe access
        const stageNameMap: Record<string, string> = {}
        await Promise.all(pipelinesSnap.docs.map(pDoc =>
            db.subcollection('pipelines', pDoc.id, 'stages').get().then(stagesSnap => {
                for (const sDoc of stagesSnap.docs) {
                    stageNameMap[sDoc.id] = sDoc.data().name || 'Unknown Stage'
                }
            })
        ))

        // 1. Recent deal stage changes
        for (const doc of oppsSnap.docs) {
            const d = doc.data()
            const history = Array.isArray(d.stageHistory) ? d.stageHistory : []
            if (history.length > 0) {
                const lastEntry = history[history.length - 1]
                const stageName = stageNameMap[lastEntry.stageId] || 'Unknown Stage'
                const enteredAt = toDate(lastEntry.enteredAt)
                const dealName = d.dealName || d.name || d.email || 'Unnamed Deal'
                activities.push({
                    id: `deal-${doc.id}-${history.length}`,
                    type: 'deal_stage_change',
                    description: `${dealName} moved to ${stageName}`,
                    timestamp: enteredAt.toISOString(),
                    linkHref: '/pipeline',
                    meta: stageName,
                })
            }
        }

        // 2. Recent contacts added
        for (const doc of contactsSnap.docs) {
            const d = doc.data()
            const name = d.name || d.email || 'Unknown Contact'
            const createdAt = toDate(d.createdAt)
            activities.push({
                id: `contact-${doc.id}`,
                type: 'contact_added',
                description: `${name} was added as a contact`,
                timestamp: createdAt.toISOString(),
                linkHref: '/contacts',
                meta: name,
            })
        }

        // 3. Recent tasks completed
        for (const doc of tasksSnap.docs) {
            const d = doc.data()
            const title = d.title || 'Untitled Task'
            const completedAt = toDate(d.updatedAt || d.createdAt)
            activities.push({
                id: `task-${doc.id}`,
                type: 'task_completed',
                description: `Task "${title}" was completed`,
                timestamp: completedAt.toISOString(),
                linkHref: '/tasks',
                meta: title,
            })
        }

        // 4. Recent communications sent
        const messageResults = await Promise.all(
            contactsSnap.docs.map(async (contactDoc) => {
                const contactName = contactDoc.data().name || contactDoc.data().email || 'Unknown'
                try {
                    const messagesSnap = await db.subcollection('contacts', contactDoc.id, 'messages')
                        .orderBy('createdAt', 'desc')
                        .limit(3)
                        .get()
                    return messagesSnap.docs.map(msgDoc => {
                        const m = msgDoc.data()
                        const sentAt = toDate(m.createdAt)
                        const direction = m.direction === 'inbound' ? 'received from' : 'sent to'
                        const channel = m.channel === 'sms' ? 'SMS' : 'Email'
                        return {
                            id: `msg-${msgDoc.id}`,
                            type: 'communication_sent' as const,
                            description: `${channel} ${direction} ${contactName}`,
                            timestamp: sentAt.toISOString(),
                            linkHref: '/communications',
                            meta: contactName,
                        }
                    })
                } catch {
                    return []
                }
            })
        )
        for (const msgs of messageResults) {
            activities.push(...msgs)
        }

        // Sort all activities by timestamp descending and take top 20
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        const top20 = activities.slice(0, 20)

        return { success: true, data: top20 }
    } catch (error) {
        console.error("Activity feed error:", error)
        return { success: false, error: "Failed to fetch activity feed" }
    }
}

// ── Hot deals + recent contacts ─────────────────────────────────────────────

export interface HotDeal {
    id: string
    name: string
    value: number
    stageName: string
    contactName: string
    contactId: string | null
}

export interface RecentContact {
    id: string
    name: string
    email: string
    phone: string
    createdAt: string // ISO
}

export async function getHotDeals(limit: number = 5): Promise<{ success: boolean; data?: HotDeal[]; error?: string }> {
    const session = await getAuthSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }
    if (!session.user.workspaceId) return { success: false, error: "No workspace selected" }

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const [cachedStageMapData, oppsSnap, contactsSnap] = await Promise.all([
            getCachedStageMap(workspaceId),
            db.collection('opportunities').get(),
            db.collection('contacts').get(),
        ])

        // Build closed stage IDs
        const closedNames = new Set(['Booked', 'Closed', 'Signed', 'Closed Won', 'Lost', 'Abandoned'])
        const closedStageIds = new Set<string>()
        for (const [id, info] of Object.entries(cachedStageMapData)) {
            if (closedNames.has(info.name)) closedStageIds.add(id)
        }

        // Build contact name lookup
        const contactNames: Record<string, string> = {}
        for (const cDoc of contactsSnap.docs) {
            const c = cDoc.data()
            contactNames[cDoc.id] = c.name || c.email || 'Unknown'
        }

        const open = oppsSnap.docs
            .map(doc => {
                const d = doc.data()
                const stageId = (d.pipelineStageId as string) || ''
                const info = cachedStageMapData[stageId]
                return {
                    id: doc.id,
                    name: (d.dealName as string) || (d.name as string) || 'Untitled deal',
                    value: Number(d.opportunityValue) || 0,
                    stageId,
                    stageName: info?.name || 'Unknown',
                    status: (d.status as string) || 'open',
                    contactId: (d.contactId as string) || null,
                }
            })
            .filter(o => o.status === 'open' && !closedStageIds.has(o.stageId))
            .sort((a, b) => b.value - a.value)
            .slice(0, limit)

        const data: HotDeal[] = open.map(o => ({
            id: o.id,
            name: o.name,
            value: o.value,
            stageName: o.stageName,
            contactId: o.contactId,
            contactName: o.contactId ? (contactNames[o.contactId] || 'Unknown') : '',
        }))

        return { success: true, data }
    } catch (error) {
        console.error("Hot deals error:", error)
        return { success: false, error: "Failed to fetch hot deals" }
    }
}

export async function getRecentContacts(limit: number = 5): Promise<{ success: boolean; data?: RecentContact[]; error?: string }> {
    const session = await getAuthSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }
    if (!session.user.workspaceId) return { success: false, error: "No workspace selected" }

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const snap = await db.collection('contacts').orderBy('createdAt', 'desc').limit(limit).get()

        const toDate = (v: unknown): Date => {
            if (v && typeof v === 'object' && 'toDate' in v && typeof (v as any).toDate === 'function') return (v as any).toDate()
            if (v instanceof Date) return v
            if (typeof v === 'string') return new Date(v)
            if (v && typeof v === 'object' && '_seconds' in v && typeof (v as any)._seconds === 'number') return new Date((v as any)._seconds * 1000)
            return new Date()
        }

        const data: RecentContact[] = snap.docs.map(doc => {
            const d = doc.data()
            return {
                id: doc.id,
                name: (d.name as string) || (d.email as string) || 'Unknown',
                email: (d.email as string) || '',
                phone: (d.phone as string) || '',
                createdAt: toDate(d.createdAt).toISOString(),
            }
        })

        return { success: true, data }
    } catch (error) {
        console.error("Recent contacts error:", error)
        return { success: false, error: "Failed to fetch recent contacts" }
    }
}

export async function getLeaderboardData(): Promise<{ success: boolean; data?: LeaderboardData; error?: string }> {
    const session = await getAuthSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }
    if (!session.user.workspaceId) return { success: false, error: "No workspace selected" }

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        // Use cached pipelines/users to avoid redundant Firestore reads
        const [cachedUsersLb, oppsSnap, cachedPipelinesLb] = await Promise.all([
            getCachedUsers(workspaceId),
            db.collection('opportunities').get(),
            getCachedPipelines(workspaceId),
        ])

        // Build stage lookup from cache — identify won stages
        const bookedNames = new Set(['Closed Won', 'Won', 'Booked', 'Signed', 'Closed', 'Lease Signed'])
        const bookedStageIds = new Set<string>()
        for (const p of cachedPipelinesLb) {
            for (const s of p.stages) {
                if (bookedNames.has(s.name)) bookedStageIds.add(s.id)
            }
        }

        // Create usersSnap-compatible structure from cache
        const usersSnap = { docs: cachedUsersLb.map(u => ({ id: u.id, data: () => u })) }

        // Calculate metrics per user
        const agentMetrics: Record<string, {
            totalDeals: number
            bookedDeals: number
            totalRevenue: number
            totalProfit: number
            claimedDeals: number
        }> = {}

        const initAgent = (id: string) => {
            if (!agentMetrics[id]) {
                agentMetrics[id] = { totalDeals: 0, bookedDeals: 0, totalRevenue: 0, totalProfit: 0, claimedDeals: 0 }
            }
        }

        oppsSnap.docs.forEach(doc => {
            const d = doc.data()
            const assigneeId = d.assigneeId as string | undefined
            const claimedBy = d.claimedBy as string | undefined
            const isBooked = bookedStageIds.has(d.pipelineStageId)
            const value = Number(d.opportunityValue) || 0
            const profit = Number(d.estimatedProfit) || 0

            if (assigneeId) {
                initAgent(assigneeId)
                agentMetrics[assigneeId].totalDeals++
                if (isBooked) {
                    agentMetrics[assigneeId].bookedDeals++
                    agentMetrics[assigneeId].totalRevenue += value
                    agentMetrics[assigneeId].totalProfit += profit
                }
            }

            if (claimedBy) {
                initAgent(claimedBy)
                agentMetrics[claimedBy].claimedDeals++
                if (claimedBy !== assigneeId) {
                    agentMetrics[claimedBy].totalDeals++
                    if (isBooked) {
                        agentMetrics[claimedBy].bookedDeals++
                        agentMetrics[claimedBy].totalRevenue += value
                        agentMetrics[claimedBy].totalProfit += profit
                    }
                }
            }
        })

        // Build agent list
        const agents: LeaderboardAgent[] = usersSnap.docs
            .map(doc => {
                const userData = doc.data()
                const metrics = agentMetrics[doc.id] || { totalDeals: 0, bookedDeals: 0, totalRevenue: 0, totalProfit: 0, claimedDeals: 0 }
                return {
                    userId: doc.id,
                    name: userData.name || 'Unknown',
                    email: userData.email || '',
                    role: userData.role || 'AGENT',
                    totalDeals: metrics.totalDeals,
                    bookedDeals: metrics.bookedDeals,
                    totalRevenue: Math.round(metrics.totalRevenue),
                    totalProfit: Math.round(metrics.totalProfit),
                    avgDealValue: metrics.bookedDeals > 0
                        ? Math.round(metrics.totalRevenue / metrics.bookedDeals)
                        : 0,
                    conversionRate: metrics.totalDeals > 0
                        ? Math.round((metrics.bookedDeals / metrics.totalDeals) * 1000) / 10
                        : 0,
                    claimedDeals: metrics.claimedDeals,
                    rank: 0,
                }
            })
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .map((agent, idx) => ({ ...agent, rank: idx + 1 }))

        return {
            success: true,
            data: { agents, totalAgents: agents.length },
        }
    } catch (error) {
        console.error("Leaderboard data error:", error)
        return { success: false, error: "Failed to fetch leaderboard data" }
    }
}
