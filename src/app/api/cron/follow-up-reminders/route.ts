import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get("secret")
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        // 1. Load follow-up config
        const configDoc = await adminDb.collection("settings").doc("follow_up_reminders").get()
        if (!configDoc.exists || !configDoc.data()?.enabled) {
            return NextResponse.json({ success: true, message: "Follow-up reminders disabled", created: 0 })
        }

        const config = configDoc.data()!
        const daysThreshold = config.daysThreshold || 7
        const pipelineIds: string[] = config.pipelineIds || []

        // 2. Calculate the cutoff date
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysThreshold)

        // 3. Query opportunities updated before the cutoff
        const oppsSnap = await adminDb.collection("opportunities").get()
        const staleOpps = oppsSnap.docs.filter(doc => {
            const data = doc.data()
            const updatedAt = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date()
            return updatedAt < cutoffDate
        })

        // 4. If pipeline filter is set, determine valid stage IDs
        let validStageIds: Set<string> | null = null
        if (pipelineIds.length > 0) {
            validStageIds = new Set<string>()
            for (const pipelineId of pipelineIds) {
                const stagesSnap = await adminDb
                    .collection("pipelines")
                    .doc(pipelineId)
                    .collection("stages")
                    .get()
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
            const existingTasks = await adminDb
                .collection("tasks")
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

            await adminDb.collection("tasks").add({
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

        return NextResponse.json({
            success: true,
            created,
            skipped,
            totalStale: staleOpps.length,
        })
    } catch (error) {
        console.error("Follow-up reminders cron error:", error)
        return NextResponse.json({ error: "Failed to process follow-up reminders" }, { status: 500 })
    }
}
