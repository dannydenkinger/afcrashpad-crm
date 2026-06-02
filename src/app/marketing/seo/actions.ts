"use server"

import { tenantDb } from "@/lib/tenant-db"
import { requireAuth } from "@/lib/auth-guard"
import { getSearchAnalytics, getGSCPages } from "@/lib/google-search-console"
import { getIntegrationStatus } from "@/lib/integration-status"
import type {
    TrackedKeyword,
    TrackedCompetitor,
    BacklinkEntry,
    SEOSnapshot,
    PageSpeedMetrics,
    ActionResult,
    GSCSiteMetrics,
} from "./types"

// ─── Helpers ────────────────────────────────────────────────────────────────

function tsToISO(v: unknown): string | null {
    if (!v) return null
    if (typeof v === "string") return v
    if ((v as any)?.toDate) return (v as any).toDate().toISOString()
    return null
}

// ─── Google Search Console ──────────────────────────────────────────────────

export async function getSeoConnectionStatus() {
    const status = await getIntegrationStatus()
    return { gsc: status.gsc }
}

export async function fetchGSCData(days: number = 28): Promise<ActionResult<GSCSiteMetrics>> {
    const session = await requireAuth()

    const workspaceId = session.user.workspaceId
    const data = await getSearchAnalytics(workspaceId, days)
    if (!data) return { success: false, error: "GSC not configured or no data available" }

    return { success: true, data }
}

export async function fetchGSCPages(days: number = 28) {
    const session = await requireAuth()

    const workspaceId = session.user.workspaceId
    const data = await getGSCPages(workspaceId, days)
    if (!data) return { success: false, error: "GSC not configured or no data available" }

    return { success: true, data }
}

// ─── Keyword Tracking (Firestore) ───────────────────────────────────────────

export async function getTrackedKeywords(): Promise<ActionResult<TrackedKeyword[]>> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const snap = await db.collection("seo_keywords").orderBy("createdAt", "desc").get()
        const keywords: TrackedKeyword[] = snap.docs.map((doc) => {
            const d = doc.data()
            return {
                id: doc.id,
                keyword: d.keyword,
                domain: d.domain,
                position: d.position ?? null,
                previousPosition: d.previousPosition ?? null,
                searchVolume: d.searchVolume,
                lastChecked: tsToISO(d.lastChecked) || "",
                history: d.history || [],
                createdAt: tsToISO(d.createdAt) || "",
            }
        })
        return { success: true, data: keywords }
    } catch (error) {
        console.error("Error fetching keywords:", error)
        return { success: false, error: "Failed to fetch keywords" }
    }
}

export async function addTrackedKeyword(
    keyword: string,
    domain: string
): Promise<ActionResult<TrackedKeyword>> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const now = new Date().toISOString()
        const data = {
            keyword: keyword.toLowerCase().trim(),
            domain: domain.replace("www.", "").toLowerCase().trim(),
            position: null,
            previousPosition: null,
            history: [],
            lastChecked: "",
            createdAt: now,
        }
        const ref = await db.add("seo_keywords", data)

        return {
            success: true,
            data: { ...data, id: ref.id, lastChecked: "", createdAt: now },
        }
    } catch (error) {
        console.error("Error adding keyword:", error)
        return { success: false, error: "Failed to add keyword" }
    }
}

export async function removeTrackedKeyword(id: string): Promise<ActionResult> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        await db.doc("seo_keywords", id).delete()
        return { success: true }
    } catch (error) {
        console.error("Error removing keyword:", error)
        return { success: false, error: "Failed to remove keyword" }
    }
}

export async function updateKeywordPosition(
    id: string,
    position: number | null,
    searchVolume?: number
): Promise<ActionResult> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const ref = db.doc("seo_keywords", id)
        const doc = await ref.get()
        if (!doc.exists) return { success: false, error: "Keyword not found" }

        const existing = doc.data()!
        const now = new Date().toISOString()
        const today = now.split("T")[0]

        const historyEntry = { date: today, position }
        const history = [...(existing.history || []), historyEntry].slice(-90) // keep 90 days

        const updateData: Record<string, any> = {
            previousPosition: existing.position,
            position,
            lastChecked: now,
            history,
        }
        if (searchVolume !== undefined) {
            updateData.searchVolume = searchVolume
        }

        await ref.update(updateData)
        return { success: true }
    } catch (error) {
        console.error("Error updating keyword position:", error)
        return { success: false, error: "Failed to update keyword" }
    }
}

// ─── Competitor Tracking (Firestore) ────────────────────────────────────────

export async function getTrackedCompetitors(): Promise<ActionResult<TrackedCompetitor[]>> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const snap = await db.collection("seo_competitors").orderBy("createdAt", "desc").get()
        const competitors: TrackedCompetitor[] = snap.docs.map((doc) => {
            const d = doc.data()
            return {
                id: doc.id,
                domain: d.domain,
                name: d.name,
                pageSpeed: d.pageSpeed || null,
                history: d.history || [],
                lastChecked: tsToISO(d.lastChecked) || "",
                createdAt: tsToISO(d.createdAt) || "",
            }
        })
        return { success: true, data: competitors }
    } catch (error) {
        console.error("Error fetching competitors:", error)
        return { success: false, error: "Failed to fetch competitors" }
    }
}

export async function addTrackedCompetitor(
    domain: string,
    name: string
): Promise<ActionResult<TrackedCompetitor>> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const now = new Date().toISOString()
        const data = {
            domain: domain.replace("www.", "").toLowerCase().trim(),
            name: name.trim(),
            pageSpeed: null,
            history: [],
            lastChecked: "",
            createdAt: now,
        }
        const ref = await db.add("seo_competitors", data)

        return { success: true, data: { ...data, id: ref.id } }
    } catch (error) {
        console.error("Error adding competitor:", error)
        return { success: false, error: "Failed to add competitor" }
    }
}

export async function removeTrackedCompetitor(id: string): Promise<ActionResult> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        await db.doc("seo_competitors", id).delete()
        return { success: true }
    } catch (error) {
        console.error("Error removing competitor:", error)
        return { success: false, error: "Failed to remove competitor" }
    }
}

export async function updateCompetitorPageSpeed(
    id: string,
    pageSpeed: PageSpeedMetrics
): Promise<ActionResult> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const ref = db.doc("seo_competitors", id)
        const doc = await ref.get()
        if (!doc.exists) return { success: false, error: "Competitor not found" }

        const existing = doc.data()!
        const today = new Date().toISOString().split("T")[0]

        const historyEntry = {
            date: today,
            performanceScore: pageSpeed.performanceScore,
            seoScore: pageSpeed.seoScore,
            lcp: pageSpeed.lcp,
            cls: pageSpeed.cls,
        }
        const history = [...(existing.history || []), historyEntry].slice(-90)

        await ref.update({
            pageSpeed,
            history,
            lastChecked: new Date().toISOString(),
        })
        return { success: true }
    } catch (error) {
        console.error("Error updating competitor PageSpeed:", error)
        return { success: false, error: "Failed to update competitor" }
    }
}

// ─── Backlink Tracking (Manual Entry) ───────────────────────────────────────

export async function getBacklinkEntries(): Promise<ActionResult<BacklinkEntry[]>> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const snap = await db.collection("seo_backlink_entries").orderBy("date", "desc").get()
        const entries: BacklinkEntry[] = snap.docs.map((doc) => {
            const d = doc.data()
            return {
                id: doc.id,
                date: d.date,
                totalBacklinks: d.totalBacklinks,
                referringDomains: d.referringDomains,
                domainRating: d.domainRating ?? null,
                notes: d.notes || "",
                createdAt: tsToISO(d.createdAt) || "",
            }
        })
        return { success: true, data: entries }
    } catch (error) {
        console.error("Error fetching backlink entries:", error)
        return { success: false, error: "Failed to fetch backlink data" }
    }
}

export async function addBacklinkEntry(entry: {
    date: string
    totalBacklinks: number
    referringDomains: number
    domainRating: number | null
    notes: string
}): Promise<ActionResult<BacklinkEntry>> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const now = new Date().toISOString()
        const data = { ...entry, createdAt: now }
        const ref = await db.add("seo_backlink_entries", data)

        return { success: true, data: { ...data, id: ref.id } }
    } catch (error) {
        console.error("Error adding backlink entry:", error)
        return { success: false, error: "Failed to add backlink entry" }
    }
}

export async function removeBacklinkEntry(id: string): Promise<ActionResult> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        await db.doc("seo_backlink_entries", id).delete()
        return { success: true }
    } catch (error) {
        console.error("Error removing backlink entry:", error)
        return { success: false, error: "Failed to remove backlink entry" }
    }
}

// ─── SEO Snapshots ──────────────────────────────────────────────────────────

export async function saveSEOSnapshot(snapshot: Omit<SEOSnapshot, "id" | "createdAt">): Promise<ActionResult> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        await db.add("seo_snapshots", { ...snapshot, createdAt: new Date().toISOString() })
        return { success: true }
    } catch (error) {
        console.error("Error saving SEO snapshot:", error)
        return { success: false, error: "Failed to save snapshot" }
    }
}

export async function getSEOSnapshots(limit: number = 90): Promise<ActionResult<SEOSnapshot[]>> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const snap = await db
            .collection("seo_snapshots")
            .orderBy("date", "desc")
            .limit(limit)
            .get()

        const snapshots: SEOSnapshot[] = snap.docs.map((doc) => {
            const d = doc.data()
            return {
                id: doc.id,
                date: d.date,
                gscClicks: d.gscClicks,
                gscImpressions: d.gscImpressions,
                gscAvgCTR: d.gscAvgCTR,
                gscAvgPosition: d.gscAvgPosition,
                pageSpeedPerformance: d.pageSpeedPerformance ?? null,
                pageSpeedSEO: d.pageSpeedSEO ?? null,
                createdAt: tsToISO(d.createdAt) || "",
            }
        })

        return { success: true, data: snapshots.reverse() }
    } catch (error) {
        console.error("Error fetching SEO snapshots:", error)
        return { success: false, error: "Failed to fetch snapshots" }
    }
}
