import { NextRequest, NextResponse } from "next/server"
import { captureMessage, captureError } from "@/lib/error-tracking"
import { purgeDueWorkspaces } from "@/lib/admin/purge-workspace"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const CRON_NAME = "purge-workspaces"

export async function GET(req: NextRequest) {
    const started = Date.now()
    if (process.env.NODE_ENV !== "development") {
        const authHeader = req.headers.get("authorization") ?? ""
        const expected = process.env.CRON_SECRET
        if (!expected) {
            await logCronRun({
                name: CRON_NAME,
                status: "error",
                durationMs: Date.now() - started,
                error: "CRON_SECRET not configured",
            })
            return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
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
        const purged = await purgeDueWorkspaces(10)
        for (const r of purged) {
            captureMessage(
                `Purged workspace ${r.workspaceId} — stripe.canceled=${r.stripe.canceled} storage.deleted=${r.storage.deleted}`,
                "info",
            )
        }
        await logCronRun({
            name: CRON_NAME,
            status: "success",
            durationMs: Date.now() - started,
            detail: { purgedCount: purged.length },
        })
        return NextResponse.json({ ok: true, purgedCount: purged.length, purged })
    } catch (err) {
        captureError(err, { scope: "purge-workspaces-cron" })
        const message = err instanceof Error ? err.message : "Purge failed"
        await logCronRun({
            name: CRON_NAME,
            status: "error",
            durationMs: Date.now() - started,
            error: message,
        })
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
