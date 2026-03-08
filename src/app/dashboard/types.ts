export interface LeaderboardAgent {
    userId: string
    name: string
    email: string
    role: string
    totalDeals: number
    bookedDeals: number
    totalRevenue: number
    totalProfit: number
    avgDealValue: number
    conversionRate: number
    claimedDeals: number
    rank: number
}

export interface LeaderboardData {
    agents: LeaderboardAgent[]
    totalAgents: number
}

export interface DashboardData {
    pipelines: { id: string; name: string }[]
    kpi: {
        activeStayCount: number
        totalContacts: number
        conversionRate: number
        totalPipelineValue: number
        openInquiries: number
        monthlyRevenue: number
        revenueTrend: number | null
        leadVelocity: number
        leadVelocityTrend: number | null
        avgDealValue: number
        weightedForecast: number
        totalClosedProfit: number
        avgProfitPerDeal: number
    }
    pipelineData: Record<string, {
        stageDistribution: { name: string; count: number; value: number; color: string }[]
        valueOverTime: {
            "1m": { name: string; value: number }[]
            "6m": { name: string; value: number }[]
            "1y": { name: string; value: number }[]
        }
        dealsByBase: { name: string; deals: number; color: string }[]
        totalValue: number
        totalDeals: number
    }>
    sourceAttribution: { source: string; count: number; value: number }[]
    tasks: {
        id: string
        title: string
        assignee: string
        dueDate: string
        priority: string
        status: string
    }[]
}

export interface ActivityItem {
    id: string
    type: 'deal_stage_change' | 'contact_added' | 'task_completed' | 'communication_sent'
    description: string
    timestamp: string // ISO string
    linkHref: string
    meta?: string // e.g. stage name, contact name
}
