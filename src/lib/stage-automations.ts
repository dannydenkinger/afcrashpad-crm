"use server"

import { tenantDb } from "@/lib/tenant-db"
import { sendEmail } from "@/lib/email"
import type { StageAutomationAction, StageAutomationRule } from "./stage-automation-types"

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function getStageAutomations(workspaceId: string, stageId: string): Promise<StageAutomationRule[]> {
    try {
        const db = tenantDb(workspaceId)
        const snap = await db
            .collection("stage_automations")
            .where("stageId", "==", stageId)
            .where("enabled", "==", true)
            .get()

        return snap.docs.map((doc) => {
            const d = doc.data()
            return {
                id: doc.id,
                stageId: d.stageId,
                stageName: d.stageName || "",
                pipelineId: d.pipelineId || "",
                pipelineName: d.pipelineName || "",
                actions: d.actions || [],
                enabled: d.enabled ?? true,
                createdAt: d.createdAt?.toDate?.().toISOString() ?? d.createdAt ?? null,
                updatedAt: d.updatedAt?.toDate?.().toISOString() ?? d.updatedAt ?? null,
            }
        })
    } catch (err) {
        console.error("Failed to fetch stage automations:", err)
        return []
    }
}

// ── Execute ──────────────────────────────────────────────────────────────────

export async function executeStageAutomations(
    workspaceId: string,
    dealId: string,
    stageId: string,
    userId: string
) {
    const db = tenantDb(workspaceId)
    const rules = await getStageAutomations(workspaceId, stageId)
    if (rules.length === 0) return

    // Fetch deal data once for all actions
    const dealDoc = await db.doc("opportunities", dealId).get()
    if (!dealDoc.exists) return
    const deal = dealDoc.data()!

    // Fetch contact info if linked
    let contactName = deal.name || "Unknown"
    let contactEmail = ""
    if (deal.contactId) {
        const contactDoc = await db.doc("contacts", deal.contactId).get()
        if (contactDoc.exists) {
            contactName = contactDoc.data()?.name || contactName
            contactEmail = contactDoc.data()?.email || ""
        }
    }

    for (const rule of rules) {
        for (const action of rule.actions) {
            try {
                switch (action.type) {
                    case "send_email":
                        await executeSendEmail(db, action.config, deal, contactName, contactEmail)
                        break
                    case "create_task":
                        await executeCreateTask(db, action.config, dealId, deal, contactName, userId)
                        break
                    case "assign_user":
                        await executeAssignUser(db, action.config, dealId)
                        break
                    case "create_commission":
                        await executeCreateCommission(db, dealId, deal, userId)
                        break
                    case "send_notification":
                        await executeSendNotification(db, action.config, dealId, deal, contactName, userId)
                        break
                }
            } catch (err) {
                console.error(`Stage automation action failed [${action.type}]:`, err)
            }
        }
    }
}

// ── Action Executors ─────────────────────────────────────────────────────────

type TenantDbInstance = ReturnType<typeof tenantDb>

async function executeSendEmail(
    db: TenantDbInstance,
    config: Record<string, string>,
    deal: FirebaseFirestore.DocumentData,
    contactName: string,
    contactEmail: string
) {
    const templateId = config.templateId
    if (!templateId) return

    const templateDoc = await db.doc("email_templates", templateId).get()
    if (!templateDoc.exists) return

    const template = templateDoc.data()!
    const recipientEmail = contactEmail || deal.email
    if (!recipientEmail) return

    // Variable substitution
    const vars: Record<string, string> = {
        "{{name}}": contactName,
        "{{deal_name}}": deal.name || "",
        "{{value}}": String(deal.opportunityValue || 0),
    }

    let subject = template.subject || ""
    let body = template.body || ""
    for (const [key, val] of Object.entries(vars)) {
        subject = subject.replaceAll(key, val)
        body = body.replaceAll(key, val)
    }

    await sendEmail({
        to: recipientEmail,
        subject,
        html: `<div style="font-family: Arial, sans-serif; white-space: pre-wrap;">${body}</div>`,
    })

    // Log the automated email in contact's message history
    if (deal.contactId) {
        await db.addToSubcollection("contacts", deal.contactId, "messages", {
            type: "email",
            direction: "outbound",
            contactEmail: recipientEmail,
            contactName,
            subject,
            body,
            source: "stage_automation",
            createdAt: new Date(),
        })
    }
}

async function executeCreateTask(
    db: TenantDbInstance,
    config: Record<string, string>,
    dealId: string,
    deal: FirebaseFirestore.DocumentData,
    contactName: string,
    userId: string
) {
    const title = (config.taskTitle || "Follow up")
        .replaceAll("{{name}}", contactName)
        .replaceAll("{{deal_name}}", deal.name || "")

    const description = (config.taskDescription || "")
        .replaceAll("{{name}}", contactName)
        .replaceAll("{{deal_name}}", deal.name || "")

    const dueDays = parseInt(config.dueDays || "1", 10)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueDays)

    await db.add("tasks", {
        title,
        description: description || null,
        dueDate,
        priority: config.priority || "MEDIUM",
        contactId: deal.contactId || null,
        opportunityId: dealId,
        assigneeId: config.assigneeId || userId,
        completed: false,
        source: "stage_automation",
        createdAt: new Date(),
        updatedAt: new Date(),
    })
}

async function executeAssignUser(
    db: TenantDbInstance,
    config: Record<string, string>,
    dealId: string
) {
    const assigneeId = config.assigneeId
    if (!assigneeId) return

    await db.doc("opportunities", dealId).update({
        assigneeId,
        updatedAt: new Date(),
    })
}

async function executeCreateCommission(
    db: TenantDbInstance,
    dealId: string,
    deal: FirebaseFirestore.DocumentData,
    userId: string
) {
    const agentId = deal.claimedBy || deal.assigneeId || userId
    if (!agentId) return

    // Check if already recorded
    const existing = await db
        .collection("commissions")
        .where("opportunityId", "==", dealId)
        .where("agentId", "==", agentId)
        .limit(1)
        .get()

    if (!existing.empty) return

    // Get contact name
    let contactName = "Unknown"
    if (deal.contactId) {
        const contactDoc = await db.doc("contacts", deal.contactId).get()
        if (contactDoc.exists) contactName = contactDoc.data()?.name || "Unknown"
    }

    // Get agent info (users are global, not workspace-scoped)
    const { adminDb } = await import("@/lib/firebase-admin")
    const agentDoc = await adminDb.collection("users").doc(agentId).get()
    const agentName = agentDoc.exists ? agentDoc.data()?.name || "Unknown" : "Unknown"

    // Get commission rate
    const settingsDoc = await db.settingsDoc("commissions").get()
    const defaultRate = settingsDoc.exists ? (settingsDoc.data()?.defaultRate ?? 10) : 10
    const agentRatesDoc = await db.settingsDoc("commission_rates").get()
    const agentRates = agentRatesDoc.exists ? agentRatesDoc.data() || {} : {}
    const rate = agentRates[agentId] ?? defaultRate

    const dealValue = Number(deal.opportunityValue) || 0
    const commissionAmount = Math.round((dealValue * rate) / 100 * 100) / 100

    await db.add("commissions", {
        opportunityId: dealId,
        dealName: deal.name || `${contactName}'s Deal`,
        contactName,
        base: null,
        agentId,
        agentName,
        dealValue,
        commissionRate: rate,
        commissionAmount,
        status: "earned",
        paidAt: null,
        earnedAt: new Date(),
        createdAt: new Date(),
        source: "stage_automation",
    })
}

async function executeSendNotification(
    db: TenantDbInstance,
    config: Record<string, string>,
    dealId: string,
    deal: FirebaseFirestore.DocumentData,
    contactName: string,
    userId: string
) {
    const message = (config.message || "Deal {{deal_name}} moved to a new stage")
        .replaceAll("{{name}}", contactName)
        .replaceAll("{{deal_name}}", deal.name || "")

    // Determine recipient: configured user or deal owner
    const recipientId = config.recipientId || deal.claimedBy || deal.assigneeId || userId
    if (!recipientId) return

    // Create an in-app notification
    await db.add("notifications", {
        userId: recipientId,
        title: "Stage Automation",
        message,
        type: "stage_automation",
        link: `/pipeline?deal=${dealId}`,
        read: false,
        createdAt: new Date(),
    })
}
