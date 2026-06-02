import { NextResponse } from "next/server"
import { fetchAndProcessHaroEmails, checkHaroDeadlines } from "@/app/marketing/haro/actions"
import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"
export const maxDuration = 120 // Allow up to 2 minutes for processing

const CRON_NAME = "haro"

export async function GET(request: Request) {
    const started = Date.now()
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        await logCronRun({ name: CRON_NAME, status: "unauthorized", durationMs: Date.now() - started })
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        // Iterate all active workspaces
        const workspacesSnap = await adminDb.collection("workspaces").where("status", "==", "active").get()
        const results: Record<string, any> = {}

        for (const wsDoc of workspacesSnap.docs) {
            const db = tenantDb(wsDoc.id)

            // Check if HARO automation is enabled for this workspace
            const settingsDoc = await db.settingsDoc("haro").get()
            if (settingsDoc.exists && !settingsDoc.data()?.enabled) {
                results[wsDoc.id] = { skipped: true, message: "HARO automation is disabled" }
                continue
            }

            // Idempotency: prevent duplicate runs within the same hour
            const now = new Date()
            const runKey = `${wsDoc.id}_haro_${now.toISOString().slice(0, 13)}`
            const runRef = adminDb.collection("cron_runs").doc(runKey)
            const existingRun = await runRef.get()
            if (existingRun.exists) {
                results[wsDoc.id] = { skipped: true, message: "Already processed this hour" }
                continue
            }
            await runRef.set({ startedAt: now, cronJob: "haro", workspaceId: wsDoc.id })

            // Process new emails and check deadlines in parallel
            const [result, deadlines] = await Promise.all([
                fetchAndProcessHaroEmails(),
                checkHaroDeadlines(),
            ])
            await runRef.update({ completedAt: new Date() })
            results[wsDoc.id] = { ...result, deadlines }
        }

        await logCronRun({
            name: CRON_NAME,
            status: "success",
            durationMs: Date.now() - started,
            detail: { workspacesProcessed: Object.keys(results).length },
        })
        return NextResponse.json({ success: true, results })
    } catch (err: any) {
        console.error("HARO cron error:", err)
        const message = err?.message || "Failed to process HARO emails"
        await logCronRun({ name: CRON_NAME, status: "error", durationMs: Date.now() - started, error: message })
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
