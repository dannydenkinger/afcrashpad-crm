export interface ScheduledReport {
    id: string
    userId: string
    frequency: "daily" | "weekly" | "monthly"
    recipients: string[]
    reportType: "pipeline_summary" | "contacts_summary" | "revenue_summary"
    enabled: boolean
    lastSentAt: string | null
    createdAt: string | null
}
