export interface Contact {
    id: string
    name: string
    email: string
    phone: string
    militaryBase: string
    status: string
    tags: string[]
    leadSource: string
    assigneeId: string | null
    notes: string
    createdAt: string
    updatedAt: string
    [key: string]: any // allow extra fields for flexibility
}

export interface Opportunity {
    id: string
    name: string
    email: string
    phone: string
    base: string
    stage: string
    priority: string
    startDate: string
    endDate: string
    value: number
    margin: number
    notes: string
    assigneeId: string | null
    contactId: string | null
    specialAccommodationId: string | null
    tags: string[]
    expenses?: {
        monthlyRent: number
        cleaningFee: number
        petFee: number
        nonrefundableDeposit: number
    }
    unread?: boolean
    lastSeenAt?: string
    createdAt: string
    updatedAt: string
    [key: string]: any
}

export interface Pipeline {
    name: string
    stages: PipelineStage[]
    deals: Opportunity[]
}

export interface PipelineStage {
    id: string
    name: string
    order: number
}

export interface TimelineItem {
    id: string
    type: string
    content: string
    createdAt: string
    userId?: string
    userName?: string
}

export interface AppUser {
    id: string
    name: string
    email: string
    role: string
    image?: string
}

export interface Notification {
    id: string
    title: string
    message: string
    type: string
    linkUrl: string | null
    isRead: boolean
    createdAt: string | null
}
