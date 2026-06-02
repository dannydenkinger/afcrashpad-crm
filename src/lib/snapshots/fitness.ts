import type { Snapshot } from "./types"

/**
 * Gym / Fitness Studio — trial-driven membership funnel. Membership
 * status (active, frozen, cancelled) is core, so it gets surfaced as
 * a contact status rather than buried in opportunity data.
 */
export const FITNESS_SNAPSHOT: Snapshot = {
    slug: "fitness",
    name: "Gym / Fitness Studio",
    description:
        "Boutique gyms, yoga studios, CrossFit, personal training — trial-to-membership lifecycle with retention loops.",
    category: "Services",
    pipelines: [
        {
            name: "Membership Pipeline",
            stages: [
                { name: "Trial Lead", order: 0, probability: 20 },
                { name: "Trial Booked", order: 1, probability: 50 },
                { name: "Trial Completed", order: 2, probability: 65 },
                { name: "Member", order: 3, probability: 100 },
                { name: "At-Risk", order: 4, probability: 60 },
                { name: "Cancelled", order: 5, probability: 0 },
            ],
        },
    ],
    tags: ["Hot Lead", "Reactivation", "Referrer", "Premium Tier", "Personal Training", "Class Pack", "First-Year Member"],
    leadSources: ["Walk-In", "Website", "Instagram", "Facebook Ads", "Google Search", "Friend Referral", "Class Pass", "Yelp", "Other"],
    statuses: [
        { name: "Trial / Lead", order: 0, color: "#3b82f6" },
        { name: "Active Member", order: 1, color: "#22c55e" },
        { name: "Frozen Member", order: 2, color: "#a855f7" },
        { name: "Cancelled", order: 3, color: "#6b7280" },
        { name: "Banned", order: 4, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Membership Tier", key: "membership_tier", type: "select", options: ["Basic", "Standard", "Premium", "Family", "Class Pack", "Drop-In", "PT Add-On"] },
        { entity: "opportunity", name: "Monthly Rate", key: "monthly_rate", type: "number" },
        { entity: "opportunity", name: "Start Date", key: "start_date", type: "date" },
        { entity: "opportunity", name: "Contract Length (months)", key: "contract_length", type: "number" },
        { entity: "opportunity", name: "Payment Method", key: "payment_method", type: "select", options: ["Auto-Bank", "Credit Card", "Paid in Full", "Pre-Paid Pack"] },
        { entity: "contact", name: "Goals", key: "fitness_goals", type: "text", description: "Weight loss, strength, etc." },
        { entity: "contact", name: "Last Visit", key: "last_visit", type: "date" },
        { entity: "contact", name: "Visits This Month", key: "visits_this_month", type: "number" },
        { entity: "contact", name: "Frozen Until", key: "frozen_until", type: "date" },
    ],
}
