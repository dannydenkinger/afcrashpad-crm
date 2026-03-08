export interface WorkflowCondition {
    field: string // e.g., "stage", "value", "tag"
    operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains"
    value: string
}

export interface WorkflowAction {
    type: "send_email" | "create_task" | "send_notification" | "update_field" | "assign_to_user"
    config: Record<string, string>
}

export interface Workflow {
    id: string
    name: string
    trigger: string
    conditions: WorkflowCondition[]
    actions: WorkflowAction[]
    enabled: boolean
    createdAt: string | null
}
