"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"

export async function getRevenueForecast(pipelineId: string, months: number = 6) {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Unauthorized" }

    try {
        // Get stages with probabilities
        const stagesSnap = await adminDb.collection("pipelines").doc(pipelineId).collection("stages").orderBy("order", "asc").get()
        const stages = stagesSnap.docs.map(s => ({
            id: s.id,
            name: s.data().name || "",
            probability: s.data().probability ?? 0,
            order: s.data().order || 0,
        }))

        const stageIds = new Set(stages.map(s => s.id))
        const stageMap = new Map(stages.map(s => [s.id, s]))

        // Closed stage names
        const closedNames = new Set(["Booked", "Closed", "Signed", "Closed Won", "Lost", "Abandoned", "Current Tenant"])

        // Get pipeline opps
        const oppsSnap = await adminDb.collection("opportunities").get()
        const opps = oppsSnap.docs
            .filter(d => stageIds.has(d.data().pipelineStageId))
            .map(d => {
                const data = d.data()
                const toDate = (v: any): Date | null => {
                    if (!v) return null
                    if (v.toDate) return v.toDate()
                    if (v instanceof Date) return v
                    if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? null : d }
                    return null
                }
                return {
                    value: Number(data.opportunityValue) || 0,
                    stageId: data.pipelineStageId || "",
                    status: (data.status as string) || "open",
                    startDate: toDate(data.stayStartDate),
                    createdAt: toDate(data.createdAt),
                }
            })

        // By-stage breakdown
        const byStage = stages.map(stage => {
            const stageOpps = opps.filter(o => o.stageId === stage.id)
            const rawValue = stageOpps.reduce((sum, o) => sum + o.value, 0)
            const isClosed = closedNames.has(stage.name)
            // Count deals by status for this stage
            const closedWonOpps = stageOpps.filter(o => o.status === "closed_won")
            const openOpps = stageOpps.filter(o => o.status === "open")
            const closedWonValue = closedWonOpps.reduce((sum, o) => sum + o.value, 0)
            const openValue = openOpps.reduce((sum, o) => sum + o.value, 0)
            return {
                stageName: stage.name,
                probability: stage.probability,
                dealCount: stageOpps.length,
                rawValue,
                weightedValue: isClosed ? rawValue : (closedWonValue + Math.round(openValue * (stage.probability / 100))),
            }
        })

        const weightedPipelineValue = byStage.reduce((sum, s) => sum + s.weightedValue, 0)

        // Monthly forecast
        const now = new Date()
        const forecastByMonth: { month: string; expected: number; bestCase: number; worstCase: number }[] = []

        for (let i = 0; i < months; i++) {
            const mStart = new Date(now.getFullYear(), now.getMonth() + i, 1)
            const mEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0, 23, 59, 59)
            const label = mStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" })

            let expected = 0, bestCase = 0, worstCase = 0

            for (const opp of opps) {
                const stage = stageMap.get(opp.stageId)
                if (!stage || closedNames.has(stage.name)) continue

                // Use startDate as expected close date, or distribute evenly
                const closeDate = opp.startDate || opp.createdAt
                if (closeDate && closeDate >= mStart && closeDate <= mEnd) {
                    expected += opp.value * (stage.probability / 100)
                    bestCase += opp.value
                    if (stage.probability >= 80) worstCase += opp.value
                }
            }

            forecastByMonth.push({
                month: label,
                expected: Math.round(expected),
                bestCase: Math.round(bestCase),
                worstCase: Math.round(worstCase),
            })
        }

        return {
            success: true,
            data: {
                weightedPipelineValue,
                forecastByMonth,
                byStage,
            },
        }
    } catch (error) {
        console.error("Failed to get revenue forecast:", error)
        return { success: false, error: "Failed to get forecast" }
    }
}
