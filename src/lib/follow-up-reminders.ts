/**
 * Follow-Up Reminders Processor
 *
 * Checks for stale deals and creates follow-up tasks for deal owners.
 * Called from the main daily cron and the dedicated cron endpoint.
 */

import { tenantDb } from "@/lib/tenant-db"

export async function processFollowUpReminders(workspaceId: string): Promise<{
    success: boolean
    created: number
    skipped: number
    totalStale: number
}> {
    const db = tenantDb(workspaceId)

    // 1. Load follow-up config
    const configDoc = await db.settingsDoc("follow_up_reminders").get()
    if (!configDoc.exists || !configDoc.data()?.enabled) {
        return { success: true, created: 0, skipped: 0, totalStale: 0 }
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
        const existingTasks = await db
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
        dueDate.setDate(dueDate.getDate() + 1)

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

    return { success: true, created, skipped, totalStale: staleOpps.length }
}
