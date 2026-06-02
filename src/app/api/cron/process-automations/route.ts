import { NextRequest, NextResponse } from "next/server"
import { processDueWaitingRuns } from "@/lib/automations/engine"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes — Vercel hobby cap

const CRON_NAME = "process-automations"

export async function GET(req: NextRequest) {
    const started = Date.now()
    if (process.env.NODE_ENV !== "development") {
        const authHeader = req.headers.get("authorization") ?? ""
        const expected = process.env.CRON_SECRET
        if (!expected) {
            console.error("[cron/process-automations] CRON_SECRET not set")
            await logCronRun({
                name: CRON_NAME,
                status: "error",
                durationMs: Date.now() - started,
                error: "CRON_SECRET not configured",
            })
            return NextResponse.json(
                { error: "CRON_SECRET not configured" },
                { status: 500 },
            )
        }
        if (authHeader !== `Bearer ${expected}`) {
            await logCronRun({
                name: CRON_NAME,
                status: "unauthorized",
                durationMs: Date.now() - started,
            })
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    try {
        const result = await processDueWaitingRuns(25)
        await logCronRun({
            name: CRON_NAME,
            status: "success",
            durationMs: Date.now() - started,
            detail: result as unknown as Record<string, unknown>,
        })
        return NextResponse.json({ ok: true, ...result })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        console.error("[cron/process-automations] failed:", err)
        await logCronRun({
            name: CRON_NAME,
            status: "error",
            durationMs: Date.now() - started,
            error: message,
        })
        return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
}
