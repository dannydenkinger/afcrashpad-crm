"use server"

import { tenantDb } from "@/lib/tenant-db"
import { revalidatePath } from "next/cache"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"
import { invalidatePipelinesCache } from "@/lib/cached-queries"
import type { PipelinePrioritySettings } from "./types"

const DEFAULT_URGENT_DAYS = 14
const DEFAULT_SOON_DAYS = 30

export async function getPipelinePrioritySettings(): Promise<{ success: boolean; settings?: PipelinePrioritySettings }> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const doc = await db.settingsDoc("pipeline").get()
        const data = doc.data()
        return {
            success: true,
            settings: {
                urgentDays: typeof data?.priorityUrgentDays === "number" ? data.priorityUrgentDays : DEFAULT_URGENT_DAYS,
                soonDays: typeof data?.prioritySoonDays === "number" ? data.prioritySoonDays : DEFAULT_SOON_DAYS,
            },
        }
    } catch (error) {
        console.error("Failed to fetch pipeline priority settings:", error)
        return {
            success: true,
            settings: { urgentDays: DEFAULT_URGENT_DAYS, soonDays: DEFAULT_SOON_DAYS },
        }
    }
}

// ── Stage probabilities (manual + smart) ────────────────────────────────────

export interface StageProbabilityRow {
    pipelineId: string
    pipelineName: string
    stageId: string
    stageName: string
    order: number
    /** Saved manual probability (0-100). Always present; defaults to 0. */
    manualProbability: number
    /** "manual" uses manualProbability as-is. "smart" uses smartProbability
     *  iff sampleSize >= SMART_PROBABILITY_MIN_SAMPLES, otherwise the dashboard
     *  silently falls back to manualProbability. Default: "manual". */
    mode: "manual" | "smart"
    /** Computed from historical opportunities — % of deals that ever entered
     *  this stage and eventually reached a "won" stage (Closed Won/Booked/etc).
     *  Null when there's no data at all. */
    smartProbability: number | null
    /** Number of historical opportunities used to compute smartProbability. */
    sampleSize: number
}

const WON_STAGE_NAMES = new Set(["Closed Won", "Won", "Booked", "Signed", "Closed"])

/**
 * Returns every stage across every pipeline with its manual probability,
 * mode, and a freshly-computed smart probability + sample size derived from
 * historical opportunity stage history. Used by the settings editor.
 */
export async function getStageProbabilities(): Promise<{ success: boolean; rows?: StageProbabilityRow[]; error?: string }> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const pipelinesSnap = await db.collection("pipelines").orderBy("createdAt", "asc").get()

        // Load all stages first so we have the won-stage IDs for analytics.
        type StageInfo = { pipelineId: string; pipelineName: string; stageId: string; stageName: string; order: number; manualProbability: number; mode: "manual" | "smart" }
        const stages: StageInfo[] = []
        for (const pDoc of pipelinesSnap.docs) {
            const pName = (pDoc.data().name as string) || "Pipeline"
            const stagesSnap = await db.subcollection("pipelines", pDoc.id, "stages").orderBy("order", "asc").get()
            for (const sDoc of stagesSnap.docs) {
                const sd = sDoc.data()
                stages.push({
                    pipelineId: pDoc.id,
                    pipelineName: pName,
                    stageId: sDoc.id,
                    stageName: (sd.name as string) || "Stage",
                    order: typeof sd.order === "number" ? sd.order : 0,
                    manualProbability: typeof sd.probability === "number" ? sd.probability : 0,
                    mode: sd.probabilityMode === "smart" ? "smart" : "manual",
                })
            }
        }

        const wonStageIds = new Set(stages.filter(s => WON_STAGE_NAMES.has(s.stageName)).map(s => s.stageId))

        // Load opportunities once for analytics.
        const oppsSnap = await db.collection("opportunities").get()

        // For each stage, count: how many deals ever entered it (sampleSize),
        // and of those, how many eventually landed in a won stage (wins).
        const samples: Record<string, { entered: number; wins: number }> = {}
        for (const sDoc of oppsSnap.docs) {
            const od = sDoc.data()
            const history = Array.isArray(od.stageHistory) ? od.stageHistory : []
            const enteredStageIds = new Set<string>()
            for (const h of history) {
                if (h && typeof h.stageId === "string") enteredStageIds.add(h.stageId)
            }
            // Also include the deal's current stage (covers deals created before
            // stageHistory was being recorded reliably).
            if (typeof od.pipelineStageId === "string") enteredStageIds.add(od.pipelineStageId)

            const finalStageId = (od.pipelineStageId as string) || ""
            const finalStatus = (od.status as string) || "open"
            const isWon = finalStatus === "closed_won" || wonStageIds.has(finalStageId)

            for (const sid of enteredStageIds) {
                if (!samples[sid]) samples[sid] = { entered: 0, wins: 0 }
                samples[sid].entered++
                if (isWon) samples[sid].wins++
            }
        }

        const rows: StageProbabilityRow[] = stages.map(s => {
            const sample = samples[s.stageId] || { entered: 0, wins: 0 }
            const smart = sample.entered > 0
                ? Math.round((sample.wins / sample.entered) * 1000) / 10
                : null
            return {
                pipelineId: s.pipelineId,
                pipelineName: s.pipelineName,
                stageId: s.stageId,
                stageName: s.stageName,
                order: s.order,
                manualProbability: s.manualProbability,
                mode: s.mode,
                smartProbability: smart,
                sampleSize: sample.entered,
            }
        })

        return { success: true, rows }
    } catch (error) {
        console.error("Failed to load stage probabilities:", error)
        return { success: false, error: "Failed to load probabilities" }
    }
}

// ── Stage management: ordering + staleness threshold ──────────────────────

export interface StageManagementRow {
    pipelineId: string
    pipelineName: string
    stageId: string
    stageName: string
    order: number
    /** Days a deal can sit in this stage before being flagged "stale".
     *  null/0 means never flag. */
    stalenessThresholdDays: number | null
}

export async function getStageManagement(): Promise<{ success: boolean; rows?: StageManagementRow[]; error?: string }> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const pipelinesSnap = await db.collection("pipelines").orderBy("createdAt", "asc").get()
        const rows: StageManagementRow[] = []
        for (const pDoc of pipelinesSnap.docs) {
            const pName = (pDoc.data().name as string) || "Pipeline"
            const stagesSnap = await db.subcollection("pipelines", pDoc.id, "stages").orderBy("order", "asc").get()
            for (const sDoc of stagesSnap.docs) {
                const sd = sDoc.data()
                rows.push({
                    pipelineId: pDoc.id,
                    pipelineName: pName,
                    stageId: sDoc.id,
                    stageName: (sd.name as string) || "Stage",
                    order: typeof sd.order === "number" ? sd.order : 0,
                    stalenessThresholdDays: typeof sd.stalenessThresholdDays === "number" ? sd.stalenessThresholdDays : null,
                })
            }
        }
        return { success: true, rows }
    } catch (error) {
        console.error("Failed to load stage management:", error)
        return { success: false, error: "Failed to load stages" }
    }
}

export async function updateStageStaleness(pipelineId: string, stageId: string, days: number | null) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    const value = days === null || days === 0 ? null : Math.max(0, Math.floor(days))
    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)
        await db.subcollection("pipelines", pipelineId, "stages").doc(stageId).update({
            stalenessThresholdDays: value,
        })
        invalidatePipelinesCache(workspaceId)
        revalidatePath("/settings")
        revalidatePath("/pipeline")
        return { success: true }
    } catch (error) {
        console.error("Failed to update stage staleness:", error)
        return { success: false, error: "Failed to save" }
    }
}

/**
 * Reorder a stage relative to its siblings. Pass the full ordered array
 * of stage IDs as they should appear after the move; this function
 * rewrites the `order` field on every stage to match. Doing it in one
 * batch avoids the alternative — incremental swaps — that can leave
 * stages with duplicate orders if two clicks race.
 */
export async function reorderStages(pipelineId: string, orderedStageIds: string[]) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)
        await Promise.all(
            orderedStageIds.map((stageId, idx) =>
                db.subcollection("pipelines", pipelineId, "stages").doc(stageId).update({ order: idx })
            )
        )
        invalidatePipelinesCache(workspaceId)
        revalidatePath("/settings")
        revalidatePath("/pipeline")
        return { success: true }
    } catch (error) {
        console.error("Failed to reorder stages:", error)
        return { success: false, error: "Failed to reorder" }
    }
}

export async function updateStageProbability(
    pipelineId: string,
    stageId: string,
    updates: { probability?: number; mode?: "manual" | "smart" }
) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    const patch: Record<string, unknown> = {}
    if (typeof updates.probability === "number") {
        patch.probability = Math.max(0, Math.min(100, Math.round(updates.probability)))
    }
    if (updates.mode === "manual" || updates.mode === "smart") {
        patch.probabilityMode = updates.mode
    }
    if (Object.keys(patch).length === 0) return { success: true }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)
        await db.subcollection("pipelines", pipelineId, "stages").doc(stageId).update(patch)
        invalidatePipelinesCache(workspaceId)
        revalidatePath("/settings")
        revalidatePath("/dashboard")
        return { success: true }
    } catch (error) {
        console.error("Failed to update stage probability:", error)
        return { success: false, error: "Failed to save" }
    }
}

export async function updatePipelinePrioritySettings(settings: PipelinePrioritySettings) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    const urgentDays = Math.max(0, Math.floor(Number(settings.urgentDays)) || DEFAULT_URGENT_DAYS)
    const soonDays = Math.max(urgentDays, Math.floor(Number(settings.soonDays)) || DEFAULT_SOON_DAYS)

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.settingsDoc("pipeline").set(
            { priorityUrgentDays: urgentDays, prioritySoonDays: soonDays, updatedAt: new Date() },
            { merge: true }
        )
        revalidatePath("/settings")
        revalidatePath("/pipeline")
        return { success: true }
    } catch (error) {
        console.error("Failed to update pipeline priority settings:", error)
        return { success: false, error: "Failed to save settings" }
    }
}
