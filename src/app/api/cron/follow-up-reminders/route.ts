import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"

const CRON_NAME = "follow-up-reminders"

export async function GET(request: Request) {
    const started = Date.now()
    if (process.env.NODE_ENV !== "development") {
        const authHeader = request.headers.get("authorization") ?? ""
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
        // Iterate all active workspaces
        const workspacesSnap = await adminDb.collection("workspaces").where("status", "==", "active").get()
        let totalCreated = 0
        let totalSkipped = 0
        let totalStale = 0

        for (const wsDoc of workspacesSnap.docs) {
            const db = tenantDb(wsDoc.id)

            // 1. Load follow-up config
            const configDoc = await db.settingsDoc("follow_up_reminders").get()
            if (!configDoc.exists || !configDoc.data()?.enabled) {
                continue
            }

            const config = configDoc.data()!
            const daysThreshold = config.daysThreshold || 7
            const pipelineIds: string[] = config.pipelineIds || []

            // 2. Calculate the cutoff date
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - daysThreshold)

            // 3. Query opportunities updated before the cutoff
            const oppsSnap = await db.collection("opportunities").get()
            const staleOpps = oppsSnap.docs.filter(doc => {
                const data = doc.data()
                const updatedAt = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date()
                return updatedAt < cutoffDate
            })

            totalStale += staleOpps.length

            // 4. If pipeline filter is set, determine valid stage IDs
            let validStageIds: Set<string> | null = null
            if (pipelineIds.length > 0) {
                validStageIds = new Set<string>()
                for (const pipelineId of pipelineIds) {
                    const stagesSnap = await db.subcollection("pipelines", pipelineId, "stages").get()
                    for (const sDoc of stagesSnap.docs) {
                        validStageIds.add(sDoc.id)
                    }
                }
            }

            let created = 0
            let skipped = 0

            for (const oppDoc of staleOpps) {
                const opp = oppDoc.data()

                // Filter by pipeline if configured
                if (validStageIds && !validStageIds.has(opp.pipelineStageId || "")) {
                    continue
                }

                // 5. Check if a follow-up task already exists for this opportunity
                const existingTasks = await db.collection("tasks")
                    .where("opportunityId", "==", oppDoc.id)
                    .where("completed", "==", false)
                    .get()

                const hasFollowUp = existingTasks.docs.some(t => {
                    const title = (t.data().title || "").toLowerCase()
                    return title.includes("follow up") || title.includes("follow-up")
                })

                if (hasFollowUp) {
                    skipped++
                    continue
                }

                // 6. Create a follow-up task
                const dealName = opp.name || "Unnamed Deal"
                const assigneeId = opp.assignedTo || opp.claimedBy || null

                const dueDate = new Date()
                dueDate.setDate(dueDate.getDate() + 1) // Due tomorrow

                await db.add("tasks", {
                    title: `Follow up on ${dealName}`,
                    description: `This deal hasn't been updated in ${daysThreshold}+ days. Please review and take action.`,
                    dueDate,
                    priority: "HIGH",
                    contactId: opp.contactId || null,
                    opportunityId: oppDoc.id,
                    assigneeId,
                    blockedByTaskId: null,
                    completed: false,
                    recurrence: null,
                    source: "follow_up_reminder",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })

                created++
            }

            totalCreated += created
            totalSkipped += skipped
        }

        await logCronRun({
            name: CRON_NAME,
            status: "success",
            durationMs: Date.now() - started,
            detail: {
                created: totalCreated,
                skipped: totalSkipped,
                totalStale,
                workspacesProcessed: workspacesSnap.size,
            },
        })
        return NextResponse.json({
            success: true,
            created: totalCreated,
            skipped: totalSkipped,
            totalStale,
            workspacesProcessed: workspacesSnap.size,
        })
    } catch (error) {
        console.error("Follow-up reminders cron error:", error)
        const message = error instanceof Error ? error.message : "Failed to process follow-up reminders"
        await logCronRun({ name: CRON_NAME, status: "error", durationMs: Date.now() - started, error: message })
        return NextResponse.json({ error: "Failed to process follow-up reminders" }, { status: 500 })
    }
}
