/**
 * Daily cron: fires opportunity_stale automation triggers for any open
 * opportunity that hasn't been updated in N days. N comes from each
 * automation's trigger.config.staleDays (default 14).
 *
 * Approach:
 *   - Find all enabled automations with trigger.type = opportunity_stale
 *   - For each automation, query opportunities matching its staleDays cutoff
 *   - Fire fireTrigger for each — single-enrollment guard prevents re-firing
 *     for the same contact in the same automation
 */

import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { fireTrigger } from "@/lib/automations/triggers"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const PER_AUTOMATION_CAP = 500
const CRON_NAME = "stale-opportunities"

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
    // Find all enabled automations subscribed to opportunity_stale
    const autoSnap = await adminDb
        .collection("automations")
        .where("enabled", "==", true)
        .where("trigger.type", "==", "opportunity_stale")
        .limit(50)
        .get()

    let firedTotal = 0
    const perAutomation: Array<{ id: string; fired: number }> = []

    for (const autoDoc of autoSnap.docs) {
        const auto = autoDoc.data()
        const workspaceId = auto.workspaceId as string
        const staleDays = (auto.trigger?.config?.staleDays as number) ?? 14
        const pipelineId = auto.trigger?.config?.pipelineId as string | undefined

        const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000)

        // Find open opportunities in this workspace that haven't moved
        let q = adminDb
            .collection("opportunities")
            .where("workspaceId", "==", workspaceId)
            .where("status", "==", "open")
            .where("updatedAt", "<=", cutoff)
            .limit(PER_AUTOMATION_CAP) as FirebaseFirestore.Query
        if (pipelineId) {
            q = q.where("pipelineId", "==", pipelineId)
        }
        const oppSnap = await q.get()

        let fired = 0
        for (const oppDoc of oppSnap.docs) {
            const opp = oppDoc.data()
            await fireTrigger({
                workspaceId,
                type: "opportunity_stale",
                contactId: (opp.contactId as string) || "",
                contactEmail: (opp.email as string) || undefined,
                match: { pipelineId },
                payload: {
                    opportunityId: oppDoc.id,
                    opportunityValue: Number(opp.opportunityValue) || 0,
                    daysSinceUpdate: Math.floor(
                        (Date.now() - (opp.updatedAt?.toDate?.()?.getTime?.() ?? Date.now())) /
                            (24 * 60 * 60 * 1000),
                    ),
                },
            }).catch(() => {})
            fired += 1
        }
        perAutomation.push({ id: autoDoc.id, fired })
        firedTotal += fired
    }

    await logCronRun({
        name: CRON_NAME,
        status: "success",
        durationMs: Date.now() - started,
        detail: { automationsScanned: autoSnap.size, firedTotal },
    })
    return NextResponse.json({
        ok: true,
        automationsScanned: autoSnap.size,
        firedTotal,
        perAutomation,
    })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        await logCronRun({ name: CRON_NAME, status: "error", durationMs: Date.now() - started, error: message })
        return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
}
