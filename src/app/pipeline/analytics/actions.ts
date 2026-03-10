"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"

interface StageMetric {
    stageId: string
    stageName: string
    count: number
    value: number
    avgTimeInStage: number | null
    conversionToNext: number | null
}

interface ConversionData {
    stages: StageMetric[]
    winRate: number
    lossRate: number
    avgDealCycleDays: number | null
    totalWonValue: number
    totalLostValue: number
    totalDeals: number
}

const CLOSED_WON_NAMES = new Set(["Booked", "Closed", "Signed", "Closed Won", "Current Tenant"])
const CLOSED_LOST_NAMES = new Set(["Lost", "Abandoned"])

export async function getPipelineConversionMetrics(pipelineId: string): Promise<{ success: boolean; data?: ConversionData; error?: string }> {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Unauthorized" }

    try {
        // Get stages in order
        const stagesSnap = await adminDb.collection("pipelines").doc(pipelineId).collection("stages").orderBy("order", "asc").get()
        const stages = stagesSnap.docs.map(s => ({
            id: s.id,
            name: s.data().name || "",
            order: s.data().order || 0,
        }))

        const stageIds = new Set(stages.map(s => s.id))

        // Get all opps for this pipeline
        const oppsSnap = await adminDb.collection("opportunities").get()
        const pipelineOpps = oppsSnap.docs
            .filter(d => stageIds.has(d.data().pipelineStageId))
            .map(d => {
                const data = d.data()
                const toTs = (v: any) => {
                    if (!v) return null
                    if (v.toDate) return v.toDate().getTime()
                    if (v instanceof Date) return v.getTime()
                    if (typeof v === "string") return new Date(v).getTime()
                    return null
                }
                return {
                    id: d.id,
                    stageId: data.pipelineStageId || "",
                    status: (data.status as string) || "open",
                    value: Number(data.opportunityValue) || 0,
                    createdAt: toTs(data.createdAt),
                    updatedAt: toTs(data.updatedAt),
                    stageHistory: Array.isArray(data.stageHistory) ? data.stageHistory : [],
                }
            })

        // Count per stage
        const stageCounts: Record<string, { count: number; value: number; timeInStageDays: number[] }> = {}
        stages.forEach(s => { stageCounts[s.id] = { count: 0, value: 0, timeInStageDays: [] } })

        let wonCount = 0, lostCount = 0, wonValue = 0, lostValue = 0
        const cycleDays: number[] = []

        for (const opp of pipelineOpps) {
            if (stageCounts[opp.stageId]) {
                stageCounts[opp.stageId].count++
                stageCounts[opp.stageId].value += opp.value
            }

            const stageName = stages.find(s => s.id === opp.stageId)?.name || ""
            if (opp.status === "closed_won" || CLOSED_WON_NAMES.has(stageName)) {
                wonCount++
                wonValue += opp.value
                if (opp.createdAt && opp.updatedAt) {
                    cycleDays.push((opp.updatedAt - opp.createdAt) / 86400000)
                }
            } else if (opp.status === "closed_lost" || CLOSED_LOST_NAMES.has(stageName)) {
                lostCount++
                lostValue += opp.value
            }

            // Calculate time in current stage from stageHistory
            if (opp.stageHistory.length > 0) {
                const lastEntry = opp.stageHistory[opp.stageHistory.length - 1]
                const enteredAt = lastEntry.enteredAt?.toDate
                    ? lastEntry.enteredAt.toDate().getTime()
                    : typeof lastEntry.enteredAt === "string"
                        ? new Date(lastEntry.enteredAt).getTime()
                        : null
                if (enteredAt && stageCounts[opp.stageId]) {
                    stageCounts[opp.stageId].timeInStageDays.push((Date.now() - enteredAt) / 86400000)
                }
            }
        }

        // Build stage metrics with conversion rates
        const stageMetrics: StageMetric[] = stages.map((stage, idx) => {
            const sc = stageCounts[stage.id]
            const nextStage = stages[idx + 1]
            let conversionToNext: number | null = null

            if (nextStage && sc.count > 0) {
                // Count opps that have been in this stage AND moved to later stages
                let movedForward = 0
                for (const opp of pipelineOpps) {
                    const currentOrder = stages.find(s => s.id === opp.stageId)?.order ?? -1
                    if (currentOrder > stage.order) {
                        // Check if opp was ever in this stage via stageHistory
                        const wasInStage = opp.stageHistory.some((h: any) => h.stageId === stage.id)
                        if (wasInStage) movedForward++
                    }
                }
                // If no history data, use simple ratio of later stages vs current+later
                if (movedForward === 0 && sc.count > 0) {
                    const laterCount = stages.slice(idx + 1).reduce((sum, s) => sum + (stageCounts[s.id]?.count || 0), 0)
                    conversionToNext = sc.count + laterCount > 0
                        ? Math.round((laterCount / (sc.count + laterCount)) * 100)
                        : null
                } else if (sc.count > 0) {
                    conversionToNext = Math.round((movedForward / (movedForward + sc.count)) * 100)
                }
            }

            const avgTime = sc.timeInStageDays.length > 0
                ? Math.round(sc.timeInStageDays.reduce((a, b) => a + b, 0) / sc.timeInStageDays.length * 10) / 10
                : null

            return {
                stageId: stage.id,
                stageName: stage.name,
                count: sc.count,
                value: sc.value,
                avgTimeInStage: avgTime,
                conversionToNext,
            }
        })

        const totalClosed = wonCount + lostCount

        return {
            success: true,
            data: {
                stages: stageMetrics,
                winRate: totalClosed > 0 ? Math.round((wonCount / totalClosed) * 1000) / 10 : 0,
                lossRate: totalClosed > 0 ? Math.round((lostCount / totalClosed) * 1000) / 10 : 0,
                avgDealCycleDays: cycleDays.length > 0 ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : null,
                totalWonValue: wonValue,
                totalLostValue: lostValue,
                totalDeals: pipelineOpps.length,
            },
        }
    } catch (error) {
        console.error("Failed to get conversion metrics:", error)
        return { success: false, error: "Failed to get metrics" }
    }
}
