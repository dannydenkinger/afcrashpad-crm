"use server"

import { tenantDb } from "@/lib/tenant-db"
import { requireAuth } from "@/lib/auth-guard"

/** Pipeline list for picker UIs — just {id, name}. */
export async function listPipelinesLite(): Promise<Array<{ id: string; name: string }>> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)
        const snap = await db.collection("pipelines").get()
        return snap.docs
            .map((d) => ({ id: d.id, name: (d.data().name as string) ?? d.id }))
            .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
        return []
    }
}

export interface PipelineWithStages {
    id: string
    name: string
    stages: Array<{ id: string; name: string; order: number }>
}

/** Pipelines + their stages for stage-picker UIs. */
export async function listPipelinesWithStages(): Promise<PipelineWithStages[]> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)
        const pipelinesSnap = await db.collection("pipelines").get()
        const out: PipelineWithStages[] = []
        for (const pDoc of pipelinesSnap.docs) {
            const stagesSnap = await db
                .subcollection("pipelines", pDoc.id, "stages")
                .orderBy("order", "asc")
                .get()
            out.push({
                id: pDoc.id,
                name: (pDoc.data().name as string) ?? pDoc.id,
                stages: stagesSnap.docs.map((s) => ({
                    id: s.id,
                    name: (s.data().name as string) ?? s.id,
                    order: (s.data().order as number) ?? 0,
                })),
            })
        }
        return out.sort((a, b) => a.name.localeCompare(b.name))
    } catch {
        return []
    }
}

export async function getRevenueForecast(pipelineId: string, months: number = 6) {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        // Get stages with probabilities
        const stagesSnap = await db.subcollection("pipelines", pipelineId, "stages").orderBy("order", "asc").get()
        const stages = stagesSnap.docs.map(s => ({
            id: s.id,
            name: s.data().name || "",
            probability: s.data().probability ?? 0,
            order: s.data().order || 0,
        }))

        const stageIds = new Set(stages.map(s => s.id))
        const stageMap = new Map(stages.map(s => [s.id, s]))

        // Closed stage names — covers won + lost across common CRM templates
        const closedNames = new Set(["Closed Won", "Won", "Booked", "Signed", "Closed", "Closed Lost", "Lost", "Abandoned"])

        // Get pipeline opps
        const oppsSnap = await db.collection("opportunities").get()
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
