export interface StageAutomationAction {
    type: "send_email" | "create_task" | "assign_user" | "create_commission" | "send_notification"
    config: Record<string, string>
}

export interface StageAutomationRule {
    id: string
    stageId: string
    stageName: string
    pipelineId: string
    pipelineName: string
    actions: StageAutomationAction[]
    enabled: boolean
    createdAt: string | null
    updatedAt: string | null
}
