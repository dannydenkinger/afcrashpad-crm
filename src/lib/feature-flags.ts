/**
 * Feature flags for optional CRM modules.
 *
 * All features default to ON. Set the corresponding env var to "false" to disable.
 * Example: NEXT_PUBLIC_FEATURE_MARKETING=false
 *
 * These are evaluated at build time for NEXT_PUBLIC_ vars (static) and can also
 * be overridden at runtime via database settings in the future.
 */

export const FEATURES = {
    /** Marketing module: blog, SEO, HARO, analytics dashboard */
    MARKETING: process.env.NEXT_PUBLIC_FEATURE_MARKETING !== "false",

    /** Finance module: commissions, referrals */
    FINANCE: process.env.NEXT_PUBLIC_FEATURE_FINANCE !== "false",

    /** Document management and e-signatures */
    DOCUMENTS: process.env.NEXT_PUBLIC_FEATURE_DOCUMENTS !== "false",

    /** Automated email sequences */
    EMAIL_SEQUENCES: process.env.NEXT_PUBLIC_FEATURE_EMAIL_SEQUENCES !== "false",

    /** Google Calendar integration */
    GOOGLE_CALENDAR: process.env.NEXT_PUBLIC_FEATURE_CALENDAR !== "false",

    /** Push notifications via Firebase Cloud Messaging */
    PUSH_NOTIFICATIONS: process.env.NEXT_PUBLIC_FEATURE_PUSH !== "false",
} as const

export type FeatureKey = keyof typeof FEATURES
