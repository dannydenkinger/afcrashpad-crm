/**
 * Cached Firestore queries shared across server actions.
 * These queries are called by dashboard, pipeline, contacts, and other pages.
 * Caching them avoids redundant Firestore reads within warm serverless instances.
 *
 * React cache() provides request-level deduplication on top of the TTL-based
 * server cache — if the same function is called multiple times within a single
 * server request, React deduplicates it to a single call.
 */

import { adminDb } from "@/lib/firebase-admin"
import { cached, invalidateCache } from "@/lib/server-cache"
import { cache } from "react"

// ── Pipelines + Stages (read by dashboard, pipeline, contacts, leaderboard) ──

export interface CachedStage {
    id: string
    name: string
    order: number
    probability?: number
}

export interface CachedPipeline {
    id: string
    name: string
    stages: CachedStage[]
}

export const getCachedPipelines = cache(async (): Promise<CachedPipeline[]> => {
    return cached("pipelines", async () => {
        const pipelinesSnap = await adminDb.collection('pipelines').orderBy('createdAt', 'asc').get()
        const stageSnapshots = await Promise.all(
            pipelinesSnap.docs.map(doc => doc.ref.collection('stages').orderBy('order', 'asc').get())
        )
        return pipelinesSnap.docs.map((doc, idx) => ({
            id: doc.id,
            name: doc.data().name,
            stages: stageSnapshots[idx].docs.map(sDoc => ({
                id: sDoc.id,
                name: sDoc.data().name,
                order: sDoc.data().order,
                probability: sDoc.data().probability,
            })),
        }))
    }, 60_000) // 60s TTL — pipelines rarely change
})

/** Flat map of stageId → { pipelineId, stageName } */
export const getCachedStageMap = cache(async (): Promise<Record<string, { pipelineId: string; name: string; order: number; probability: number }>> => {
    return cached("stageMap", async () => {
        const pipelines = await getCachedPipelines()
        const map: Record<string, { pipelineId: string; name: string; order: number; probability: number }> = {}
        for (const p of pipelines) {
            for (const s of p.stages) {
                map[s.id] = { pipelineId: p.id, name: s.name, order: s.order, probability: s.probability ?? 0 }
            }
        }
        return map
    }, 60_000)
})

// ── Users (read by pipeline, dashboard, leaderboard, settings) ──

export interface CachedUser {
    id: string
    name?: string
    email?: string
    role?: string
    imageUrl?: string
}

export const getCachedUsers = cache(async (): Promise<CachedUser[]> => {
    return cached("users", async () => {
        const snap = await adminDb.collection('users').get()
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CachedUser))
    }, 60_000) // 60s TTL
})

// ── Stage name map (read by contacts to label opportunities) ──

export const getCachedStageNames = cache(async (): Promise<Record<string, string>> => {
    return cached("stageNames", async () => {
        const pipelines = await getCachedPipelines()
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

export function invalidatePipelinesCache() {
    invalidateCache("pipelines")
    invalidateCache("stageMap")
    invalidateCache("stageNames")
}

export function invalidateUsersCache() {
    invalidateCache("users")
}
