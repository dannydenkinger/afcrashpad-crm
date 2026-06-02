import type { Snapshot } from "./types"

/**
 * Construction / General Contractor — long-cycle project work. Differs
 * from Home Services in scale and timeline: estimates can take weeks,
 * projects months. Punch lists and final payments matter.
 */
export const CONSTRUCTION_SNAPSHOT: Snapshot = {
    slug: "construction",
    name: "Construction / General Contractor",
    description:
        "GCs and remodelers — long-cycle project lifecycle from site visit through punch list and final payment.",
    category: "Services",
    pipelines: [
        {
            name: "Project Pipeline",
            stages: [
                { name: "Lead", order: 0, probability: 10 },
                { name: "Site Visit Scheduled", order: 1, probability: 25 },
                { name: "Site Visit Complete", order: 2, probability: 40 },
                { name: "Estimate Sent", order: 3, probability: 55 },
                { name: "Contract Signed", order: 4, probability: 80 },
                { name: "In Progress", order: 5, probability: 90 },
                { name: "Punch List", order: 6, probability: 95 },
                { name: "Final Payment", order: 7, probability: 100 },
                { name: "Closed Lost", order: 8, probability: 0 },
            ],
        },
    ],
    tags: ["Hot Lead", "Permit Required", "Subcontractor Heavy", "Repeat Client", "Architect Referral", "Slow Pay"],
    leadSources: ["Referral", "Website", "Houzz", "Angi", "Architect", "Google Search", "Yard Sign", "Trade Show", "Past Client", "Other"],
    statuses: [
        { name: "Lead", order: 0, color: "#3b82f6" },
        { name: "Active Project", order: 1, color: "#22c55e" },
        { name: "Past Client", order: 2, color: "#6b7280" },
        { name: "Architect / Designer", order: 3, color: "#a855f7" },
        { name: "Subcontractor", order: 4, color: "#0ea5e9" },
        { name: "Do Not Contact", order: 5, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Project Type", key: "project_type", type: "select", options: ["New Build", "Addition", "Whole-Home Remodel", "Kitchen", "Bath", "Basement", "Outdoor", "Commercial", "Other"] },
        { entity: "opportunity", name: "Project Address", key: "project_address", type: "text" },
        { entity: "opportunity", name: "Square Footage", key: "square_footage", type: "number" },
        { entity: "opportunity", name: "Estimated Cost", key: "estimated_cost", type: "number" },
        { entity: "opportunity", name: "Final Contract Amount", key: "contract_amount", type: "number" },
        { entity: "opportunity", name: "Start Date", key: "start_date", type: "date" },
        { entity: "opportunity", name: "Substantial Completion", key: "substantial_completion", type: "date" },
        { entity: "opportunity", name: "Permit Number", key: "permit_number", type: "text" },
        { entity: "contact", name: "Architect / Designer", key: "architect", type: "text" },
        { entity: "contact", name: "Property Type", key: "property_type", type: "select", options: ["Single Family", "Multi-Family", "Commercial", "Mixed-Use"] },
    ],
}
