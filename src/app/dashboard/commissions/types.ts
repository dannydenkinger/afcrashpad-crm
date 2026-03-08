export interface CommissionEntry {
    id: string
    opportunityId: string
    dealName: string
    contactName: string
    base: string | null
    agentId: string
    agentName: string
    dealValue: number
    commissionRate: number
    commissionAmount: number
    status: "earned" | "paid"
    paidAt: string | null
    earnedAt: string
    createdAt: string
}

export interface CommissionSummary {
    agentId: string
    agentName: string
    totalEarned: number
    totalPaid: number
    totalPending: number
    dealCount: number
}

export interface CommissionsData {
    entries: CommissionEntry[]
    summaries: CommissionSummary[]
    defaultRate: number
    totalEarned: number
    totalPaid: number
    totalPending: number
}
