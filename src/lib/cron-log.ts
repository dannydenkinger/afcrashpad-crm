import "server-only"
import { adminDb } from "@/lib/firebase-admin"

/**
 * Log a cron endpoint invocation to the cron_runs collection. Used by
 * /admin/integrations to show "last successful run" per cron without
 * a separate observability tool.
 *
 * Fire-and-forget — failure to log shouldn't break the cron.
 */
export async function logCronRun(input: {
    name: string
    status: "success" | "error" | "unauthorized"
    durationMs: number
    detail?: Record<string, unknown> | null
    error?: string | null
}): Promise<void> {
    try {
        await adminDb.collection("cron_run_log").add({
            name: input.name,
            status: input.status,
            durationMs: input.durationMs,
            detail: input.detail ?? null,
            error: input.error ?? null,
            at: new Date(),
        })
    } catch {
        // best effort
    }
}

function toIso(ts: unknown): string | null {
    if (!ts) return null
    if (typeof ts === "string") return ts
    if (ts instanceof Date) return ts.toISOString()
    const t = ts as { toDate?: () => Date }
    if (typeof t.toDate === "function") return t.toDate().toISOString()
    return null
}

export interface CronRunSummary {
    name: string
    lastSuccessAt: string | null
    lastFailureAt: string | null
    lastFailureError: string | null
    last24hRuns: number
    last24hFailures: number
}

export async function getCronRunSummaries(): Promise<CronRunSummary[]> {
    let snap
    try {
        snap = await adminDb
            .collection("cron_runs")
            .orderBy("at", "desc")
            .limit(500)
            .get()
    } catch {
        return []
    }

    const byName = new Map<
        string,
        {
            lastSuccessAt: number | null
            lastFailureAt: number | null
            lastFailureError: string | null
            last24h: number
            last24hFailures: number
        }
    >()

    const dayCutoff = Date.now() - 24 * 60 * 60 * 1000

    for (const d of snap.docs) {
        const data = d.data()
        const name = (data.name as string) || "(unknown)"
        const status = (data.status as string) || "error"
        const at = toIso(data.at)
        const atMs = at ? new Date(at).getTime() : 0
        const bucket = byName.get(name) ?? {
            lastSuccessAt: null,
            lastFailureAt: null,
            lastFailureError: null,
            last24h: 0,
            last24hFailures: 0,
        }
        if (atMs >= dayCutoff) {
            bucket.last24h++
            if (status !== "success") bucket.last24hFailures++
        }
        if (status === "success" && (!bucket.lastSuccessAt || atMs > bucket.lastSuccessAt)) {
            bucket.lastSuccessAt = atMs
        }
        if (status !== "success" && (!bucket.lastFailureAt || atMs > bucket.lastFailureAt)) {
            bucket.lastFailureAt = atMs
            bucket.lastFailureError = (data.error as string) || null
        }
        byName.set(name, bucket)
    }

    // Surface a fixed set of expected crons so newly-added ones that
    // haven't run yet still show up as "never ran".
    const expected = [
        "purge-workspaces",
        "process-automations",
        "send-scheduled-campaigns",
        "stale-opportunities",
        "date-triggers",
        "ab-winner",
        "haro",
        "gmail-watch",
        "advance-opportunities",
    ]
    for (const name of expected) {
        if (!byName.has(name)) {
            byName.set(name, {
                lastSuccessAt: null,
                lastFailureAt: null,
                lastFailureError: null,
                last24h: 0,
                last24hFailures: 0,
            })
        }
    }

    return Array.from(byName.entries())
        .map(([name, b]) => ({
            name,
            lastSuccessAt: b.lastSuccessAt ? new Date(b.lastSuccessAt).toISOString() : null,
            lastFailureAt: b.lastFailureAt ? new Date(b.lastFailureAt).toISOString() : null,
            lastFailureError: b.lastFailureError,
            last24hRuns: b.last24h,
            last24hFailures: b.last24hFailures,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
}
