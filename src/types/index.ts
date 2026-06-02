export interface Contact {
    id: string
    name: string
    email: string
    phone: string
    status: string
    tags: string[]
    leadSource: string
    assigneeId: string | null
    notes: string
    createdAt: string
    updatedAt: string
    [key: string]: any // allow extra fields for flexibility
}

export type DealStatus = "open" | "closed_won" | "closed_lost" | "archive"

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
    open: "Open",
    closed_won: "Closed (Won)",
    closed_lost: "Closed (Lost)",
    archive: "Archived",
}

export const DEAL_STATUS_COLORS: Record<DealStatus, string> = {
    open: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    closed_won: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    closed_lost: "bg-red-500/10 text-red-600 border-red-500/20",
    archive: "bg-gray-500/10 text-gray-600 border-gray-500/20",
}

export interface Opportunity {
    id: string
    name: string
    email: string
    phone: string
    stage: string
    status: DealStatus
    priority: string
    startDate: string
    endDate: string
    value: number
    margin: number
    notes: string
    assigneeId: string | null
    contactId: string | null
    tags: string[]
    expenses?: {
        monthlyCost: number
        cleaningFee: number
        otherFee: number
        deposit: number
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

export type MarketingTier = "none" | "basic" | "pro"

export interface WorkspaceDoc {
    id: string
    name: string
    slug: string
    ownerId: string
    plan: string
    status: string
    memberCount: number
    contactCount: number
    email_credit_balance: number
    marketing_tier: MarketingTier
    createdAt: Date | string
    updatedAt: Date | string
}

export type ActivitySource = "ses" | "zernio" | "system"

export type ActivityType =
    | "email_sent"
    | "email_bounced"
    | "email_opened"
    | "email_clicked"
    | "social_post_scheduled"
    | "social_post_published"
    | "social_post_failed"
    | "social_post_canceled"

export interface Activity {
    id: string
    workspaceId: string
    type: ActivityType
    source: ActivitySource
    contactId?: string | null
    subject: string
    body?: string
    metadata?: Record<string, unknown>
    sourceRef?: string
    createdAt: string
}

export type EmailLogStatus = "sent" | "bounced" | "complained" | "failed" | "delivered"

export interface EmailLog {
    id: string
    workspaceId: string
    campaignId?: string | null
    contactId?: string | null
    to: string
    fromAddress: string
    subject: string
    messageId?: string
    status: EmailLogStatus
    errorMessage?: string
    sentAt: string
    deliveredAt?: string
    bouncedAt?: string
    openedAt?: string
    clickedAt?: string
}

export interface EmailTemplate {
    id: string
    workspaceId: string
    name: string
    description?: string
    subject: string
    /**
     * Drag-and-drop editor project state (GrapesJS ProjectData). Null for
     * templates created by pasting raw HTML. Older templates stored this
     * under `topolJson`; readers fall back to that if `designJson` is absent.
     */
    designJson: Record<string, unknown> | null
    renderedHtml: string
    createdBy: string | null
    createdAt: string
    updatedAt: string
}

export type CampaignAudienceType = "all_contacts" | "by_tag" | "by_ids" | "by_list"

export interface ContactList {
    id: string
    workspaceId: string
    name: string
    description?: string
    /** Static = manual member management. Smart = rules evaluated live. */
    type: "static" | "smart"
    /** Cached count updated on add/remove. Refreshed via countMembers() when needed. */
    contactCount: number
    /** For smart segments: rules to evaluate at read time. */
    rules?: SegmentRule[]
    /** "and" = all rules must match. "or" = any rule matches. */
    combinator?: "and" | "or"
    createdBy: string | null
    createdAt: string
    updatedAt: string
}

/**
 * One condition in a smart segment. Rules are AND-combined by default.
 * The evaluator handles each `field` type separately — see
 * src/lib/lists/segments.ts.
 */
export type SegmentRule =
    | { field: "tag"; op: "has" | "not_has"; value: string /* tagId */ }
    | { field: "list"; op: "on" | "not_on"; value: string /* listId */ }
    | { field: "status"; op: "is" | "is_not"; value: string }
    | { field: "email"; op: "exists" | "not_exists" }
    | {
          field: "engagement"
          op: "opened" | "clicked" | "not_opened"
          /** Campaign id, or "any" for any campaign. */
          value: string
          /** Look-back window in days. Defaults to 90. */
          daysWindow?: number
      }
    | { field: "created"; op: "before" | "after"; value: string /* ISO date */ }

export type CampaignStatus =
    | "draft"
    | "scheduled"
    | "sending"
    | "sent"
    | "sent_with_errors"
    | "failed"
    | "canceled"

/**
 * A/B test configuration for a campaign. Splits the audience into a small
 * test pool, sends each subject variant to half of it, picks a winner based
 * on `metric` after `testDurationHours`, then sends the winner to the rest.
 */
export interface CampaignABTest {
    enabled: boolean
    /** Two subject lines to test. */
    variants: [string, string]
    /**
     * Optional: two HTML bodies to test alongside the subjects. When omitted,
     * both variants share the campaign's main `renderedHtml` and only the
     * subject differs. When provided, variantIdx N uses bodyVariants[N].
     */
    bodyVariants?: [string, string]
    /** Pick winner by which metric. */
    metric: "opens" | "clicks"
    /** Percent of audience used for the test pool (10-50). The remainder gets the winner. */
    testPercentage: number
    /** Hours to wait after the initial send before measuring + sending winner. */
    testDurationHours: number
    /** Set when the winner has been picked + the remainder sent. */
    winnerVariant?: 0 | 1
    /** When the winner was selected. */
    winnerSelectedAt?: string
    /** Per-variant counters captured at winner-selection time. */
    variantStats?: Array<{
        sent: number
        opens: number
        clicks: number
    }>
}

export interface EmailCampaign {
    id: string
    workspaceId: string
    name: string
    subject: string
    templateId: string | null
    renderedHtml: string
    audienceType: CampaignAudienceType
    /**
     * For audienceType === "by_tag": array of tag names (max 10).
     * For audienceType === "by_list": array of contact_lists IDs to INCLUDE.
     * For audienceType === "by_ids": array of specific contact IDs.
     */
    audienceValue: string[] | null
    /** Optional: contact_lists IDs whose members to EXCLUDE from the send. */
    excludeListIds?: string[] | null
    status: CampaignStatus
    scheduledAt?: string
    stats: {
        targeted: number
        sent: number
        failed: number
        skipped: number
    }
    /** Optional A/B subject test config. */
    abTest?: CampaignABTest
    createdBy: string | null
    createdAt: string
    updatedAt: string
    sentAt?: string
}

export type SocialPlatform =
    | "facebook"
    | "instagram"
    | "twitter"
    | "linkedin"
    | "tiktok"
    | "pinterest"
    | "youtube"
    | "threads"

export interface SocialAccount {
    platform: SocialPlatform
    handle: string
    externalId: string
    connectedAt: string
}

export interface SocialConnection {
    id: string
    workspaceId: string
    zernioAccountId: string
    accounts: SocialAccount[]
    connectedAt: string
    updatedAt: string
}

export type SocialPostStatus =
    | "draft"
    | "scheduled"
    | "publishing"
    | "published"
    | "failed"
    | "canceled"

export interface SocialPost {
    id: string
    workspaceId: string
    zernioPostId: string | null
    platforms: SocialPlatform[]
    content: string
    mediaUrls: string[]
    scheduledAt: string | null
    publishedAt: string | null
    status: SocialPostStatus
    contactId: string | null
    errorMessage: string | null
    zernioAccountId: string | null
    createdBy: string | null
    createdAt: string
    updatedAt: string
}

export type CreditLedgerReason = "send" | "reserve" | "refund" | "topup" | "grant" | "adjust"

export interface CreditLedgerEntry {
    id: string
    workspaceId: string
    delta: number
    balanceAfter: number
    reason: CreditLedgerReason
    refId?: string
    note?: string
    createdAt: string
}
