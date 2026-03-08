/**
 * Workflow Engine
 *
 * Evaluates workflow conditions and determines which actions to execute
 * for a given trigger event. This module handles the logic; actual execution
 * of actions (sending emails, creating tasks, etc.) can be wired up later.
 */

import { adminDb } from "@/lib/firebase-admin"

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

/**
 * Execute workflow actions. Currently a stub that logs what would happen.
 * Wire up real execution (email sending, task creation, etc.) later.
 */
export async function executeWorkflowActions(
    actions: WorkflowAction[],
    _context: Record<string, unknown>
): Promise<{ executed: number; errors: string[] }> {
    let executed = 0
    const errors: string[] = []

    for (const action of actions) {
        try {
            switch (action.type) {
                case "send_email":
                    console.log(`[Workflow] Would send email template: ${action.config.templateName}`)
                    break
                case "create_task":
                    console.log(`[Workflow] Would create task: ${action.config.taskTitle}`)
                    break
                case "send_notification":
                    console.log(`[Workflow] Would send notification: ${action.config.message}`)
                    break
                case "update_field":
                    console.log(`[Workflow] Would update field ${action.config.fieldName} to ${action.config.fieldValue}`)
                    break
                case "assign_to_user":
                    console.log(`[Workflow] Would assign to user: ${action.config.userName}`)
                    break
            }
            executed++
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            errors.push(`Action ${action.type}: ${msg}`)
        }
    }

    return { executed, errors }
}
