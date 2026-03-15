export interface HaroSettings {
    // Bio & credentials
    name: string
    businessName: string
    businessIntro: string // e.g. "a successful military lodging provider doing over 300k/yr"
    linkedIn: string
    instagram: string
    twitter: string
    website: string
    headshotUrl: string
    signoff: string // e.g. "Cheers,\nDaniel"

    // Expertise topics (configurable)
    expertiseTopics: string[]

    // Response customization
    responseTone: number // 0-100, 0=very casual, 100=very professional
    responseLength: "short" | "medium" | "long"
    responseStyle: "friendly_expert" | "thought_leader" | "storyteller" | "data_driven"
    includeAnecdotes: boolean
    includeCallToAction: boolean

    // Relevancy tuning
    relevancyStrictness: number // 0-100, 0=very loose, 100=very strict

    // Send mode
    sendMode: "draft" | "auto" | "auto_with_threshold"
    confidenceThreshold: number // 0-100, used when sendMode is "auto_with_threshold"

    // Email config
    sendFromEmail: string
    replyToEmail: string

    // HARO email identification
    haroSenderEmail: string // email address HARO sends from
    haroSubjectKeyword: string // keyword to identify HARO emails (e.g. "[HARO]")

    // Feature toggle
    enabled: boolean
}

export interface HaroBatch {
    id: string
    processedAt: string
    emailSubject: string
    emailDate: string
    totalQueries: number
    relevantQueries: number
    responsesGenerated: number
    responsesSent: number
    status: "processing" | "completed" | "error"
    errorMessage?: string
    createdAt: string
}

export type HaroQueryStatus = "pending" | "reviewing" | "approved" | "sent" | "placed" | "declined" | "expired"

export interface HaroQuery {
    id: string
    batchId: string
    // Query details
    title: string
    description: string
    category: string
    reporterName: string
    reporterEmail: string
    mediaOutlet: string
    mediaUrl: string
    deadline: string
    deadlineParsed?: string // ISO timestamp for sorting/urgency
    deadlineNotified?: boolean
    // AI processing
    relevanceScore: number // 0-100
    isRelevant: boolean
    relevanceReason: string
    // Response
    aiResponse: string
    editedResponse: string
    responseSubject: string
    // Status tracking
    status: HaroQueryStatus
    sentAt?: string
    // Placement tracking
    placementConfirmed: boolean
    placementUrl: string
    placementDomainAuthority: number
    estimatedSeoValue: number
    // Timestamps
    createdAt: string
    updatedAt: string
}

export interface HaroMetrics {
    totalBatches: number
    totalQueriesReceived: number
    totalRelevantMatches: number
    totalResponsesSent: number
    totalPlacementsConfirmed: number
    totalBacklinksEarned: number
    avgResponseRate: number // % of relevant queries responded to
    avgDomainAuthority: number
    estimatedTotalSeoValue: number
    // Time-series for charts
    weeklyData: {
        week: string
        queries: number
        relevant: number
        sent: number
        placed: number
    }[]
}

export const DEFAULT_HARO_SETTINGS: HaroSettings = {
    name: "Daniel Denkinger",
    businessName: "Air Force Crashpad",
    businessIntro: "a successful military lodging provider that does over 300k/yr",
    linkedIn: "https://www.linkedin.com/in/danny-denkinger-549171130/",
    instagram: "",
    twitter: "",
    website: "https://afcrashpad.com",
    headshotUrl: "",
    signoff: "Will be in the office for the rest of the day - if you need anything just shout & I'll take care of it.\n\nCheers,\nDaniel",
    expertiseTopics: [
        "military",
        "real estate",
        "entrepreneurship",
        "small business",
        "aviation",
        "finance",
        "AI",
        "lodging",
        "property management",
        "veteran",
        "Air Force",
    ],
    responseTone: 65,
    responseLength: "medium",
    responseStyle: "friendly_expert",
    includeAnecdotes: true,
    includeCallToAction: false,
    relevancyStrictness: 50,
    sendMode: "draft",
    confidenceThreshold: 75,
    sendFromEmail: "",
    replyToEmail: "",
    haroSenderEmail: "",
    haroSubjectKeyword: "HARO",
    enabled: true,
}
