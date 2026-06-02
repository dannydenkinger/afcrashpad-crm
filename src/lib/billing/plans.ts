/**
 * Subscription plan definitions, limits, and feature gates.
 *
 * Plans are stored on the workspace doc:
 *   workspaces.<id>.plan           — "free" | "pro" | "max"
 *   workspaces.<id>.planStatus     — "active" | "past_due" | "canceled" | "trialing"
 *   workspaces.<id>.planExpiresAt  — ISO timestamp of period end (subscription only)
 *   workspaces.<id>.extraSeats     — number of additional paid seats above the base
 *   workspaces.<id>.stripeSubscriptionId
 *
 * A workspace without a `plan` field defaults to "free". Existing
 * workspaces created before subscriptions launched fall into this bucket
 * automatically — no migration needed.
 *
 * When a paid plan lapses (`past_due` for >14 days or `canceled`),
 * features above the free tier soft-revoke: the UI shows a banner and
 * any feature-gated action returns the upgrade prompt instead of acting.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type PlanTier = "free" | "pro" | "max"
export type PlanStatus = "active" | "past_due" | "canceled" | "trialing" | "inactive"

export interface PlanLimits {
    seatsIncluded: number
    workspacesIncluded: number
    contactsCap: number | null // null = unlimited
    pipelinesCap: number | null
    customFieldsCap: number | null
    monthlyCredits: number
    formsCap: number | null
    bookingPagesCap: number | null
    storageGB: number
    auditLogRetentionDays: number | null // null = unlimited
}

export interface PlanFeatures {
    automations: boolean
    emailMarketing: boolean
    aiInlineWrite: boolean
    aiBlogGeneration: boolean
    aiAssistant: boolean
    documentsAndEsign: boolean
    seoModule: boolean
    socialPlanner: boolean
    haro: boolean
    finance: boolean
    reputation: boolean
    customDomainForms: boolean
    whiteLabel: boolean
    multipleWorkspaces: boolean
    granularPermissions: boolean
    apiAccess: boolean
    webhooks: boolean
    prioritySupport: boolean
}

export interface PlanDef {
    tier: PlanTier
    name: string
    monthlyCents: number
    yearlyCents: number
    extraSeatCents: number
    extraWorkspaceCents: number | null
    limits: PlanLimits
    features: PlanFeatures
    tagline: string
    description: string
}

export const PLANS: Record<PlanTier, PlanDef> = {
    free: {
        tier: "free",
        name: "Free",
        monthlyCents: 0,
        yearlyCents: 0,
        extraSeatCents: 0,
        extraWorkspaceCents: null,
        limits: {
            seatsIncluded: 1,
            workspacesIncluded: 1,
            contactsCap: 1000,
            pipelinesCap: 1,
            customFieldsCap: 3,
            monthlyCredits: 100,
            formsCap: 1,
            bookingPagesCap: 1,
            storageGB: 0.1,
            auditLogRetentionDays: 0,
        },
        features: {
            automations: false,
            emailMarketing: false,
            aiInlineWrite: false,
            aiBlogGeneration: false,
            aiAssistant: false,
            documentsAndEsign: false,
            seoModule: false,
            socialPlanner: false,
            haro: false,
            finance: false,
            reputation: false,
            customDomainForms: false,
            whiteLabel: false,
            multipleWorkspaces: false,
            granularPermissions: false,
            apiAccess: false,
            webhooks: false,
            prioritySupport: false,
        },
        tagline: "Try Vesta with no time limit",
        description: "Solo plan for trying the workflow before you commit. 1 seat, 1,000 contacts, all the table-stakes CRM features.",
    },
    pro: {
        tier: "pro",
        name: "Pro",
        monthlyCents: 2900,
        yearlyCents: 29000,
        extraSeatCents: 1200,
        extraWorkspaceCents: null,
        limits: {
            seatsIncluded: 3,
            workspacesIncluded: 1,
            contactsCap: null,
            pipelinesCap: 5,
            customFieldsCap: null,
            monthlyCredits: 2500,
            formsCap: 10,
            bookingPagesCap: 10,
            storageGB: 25,
            auditLogRetentionDays: 90,
        },
        features: {
            automations: true,
            emailMarketing: true,
            aiInlineWrite: true,
            aiBlogGeneration: false,
            aiAssistant: true,
            documentsAndEsign: true,
            seoModule: false,
            socialPlanner: true,
            haro: false,
            finance: true,
            reputation: true,
            customDomainForms: true,
            whiteLabel: false,
            multipleWorkspaces: false,
            granularPermissions: false,
            apiAccess: true,
            webhooks: true,
            prioritySupport: false,
        },
        tagline: "Most teams pick this",
        description: "Unlocks automations, AI features, marketing, e-sign, finance — everything a real sales team uses daily. 3 seats included.",
    },
    max: {
        tier: "max",
        name: "Max",
        monthlyCents: 9900,
        yearlyCents: 99000,
        extraSeatCents: 1900,
        extraWorkspaceCents: 2900,
        limits: {
            seatsIncluded: 10,
            workspacesIncluded: 5,
            contactsCap: null,
            pipelinesCap: null,
            customFieldsCap: null,
            monthlyCredits: 25000,
            formsCap: null,
            bookingPagesCap: null,
            storageGB: 250,
            auditLogRetentionDays: null,
        },
        features: {
            automations: true,
            emailMarketing: true,
            aiInlineWrite: true,
            aiBlogGeneration: true,
            aiAssistant: true,
            documentsAndEsign: true,
            seoModule: true,
            socialPlanner: true,
            haro: true,
            finance: true,
            reputation: true,
            customDomainForms: true,
            whiteLabel: true,
            multipleWorkspaces: true,
            granularPermissions: true,
            apiAccess: true,
            webhooks: true,
            prioritySupport: true,
        },
        tagline: "Agencies and growing teams",
        description: "Everything in Pro, plus SEO, blog AI, HARO, white-label, multiple sub-workspaces, granular permissions, and priority support.",
    },
}

export type FeatureKey = keyof PlanFeatures
export type LimitKey = keyof PlanLimits

export interface WorkspacePlanState {
    tier: PlanTier
    status: PlanStatus
    expiresAt: string | null
    extraSeats: number
    stripeSubscriptionId: string | null
}

export class PlanNotAllowedError extends Error {
    constructor(
        public required: PlanTier,
        public current: PlanTier,
        public feature?: string,
    ) {
        super(
            feature
                ? `${feature} requires the ${PLANS[required].name} plan. Current plan: ${PLANS[current].name}.`
                : `This action requires the ${PLANS[required].name} plan. Current plan: ${PLANS[current].name}.`,
        )
        this.name = "PlanNotAllowedError"
    }
}

const TIER_ORDER: PlanTier[] = ["free", "pro", "max"]

/** True if `current` is at or above `required` in the plan ladder. */
export function meetsPlan(current: PlanTier, required: PlanTier): boolean {
    return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(required)
}

/** Lookup the minimum plan tier that has a given feature. */
export function minPlanForFeature(feature: FeatureKey): PlanTier {
    for (const tier of TIER_ORDER) {
        if (PLANS[tier].features[feature]) return tier
    }
    return "max"
}

/** True if the given plan tier includes a feature. */
export function hasFeature(tier: PlanTier, feature: FeatureKey): boolean {
    return PLANS[tier].features[feature]
}

/** Total seats allowed for a workspace given its plan + paid extras. */
export function seatLimit(tier: PlanTier, extraSeats: number): number {
    return PLANS[tier].limits.seatsIncluded + Math.max(0, extraSeats)
}
