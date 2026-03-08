export interface FollowUpConfig {
    enabled: boolean
    daysThreshold: number
    pipelineIds: string[] // empty = all pipelines
}
