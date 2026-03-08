export interface AssignmentRuleCondition {
    field: string // "lead_source" | "base"
    operator: "equals" | "contains"
    value: string
}

export interface AssignmentRule {
    id: string
    type: "round_robin" | "rule_based"
    teamMembers: { id: string; name: string; email: string }[]
    conditions: AssignmentRuleCondition[]
    assignToUserId?: string // for rule-based
    assignToUserName?: string
    enabled: boolean
    lastAssignedIndex: number
    createdAt: string | null
}
