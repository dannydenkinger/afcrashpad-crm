import type { Snapshot } from "./types"

/**
 * B2B SaaS Sales — the "founder selling" or early-stage AE flow. MQL/SQL
 * vocabulary, demo-to-POC-to-procurement, ARR-driven economics.
 */
export const B2B_SAAS_SNAPSHOT: Snapshot = {
    slug: "b2b-saas",
    name: "B2B SaaS Sales",
    description:
        "Software sales — MQL through demo, POC, procurement, and onboarding with ARR tracking.",
    category: "Services",
    pipelines: [
        {
            name: "Sales Pipeline",
            stages: [
                { name: "MQL", order: 0, probability: 5 },
                { name: "SQL", order: 1, probability: 15 },
                { name: "Demo Scheduled", order: 2, probability: 30 },
                { name: "Demo Complete", order: 3, probability: 45 },
                { name: "POC / Trial", order: 4, probability: 60 },
                { name: "Negotiation", order: 5, probability: 75 },
                { name: "Procurement / Legal", order: 6, probability: 90 },
                { name: "Closed Won", order: 7, probability: 100 },
                { name: "Closed Lost", order: 8, probability: 0 },
            ],
        },
        {
            name: "Expansion Pipeline",
            stages: [
                { name: "Renewal Identified", order: 0, probability: 70 },
                { name: "Expansion Discussion", order: 1, probability: 50 },
                { name: "Upsell Proposed", order: 2, probability: 65 },
                { name: "Closed Won", order: 3, probability: 100 },
                { name: "Renewed (Flat)", order: 4, probability: 100 },
                { name: "Churned", order: 5, probability: 0 },
            ],
        },
    ],
    tags: ["Champion Identified", "Procurement Hold", "Security Review", "Multi-Year", "Expansion Ready", "At-Risk"],
    leadSources: ["Inbound Demo", "Outbound", "LinkedIn", "Conference", "Webinar", "Customer Referral", "Partner Referral", "Content", "Cold Email", "Other"],
    statuses: [
        { name: "Lead", order: 0, color: "#3b82f6" },
        { name: "Active Customer", order: 1, color: "#22c55e" },
        { name: "Trial Customer", order: 2, color: "#a855f7" },
        { name: "Churned", order: 3, color: "#6b7280" },
        { name: "Do Not Contact", order: 4, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Annual Contract Value", key: "acv", type: "number" },
        { entity: "opportunity", name: "Seats", key: "seats", type: "number" },
        { entity: "opportunity", name: "Contract Length (months)", key: "contract_months", type: "number" },
        { entity: "opportunity", name: "Plan Tier", key: "plan_tier", type: "select", options: ["Starter", "Pro", "Business", "Enterprise", "Custom"] },
        { entity: "opportunity", name: "Decision Maker", key: "decision_maker", type: "text" },
        { entity: "opportunity", name: "Champion", key: "champion", type: "text" },
        { entity: "opportunity", name: "Close Date", key: "close_date", type: "date" },
        { entity: "contact", name: "Company", key: "company", type: "text" },
        { entity: "contact", name: "Title", key: "title", type: "text" },
        { entity: "contact", name: "Company Size", key: "company_size", type: "select", options: ["1-10", "11-50", "51-200", "201-1000", "1000+"] },
        { entity: "contact", name: "Industry", key: "industry", type: "text" },
    ],
}
