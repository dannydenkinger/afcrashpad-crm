import { NextRequest, NextResponse } from "next/server"
import {
    findDueABCampaigns,
    finalizeABTest,
} from "@/lib/campaigns/campaigns"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const CRON_NAME = "ab-winner"

export async function GET(req: NextRequest) {
    const started = Date.now()
    if (process.env.NODE_ENV !== "development") {
        const authHeader = req.headers.get("authorization") ?? ""
        const expected = process.env.CRON_SECRET
        if (!expected) {
            await logCronRun({ name: CRON_NAME, status: "error", durationMs: Date.now() - started, error: "CRON_SECRET not configured" })
            return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
        }
        if (authHeader !== `Bearer ${expected}`) {
            await logCronRun({ name: CRON_NAME, status: "unauthorized", durationMs: Date.now() - started })
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    try {
        const due = await findDueABCampaigns(10)
        const results: Array<{ id: string; ok: boolean; winner?: number; sent?: number; error?: string }> = []
        for (const c of due) {
            try {
                const res = await finalizeABTest(c.workspaceId, c.id)
                results.push({
                    id: c.id,
                    ok: res.ok,
                    winner: res.winnerVariant,
                    sent: res.sent,
                    error: res.error,
                })
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error"
                results.push({ id: c.id, ok: false, error: message })
            }
        }
        await logCronRun({
            name: CRON_NAME,
            status: "success",
            durationMs: Date.now() - started,
            detail: { processed: results.length },
        })
        return NextResponse.json({ ok: true, processed: results.length, results })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        await logCronRun({ name: CRON_NAME, status: "error", durationMs: Date.now() - started, error: message })
        return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
}
