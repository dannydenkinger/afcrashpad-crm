/**
 * Cached Firestore queries shared across server actions.
 * These queries are called by dashboard, pipeline, contacts, and other pages.
 * Caching them avoids redundant Firestore reads within warm serverless instances.
 *
 * All cached queries are workspace-scoped — cache keys are namespaced by
 * workspaceId so tenant data never leaks across workspaces.
 *
 * React cache() provides request-level deduplication on top of the TTL-based
 * server cache — if the same function is called multiple times within a single
 * server request, React deduplicates it to a single call.
 */

import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { cached, invalidateCache } from "@/lib/server-cache"
import { cache } from "react"

// ── Pipelines + Stages (read by dashboard, pipeline, contacts, leaderboard) ──

export interface CachedStage {
    id: string
    name: string
    order: number
    probability?: number
    /** "manual" (default) — use `probability` as-is.
     *  "smart" — weighted forecast should derive from historical conversion. */
    probabilityMode?: "manual" | "smart"
    /** Days a deal can sit in this stage before being flagged stale.
     *  null/undefined/0 means never flag. */
    stalenessThresholdDays?: number | null
}

export interface CachedPipeline {
    id: string
    name: string
    stages: CachedStage[]
}

export const getCachedPipelines = cache(async (workspaceId: string): Promise<CachedPipeline[]> => {
    return cached(`${workspaceId}:pipelines`, async () => {
        const db = tenantDb(workspaceId)
        const pipelinesSnap = await db.collection('pipelines').orderBy('createdAt', 'asc').get()
        const stageSnapshots = await Promise.all(
            pipelinesSnap.docs.map(doc =>
                adminDb.collection('pipelines').doc(doc.id).collection('stages').orderBy('order', 'asc').get()
            )
        )
        return pipelinesSnap.docs.map((doc, idx) => ({
            id: doc.id,
            name: doc.data().name,
            stages: stageSnapshots[idx].docs.map(sDoc => ({
                id: sDoc.id,
                name: sDoc.data().name,
                order: sDoc.data().order,
                probability: sDoc.data().probability,
                probabilityMode: sDoc.data().probabilityMode === "smart" ? "smart" : "manual",
                stalenessThresholdDays: typeof sDoc.data().stalenessThresholdDays === "number"
                    ? sDoc.data().stalenessThresholdDays
                    : null,
            })),
        }))
    }, 60_000) // 60s TTL — pipelines rarely change
})

/** Flat map of stageId → { pipelineId, stageName, probability, probabilityMode } */
export const getCachedStageMap = cache(async (workspaceId: string): Promise<Record<string, { pipelineId: string; name: string; order: number; probability: number; probabilityMode: "manual" | "smart" }>> => {
    return cached(`${workspaceId}:stageMap`, async () => {
        const pipelines = await getCachedPipelines(workspaceId)
        const map: Record<string, { pipelineId: string; name: string; order: number; probability: number; probabilityMode: "manual" | "smart" }> = {}
        for (const p of pipelines) {
            for (const s of p.stages) {
                map[s.id] = {
                    pipelineId: p.id,
                    name: s.name,
                    order: s.order,
                    probability: s.probability ?? 0,
                    probabilityMode: s.probabilityMode || "manual",
                }
            }
        }
        return map
    }, 60_000)
})

// ── Workspace Users (read by pipeline, dashboard, leaderboard, settings) ──

export interface CachedUser {
    id: string
    name?: string
    email?: string
    role?: string
    imageUrl?: string
}

export const getCachedUsers = cache(async (workspaceId: string): Promise<CachedUser[]> => {
    return cached(`${workspaceId}:users`, async () => {
        // Get workspace members
        const membersSnap = await adminDb.collection("workspace_members")
            .where("workspaceId", "==", workspaceId)
            .where("status", "==", "active")
            .get()

        if (membersSnap.empty) return []

        // Batch-fetch user documents
        const userRefs = membersSnap.docs.map(d =>
            adminDb.collection("users").doc(d.data().userId)
        )
        const userDocs = await adminDb.getAll(...userRefs)

        // Build user list with workspace role
        const memberRoles = new Map(
            membersSnap.docs.map(d => [d.data().userId, d.data().role])
        )

        return userDocs
            .filter(d => d.exists)
            .map(d => ({
                id: d.id,
                name: d.data()?.name,
                email: d.data()?.email,
                role: memberRoles.get(d.id) || "AGENT",
                imageUrl: d.data()?.profileImageUrl,
            } as CachedUser))
    }, 60_000) // 60s TTL
})

// ── Stage name map (read by contacts to label opportunities) ──

export const getCachedStageNames = cache(async (workspaceId: string): Promise<Record<string, string>> => {
    return cached(`${workspaceId}:stageNames`, async () => {
        const pipelines = await getCachedPipelines(workspaceId)
        const map: Record<string, string> = {}
        for (const p of pipelines) {
            for (const s of p.stages) {
                map[s.id] = s.name
            }
        }
        return map
    }, 60_000)
})

// ── Invalidation helpers (call after mutations) ──

export function invalidatePipelinesCache(workspaceId: string) {
    invalidateCache(`${workspaceId}:pipelines`)
    invalidateCache(`${workspaceId}:stageMap`)
    invalidateCache(`${workspaceId}:stageNames`)
}

export function invalidateUsersCache(workspaceId: string) {
    invalidateCache(`${workspaceId}:users`)
}
