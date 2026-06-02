import type { Snapshot } from "./types"

/**
 * Financial Advisor / Wealth Management. Long discovery + onboarding
 * cycle, AUM-driven economics, annual review cadence built in.
 */
export const FINANCIAL_ADVISOR_SNAPSHOT: Snapshot = {
    slug: "financial-advisor",
    name: "Financial Advisor",
    description:
        "Wealth management and RIAs — prospect discovery, plan presentation, onboarding, and annual reviews.",
    category: "Services",
    pipelines: [
        {
            name: "New Client Pipeline",
            stages: [
                { name: "Prospect", order: 0, probability: 5 },
                { name: "Intro Call", order: 1, probability: 15 },
                { name: "Discovery Meeting", order: 2, probability: 35 },
                { name: "Plan Presented", order: 3, probability: 60 },
                { name: "Onboarding", order: 4, probability: 85 },
                { name: "Active Client", order: 5, probability: 100 },
                { name: "Closed Lost", order: 6, probability: 0 },
            ],
        },
    ],
    tags: ["High Net Worth", "Ultra HNW", "Pre-Retiree", "Retired", "Business Owner", "Inheritance", "Referral"],
    leadSources: ["Referral", "Centers of Influence", "Website", "Seminar", "LinkedIn", "Existing Client", "Other"],
    statuses: [
        { name: "Prospect", order: 0, color: "#3b82f6" },
        { name: "Active Client", order: 1, color: "#22c55e" },
        { name: "Past Client", order: 2, color: "#6b7280" },
        { name: "Center of Influence", order: 3, color: "#a855f7" },
        { name: "Do Not Contact", order: 4, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Estimated AUM", key: "estimated_aum", type: "number", description: "Assets under management at start" },
        { entity: "opportunity", name: "Account Type", key: "account_type", type: "select", options: ["Individual", "Joint", "Trust", "IRA", "Roth IRA", "401(k) Rollover", "Business"] },
        { entity: "opportunity", name: "Risk Tolerance", key: "risk_tolerance", type: "select", options: ["Conservative", "Moderate Conservative", "Moderate", "Moderate Aggressive", "Aggressive"] },
        { entity: "contact", name: "Date of Birth", key: "dob", type: "date" },
        { entity: "contact", name: "Spouse Name", key: "spouse_name", type: "text" },
        { entity: "contact", name: "Net Worth Estimate", key: "net_worth", type: "number" },
        { entity: "contact", name: "Annual Income", key: "annual_income", type: "number" },
        { entity: "contact", name: "Retirement Age Goal", key: "retirement_age", type: "number" },
        { entity: "contact", name: "Last Annual Review", key: "last_review_date", type: "date" },
    ],
}
