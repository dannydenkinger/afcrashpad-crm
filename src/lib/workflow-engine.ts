/**
 * Workflow Engine
 *
 * Evaluates workflow conditions and executes actions (sending emails,
 * creating tasks, notifications, field updates, user assignments).
 */

import { adminDb } from "@/lib/firebase-admin"
import { sendEmail } from "@/lib/email"

export interface WorkflowCondition {
    field: string
    operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains"
    value: string
}

export interface WorkflowAction {
    type: "send_email" | "create_task" | "send_notification" | "update_field" | "assign_to_user"
    config: Record<string, string>
}

export interface WorkflowDefinition {
    id: string
    name: string
    trigger: string
    conditions: WorkflowCondition[]
    actions: WorkflowAction[]
    enabled: boolean
}

export interface TriggerEvent {
    type: string // matches workflow trigger field
    data: Record<string, unknown> // context data for condition evaluation
}

/**
 * Evaluate a single condition against event data.
 */
function evaluateCondition(condition: WorkflowCondition, data: Record<string, unknown>): boolean {
    const fieldValue = data[condition.field]
    const targetValue = condition.value

    switch (condition.operator) {
        case "equals":
            return String(fieldValue ?? "").toLowerCase() === targetValue.toLowerCase()

        case "not_equals":
            return String(fieldValue ?? "").toLowerCase() !== targetValue.toLowerCase()

        case "greater_than": {
            const numField = Number(fieldValue)
            const numTarget = Number(targetValue)
            if (isNaN(numField) || isNaN(numTarget)) return false
            return numField > numTarget
        }

        case "less_than": {
            const numField = Number(fieldValue)
            const numTarget = Number(targetValue)
            if (isNaN(numField) || isNaN(numTarget)) return false
            return numField < numTarget
        }

        case "contains":
            return String(fieldValue ?? "").toLowerCase().includes(targetValue.toLowerCase())

        default:
            return false
    }
}

/**
 * Check if all conditions in a workflow are satisfied by the event data.
 */
function evaluateConditions(conditions: WorkflowCondition[], data: Record<string, unknown>): boolean {
    if (conditions.length === 0) return true
    return conditions.every(c => evaluateCondition(c, data))
}

/**
 * Find all enabled workflows that match a trigger event and whose conditions pass.
 * Returns the list of actions that should be executed.
 */
export async function evaluateWorkflows(event: TriggerEvent): Promise<{
    matchedWorkflows: { workflow: WorkflowDefinition; actions: WorkflowAction[] }[]
}> {
    const snap = await adminDb
        .collection("workflows")
        .where("trigger", "==", event.type)
        .where("enabled", "==", true)
        .get()

    const matched: { workflow: WorkflowDefinition; actions: WorkflowAction[] }[] = []

    for (const doc of snap.docs) {
        const data = doc.data()
        const workflow: WorkflowDefinition = {
            id: doc.id,
            name: data.name || "",
            trigger: data.trigger || "",
            conditions: data.conditions || [],
            actions: data.actions || [],
            enabled: data.enabled ?? true,
        }

        if (evaluateConditions(workflow.conditions, event.data)) {
            matched.push({ workflow, actions: workflow.actions })
        }
    }

    return { matchedWorkflows: matched }
}

// ── Template variable substitution ──────────────────────────────────────────

function resolveVars(text: string, vars: Record<string, string>): string {
    let result = text
    for (const [key, val] of Object.entries(vars)) {
        result = result.replaceAll(key, val)
    }
    return result
}

function buildVars(context: Record<string, unknown>): Record<string, string> {
    return {
        "{{name}}": String(context.contactName || ""),
        "{{contact_name}}": String(context.contactName || ""),
        "{{deal_name}}": String(context.dealName || context.name || ""),
        "{{value}}": String(context.opportunityValue || context.value || "0"),
        "{{base}}": String(context.militaryBase || context.base || ""),
        "{{stage}}": String(context.stageName || context.stage || ""),
        "{{email}}": String(context.contactEmail || context.email || ""),
    }
}

// ── Action Executors ────────────────────────────────────────────────────────

async function executeSendEmail(config: Record<string, string>, context: Record<string, unknown>) {
    const vars = buildVars(context)

    // If a template is specified, load and substitute
    if (config.templateId) {
        const templateDoc = await adminDb.collection("email_templates").doc(config.templateId).get()
        if (!templateDoc.exists) return

        const template = templateDoc.data()!
        const recipientEmail = String(context.contactEmail || context.email || "")
        if (!recipientEmail) return

        const subject = resolveVars(template.subject || "", vars)
        const body = resolveVars(template.body || "", vars)

        await sendEmail({
            to: recipientEmail,
            subject,
            html: `<div style="font-family: Arial, sans-serif; white-space: pre-wrap;">${body}</div>`,
        })

        // Log to contact message history
        const contactId = String(context.contactId || "")
        if (contactId) {
            await adminDb.collection("contacts").doc(contactId).collection("messages").add({
                type: "email",
                direction: "outbound",
                contactEmail: recipientEmail,
                contactName: String(context.contactName || "Unknown"),
                subject,
                body,
                source: "workflow",
                createdAt: new Date(),
            })
        }
    } else {
        // Raw subject/body from config
        const recipientEmail = config.recipientEmail || String(context.contactEmail || context.email || "")
        if (!recipientEmail) return

        const subject = resolveVars(config.subject || "Workflow Notification", vars)
        const body = resolveVars(config.body || "", vars)

        await sendEmail({
            to: recipientEmail,
            subject,
            html: `<div style="font-family: Arial, sans-serif; white-space: pre-wrap;">${body}</div>`,
        })

        const contactId = String(context.contactId || "")
        if (contactId) {
            await adminDb.collection("contacts").doc(contactId).collection("messages").add({
                type: "email",
                direction: "outbound",
                contactEmail: recipientEmail,
                contactName: String(context.contactName || "Unknown"),
                subject,
                body,
                source: "workflow",
                createdAt: new Date(),
            })
        }
    }
}

async function executeCreateTask(config: Record<string, string>, context: Record<string, unknown>) {
    const vars = buildVars(context)
    const title = resolveVars(config.taskTitle || "Follow up", vars)
    const description = resolveVars(config.taskDescription || "", vars)

    const dueDays = parseInt(config.dueDays || "1", 10)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueDays)

    await adminDb.collection("tasks").add({
        title,
        description: description || null,
        dueDate,
        priority: config.priority || "MEDIUM",
        contactId: context.contactId || null,
        opportunityId: context.opportunityId || context.dealId || null,
        assigneeId: config.assigneeId || context.userId || null,
        completed: false,
        source: "workflow",
        createdAt: new Date(),
        updatedAt: new Date(),
    })
}

async function executeSendNotification(config: Record<string, string>, context: Record<string, unknown>) {
    const vars = buildVars(context)
    const message = resolveVars(config.message || "Workflow triggered", vars)
    const title = resolveVars(config.title || "Workflow", vars)

    const recipientId = config.recipientId || String(context.userId || context.assigneeId || "")
    if (!recipientId) return

    await adminDb.collection("notifications").add({
        userId: recipientId,
        title,
        message,
        type: "workflow",
        link: context.opportunityId ? `/pipeline?deal=${context.opportunityId}` : "/dashboard",
        read: false,
        createdAt: new Date(),
    })
}

async function executeUpdateField(config: Record<string, string>, context: Record<string, unknown>) {
    const fieldName = config.fieldName
    const fieldValue = config.fieldValue
    if (!fieldName) return

    // Determine which document to update
    const opportunityId = String(context.opportunityId || context.dealId || "")
    const contactId = String(context.contactId || "")
    const target = config.target || "opportunity" // "opportunity" or "contact"

    if (target === "contact" && contactId) {
        await adminDb.collection("contacts").doc(contactId).update({
            [fieldName]: fieldValue,
            updatedAt: new Date(),
        })
    } else if (opportunityId) {
        await adminDb.collection("opportunities").doc(opportunityId).update({
            [fieldName]: fieldValue,
            updatedAt: new Date(),
        })
    }
}

async function executeAssignToUser(config: Record<string, string>, context: Record<string, unknown>) {
    const assigneeId = config.assigneeId || config.userId
    if (!assigneeId) return

    const opportunityId = String(context.opportunityId || context.dealId || "")
    if (!opportunityId) return

    await adminDb.collection("opportunities").doc(opportunityId).update({
        assigneeId,
        updatedAt: new Date(),
    })

    // Notify the assigned user
    await adminDb.collection("notifications").add({
        userId: assigneeId,
        title: "Deal Assigned",
        message: `You've been assigned to ${context.dealName || context.name || "a deal"}`,
        type: "workflow",
        link: `/pipeline?deal=${opportunityId}`,
        read: false,
        createdAt: new Date(),
    })
}

/**
 * Execute workflow actions with real implementations.
 */
export async function executeWorkflowActions(
    actions: WorkflowAction[],
    context: Record<string, unknown>
): Promise<{ executed: number; errors: string[] }> {
    let executed = 0
    const errors: string[] = []

    for (const action of actions) {
        try {
            switch (action.type) {
                case "send_email":
                    await executeSendEmail(action.config, context)
                    break
                case "create_task":
                    await executeCreateTask(action.config, context)
                    break
                case "send_notification":
                    await executeSendNotification(action.config, context)
                    break
                case "update_field":
                    await executeUpdateField(action.config, context)
                    break
                case "assign_to_user":
                    await executeAssignToUser(action.config, context)
                    break
            }
            executed++
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            errors.push(`Action ${action.type}: ${msg}`)
            console.error(`[Workflow] Action ${action.type} failed:`, err)
        }
    }

    return { executed, errors }
}

/**
 * Convenience: evaluate workflows for an event and execute all matched actions.
 */
export async function triggerWorkflows(event: TriggerEvent): Promise<void> {
    try {
        const { matchedWorkflows } = await evaluateWorkflows(event)
        for (const { actions } of matchedWorkflows) {
            await executeWorkflowActions(actions, event.data)
        }
    } catch (err) {
        console.error("[Workflow] Error triggering workflows:", err)
    }
}
