import type { Snapshot } from "./types"

/**
 * Law Firm — intake-to-closed-matter lifecycle, supports flat-fee,
 * hourly, and contingency fee structures. Conflict-checking and
 * engagement letters are mentioned via custom fields, not workflows.
 */
export const LAW_FIRM_SNAPSHOT: Snapshot = {
    slug: "law-firm",
    name: "Law Firm",
    description:
        "Intake through closed matter — supports flat fee, hourly billable, and contingency engagements.",
    category: "Services",
    pipelines: [
        {
            name: "Matter Pipeline",
            stages: [
                { name: "Intake", order: 0, probability: 20 },
                { name: "Conflict Check", order: 1, probability: 30 },
                { name: "Consultation Scheduled", order: 2, probability: 45 },
                { name: "Consultation Complete", order: 3, probability: 60 },
                { name: "Engagement Letter Sent", order: 4, probability: 75 },
                { name: "Active Matter", order: 5, probability: 100 },
                { name: "Closed", order: 6, probability: 100 },
                { name: "Declined", order: 7, probability: 0 },
            ],
        },
    ],
    tags: ["Hot Lead", "Referral Source", "Repeat Client", "Pro Bono", "Contingency", "Conflict Cleared"],
    leadSources: ["Referral", "Google Search", "Avvo", "Existing Client", "LinkedIn", "Bar Association", "Networking", "Other"],
    statuses: [
        { name: "Prospective Client", order: 0, color: "#3b82f6" },
        { name: "Active Client", order: 1, color: "#22c55e" },
        { name: "Past Client", order: 2, color: "#6b7280" },
        { name: "Conflict — Decline", order: 3, color: "#f59e0b" },
        { name: "Do Not Contact", order: 4, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Matter Type", key: "matter_type", type: "select", options: ["Family", "Personal Injury", "Estate Planning", "Criminal", "Business", "Real Estate", "Immigration", "Employment", "IP", "Other"] },
        { entity: "opportunity", name: "Fee Structure", key: "fee_structure", type: "select", options: ["Flat Fee", "Hourly", "Contingency", "Hybrid", "Retainer"] },
        { entity: "opportunity", name: "Hourly Rate", key: "hourly_rate", type: "number" },
        { entity: "opportunity", name: "Estimated Value", key: "estimated_value", type: "number" },
        { entity: "opportunity", name: "Opposing Party", key: "opposing_party", type: "text" },
        { entity: "opportunity", name: "Court / Jurisdiction", key: "jurisdiction", type: "text" },
        { entity: "opportunity", name: "Statute of Limitations", key: "sol_date", type: "date" },
        { entity: "contact", name: "Date of Birth", key: "dob", type: "date" },
        { entity: "contact", name: "Conflict Check Status", key: "conflict_check", type: "select", options: ["Pending", "Cleared", "Conflict — Cannot Represent"] },
    ],
}
