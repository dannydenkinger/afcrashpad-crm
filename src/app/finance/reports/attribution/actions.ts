"use server"

import { tenantDb } from "@/lib/tenant-db"
import { requireAuth } from "@/lib/auth-guard"

export interface AttributionRow {
    source: string
    sourceId: string | null
    contacts: number
    opportunities: number
    won: number
    lost: number
    open: number
    wonRevenue: number
    avgDealValue: number
    winRate: number
}

export interface AttributionReport {
    rows: AttributionRow[]
    totals: {
        contacts: number
        opportunities: number
        won: number
        lost: number
        wonRevenue: number
    }
}

const UNATTRIBUTED = "Unattributed"

export async function getAttributionReport(): Promise<{
    success: boolean
    report?: AttributionReport
    error?: string
}> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const [contactsSnap, oppsSnap, sourcesSnap] = await Promise.all([
            db.collection("contacts").get(),
            db.collection("opportunities").get(),
            db.collection("lead_sources").get().catch(() => ({ docs: [] as any[] })),
        ])

        // Build a leadSourceId → name map so old records still resolve to a label
        const sourceNames: Record<string, string> = {}
        for (const d of sourcesSnap.docs) {
            sourceNames[d.id] = (d.data().name as string) || d.id
        }

        // Bucket key resolver — prefers leadSourceId, falls back to source string,
        // collapses everything else to "Unattributed"
        const bucketKey = (data: any): { id: string | null; label: string } => {
            const lsid = data.leadSourceId
            if (lsid) {
                return { id: lsid, label: sourceNames[lsid] || lsid }
            }
            const s = (data.source as string | undefined)?.trim()
            if (s) return { id: null, label: s }
            return { id: null, label: UNATTRIBUTED }
        }

        const map = new Map<string, AttributionRow>()
        const ensure = (label: string, id: string | null): AttributionRow => {
            const k = id || `name:${label}`
            const existing = map.get(k)
            if (existing) return existing
            const row: AttributionRow = {
                source: label,
                sourceId: id,
                contacts: 0,
                opportunities: 0,
                won: 0,
                lost: 0,
                open: 0,
                wonRevenue: 0,
                avgDealValue: 0,
                winRate: 0,
            }
            map.set(k, row)
            return row
        }

        // Contacts → counts
        for (const d of contactsSnap.docs) {
            const data = d.data()
            const { id, label } = bucketKey(data)
            const row = ensure(label, id)
            row.contacts++
        }

        // Opportunities → conversion + revenue
        for (const d of oppsSnap.docs) {
            const data = d.data()
            const { id, label } = bucketKey(data)
            const row = ensure(label, id)
            row.opportunities++
            const status = (data.status as string) || "open"
            if (status === "closed_won") {
                row.won++
                row.wonRevenue += Number(data.opportunityValue) || Number(data.value) || 0
            } else if (status === "closed_lost") {
                row.lost++
            } else {
                row.open++
            }
        }

        // Final pass: derive avg + win rate
        for (const row of map.values()) {
            row.avgDealValue = row.won > 0 ? Math.round((row.wonRevenue / row.won) * 100) / 100 : 0
            const closed = row.won + row.lost
            row.winRate = closed > 0 ? Math.round((row.won / closed) * 1000) / 10 : 0
        }

        const rows = Array.from(map.values()).sort((a, b) => b.wonRevenue - a.wonRevenue || b.opportunities - a.opportunities)

        const totals = rows.reduce(
            (acc, r) => {
                acc.contacts += r.contacts
                acc.opportunities += r.opportunities
                acc.won += r.won
                acc.lost += r.lost
                acc.wonRevenue += r.wonRevenue
                return acc
            },
            { contacts: 0, opportunities: 0, won: 0, lost: 0, wonRevenue: 0 },
        )

        return { success: true, report: { rows, totals } }
    } catch (err) {
        console.error("getAttributionReport error:", err)
        return { success: false, error: err instanceof Error ? err.message : "Failed to load report" }
    }
}
