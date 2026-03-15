import { NextResponse } from "next/server"
import { fetchAndProcessHaroEmails, checkHaroDeadlines } from "@/app/marketing/haro/actions"
import { adminDb } from "@/lib/firebase-admin"

export const dynamic = "force-dynamic"
export const maxDuration = 120 // Allow up to 2 minutes for processing

export async function GET(request: Request) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        // Check if HARO automation is enabled
        const settingsDoc = await adminDb.collection("haro_settings").doc("default").get()
        if (settingsDoc.exists && !settingsDoc.data()?.enabled) {
            return NextResponse.json({ message: "HARO automation is disabled", skipped: true })
        }

        // Idempotency: prevent duplicate runs within the same hour
        const now = new Date()
        const runKey = `haro_${now.toISOString().slice(0, 13)}` // e.g. "haro_2026-03-15T14"
        const runRef = adminDb.collection("cron_runs").doc(runKey)
        const existingRun = await runRef.get()
        if (existingRun.exists) {
            return NextResponse.json({ message: "Already processed this hour", skipped: true })
        }
        await runRef.set({ startedAt: now, cronJob: "haro" })

        // Process new emails and check deadlines in parallel
        const [result, deadlines] = await Promise.all([
            fetchAndProcessHaroEmails(),
            checkHaroDeadlines(),
        ])
        await runRef.update({ completedAt: new Date() })
        return NextResponse.json({ ...result, deadlines })
    } catch (err: any) {
        console.error("HARO cron error:", err)
        return NextResponse.json({ error: err.message || "Failed to process HARO emails" }, { status: 500 })
    }
}
