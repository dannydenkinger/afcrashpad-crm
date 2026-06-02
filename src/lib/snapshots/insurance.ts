import type { Snapshot } from "./types"

/**
 * Insurance Agency — independent or captive agents. Renewal cycle is
 * core: every policy needs annual touchpoints, so the lifecycle goes
 * Quote → Bound → Renewal Due in a loop.
 */
export const INSURANCE_SNAPSHOT: Snapshot = {
    slug: "insurance",
    name: "Insurance Agency",
    description:
        "Independent insurance agencies — quotes, bound policies, renewals, and cross-sell across lines.",
    category: "Services",
    pipelines: [
        {
            name: "New Business Pipeline",
            stages: [
                { name: "Quote Requested", order: 0, probability: 15 },
                { name: "Quoted", order: 1, probability: 30 },
                { name: "Application Submitted", order: 2, probability: 55 },
                { name: "Underwriting", order: 3, probability: 75 },
                { name: "Bound", order: 4, probability: 100 },
                { name: "Closed Lost", order: 5, probability: 0 },
            ],
        },
        {
            name: "Renewal Pipeline",
            stages: [
                { name: "Renewal Due (60 day)", order: 0, probability: 80 },
                { name: "Renewal Quoted", order: 1, probability: 90 },
                { name: "Renewed", order: 2, probability: 100 },
                { name: "Lapsed", order: 3, probability: 0 },
            ],
        },
    ],
    tags: ["High Premium", "Multi-Policy", "Referral Source", "Cross-Sell Opportunity", "VIP", "Claims Active"],
    leadSources: ["Website", "Referral", "Cross-Sell", "Cold Call", "Direct Mail", "Existing Client", "Aggregator", "Other"],
    statuses: [
        { name: "Prospect", order: 0, color: "#3b82f6" },
        { name: "Active Client", order: 1, color: "#22c55e" },
        { name: "Lapsed Client", order: 2, color: "#f59e0b" },
        { name: "Past Client", order: 3, color: "#6b7280" },
        { name: "Do Not Contact", order: 4, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Policy Type", key: "policy_type", type: "select", options: ["Auto", "Home", "Life", "Health", "Commercial", "Umbrella", "Renters", "Bundle"] },
        { entity: "opportunity", name: "Carrier", key: "carrier", type: "text" },
        { entity: "opportunity", name: "Annual Premium", key: "annual_premium", type: "number" },
        { entity: "opportunity", name: "Effective Date", key: "effective_date", type: "date" },
        { entity: "opportunity", name: "Expiration Date", key: "expiration_date", type: "date" },
        { entity: "opportunity", name: "Policy Number", key: "policy_number", type: "text" },
        { entity: "contact", name: "Date of Birth", key: "dob", type: "date" },
        { entity: "contact", name: "Spouse Name", key: "spouse_name", type: "text" },
        { entity: "contact", name: "Number of Dependents", key: "dependents", type: "number" },
    ],
}
