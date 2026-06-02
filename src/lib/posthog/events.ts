/**
 * Canonical event names + their property shapes for Vesta product
 * analytics. Anything tracked through PostHog should be declared here
 * so we don't accidentally proliferate event names with typos.
 *
 * v1 — onboarding funnel:
 *   signup_started, signup_completed, setup_completed,
 *   first_contact_created, first_deal_created, first_email_sent,
 *   first_automation_created
 *
 * v2 — billing funnel + feature adoption + health signals:
 *   pricing_page_viewed, upgrade_clicked, checkout_started,
 *   checkout_completed, customer_portal_opened, plan_changed,
 *   subscription_canceled,
 *   ai_write_used, csv_import_completed, contact_merged,
 *   document_signed, automation_published, feedback_submitted
 */

export type PlanTierProp = "free" | "pro" | "max"
export type CadenceProp = "monthly" | "yearly"

export type VestaEvent =
    // v1 — onboarding
    | { name: "signup_started"; props?: { plan_intent?: PlanTierProp | null } }
    | { name: "signup_completed"; props?: { plan_intent?: PlanTierProp | null } }
    | { name: "setup_completed"; props: { path: "demo" | "fresh" } }
    | { name: "first_contact_created"; props?: Record<string, never> }
    | { name: "first_deal_created"; props?: Record<string, never> }
    | { name: "first_email_sent"; props?: Record<string, never> }
    | { name: "first_automation_created"; props?: Record<string, never> }
    // v2 — billing funnel
    | { name: "pricing_page_viewed"; props?: Record<string, never> }
    | { name: "upgrade_clicked"; props: { from_tier: PlanTierProp; to_tier: PlanTierProp; cadence: CadenceProp } }
    | { name: "checkout_started"; props: { tier: PlanTierProp; cadence: CadenceProp } }
    | { name: "checkout_completed"; props: { tier: PlanTierProp; cadence: CadenceProp } }
    | { name: "customer_portal_opened"; props?: Record<string, never> }
    | { name: "plan_changed"; props: { from_tier: PlanTierProp; to_tier: PlanTierProp; status: string } }
    | { name: "subscription_canceled"; props: { tier: PlanTierProp } }
    // v2 — feature adoption
    | { name: "ai_write_used"; props: { feature: "inline_email_writer" | "inline_sms_writer" | "subject_line" } }
    | { name: "csv_import_completed"; props: { created: number; restored: number; skipped: number } }
    | { name: "contact_merged"; props: { merged_count: number } }
    | { name: "document_signed"; props?: Record<string, never> }
    | { name: "automation_published"; props?: Record<string, never> }
    // v2 — health signals
    | { name: "feedback_submitted"; props: { kind: "bug" | "idea" | "other" } }

export type VestaEventName = VestaEvent["name"]
