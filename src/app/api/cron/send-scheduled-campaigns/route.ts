import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { sendCampaign } from "@/lib/campaigns/campaigns"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes — max for hobby plan

const CRON_NAME = "send-scheduled-campaigns"

/**
 * Cron route: pick up `scheduled` campaigns whose `scheduledAt` has passed
 * and send them.
 *
 * Triggering:
 *   - **Production:** GitHub Actions workflow at
 *     .github/workflows/send-scheduled-campaigns.yml fires every 5 minutes
 *     and curls this endpoint with Authorization: Bearer $CRON_SECRET.
 *     (We do NOT use Vercel Cron because the Hobby tier only allows daily
 *     crons — useless for "send this in 15 minutes" scheduling.)
 *   - **Local dev:** can curl directly with no auth when NODE_ENV=development.
 *   - **Manual:** anyone with the CRON_SECRET can trigger ad-hoc sends.
 */
export async function GET(req: NextRequest) {
    const started = Date.now()
    if (process.env.NODE_ENV !== "development") {
        const authHeader = req.headers.get("authorization") ?? ""
        const expected = process.env.CRON_SECRET
        if (!expected) {
            console.error("[cron/send-scheduled-campaigns] CRON_SECRET not set")
            await logCronRun({ name: CRON_NAME, status: "error", durationMs: Date.now() - started, error: "CRON_SECRET not configured" })
            return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
        }
        if (authHeader !== `Bearer ${expected}`) {
            await logCronRun({ name: CRON_NAME, status: "unauthorized", durationMs: Date.now() - started })
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    try {
        const now = new Date()
        const snap = await adminDb
            .collection("email_campaigns")
            .where("status", "==", "scheduled")
            .where("scheduledAt", "<=", now)
            .limit(20)
            .get()

        if (snap.empty) {
            await logCronRun({
                name: CRON_NAME,
                status: "success",
                durationMs: Date.now() - started,
                detail: { processed: 0 },
            })
            return NextResponse.json({ ok: true, processed: 0 })
        }

        const results: Array<{ id: string; ok: boolean; sent?: number; failed?: number; error?: string }> = []

        for (const doc of snap.docs) {
            const data = doc.data()
            const workspaceId = data.workspaceId as string | undefined
            if (!workspaceId) continue
            try {
                const result = await sendCampaign(workspaceId, doc.id)
                results.push({
                    id: doc.id,
                    ok: result.ok,
                    sent: result.sent,
                    failed: result.failed,
                    error: result.error,
                })
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error"
                results.push({ id: doc.id, ok: false, error: message })
                console.error(`[cron] failed to send campaign ${doc.id}:`, err)
            }
        }

        await logCronRun({
            name: CRON_NAME,
            status: "success",
            durationMs: Date.now() - started,
            detail: { processed: results.length, failures: results.filter((r) => !r.ok).length },
        })
        return NextResponse.json({ ok: true, processed: results.length, results })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        await logCronRun({ name: CRON_NAME, status: "error", durationMs: Date.now() - started, error: message })
        return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
}
