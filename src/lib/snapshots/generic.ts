import type { Snapshot } from "./types"

/**
 * Generic CRM snapshot — neutral language, works for almost any business.
 * This is the default for new workspaces and what the strip-real-estate
 * refactor produces.
 */
export const GENERIC_SNAPSHOT: Snapshot = {
    slug: "generic",
    name: "Generic CRM",
    description:
        "Industry-agnostic baseline: leads → qualified → proposal → negotiation → closed. Use this if no other template fits.",
    category: "Generic",
    pipelines: [
        {
            name: "Sales Pipeline",
            stages: [
                { name: "New Lead", order: 0, probability: 10 },
                { name: "Contacted", order: 1, probability: 20 },
                { name: "Qualified", order: 2, probability: 40 },
                { name: "Proposal Sent", order: 3, probability: 60 },
                { name: "Negotiation", order: 4, probability: 80 },
                { name: "Closed Won", order: 5, probability: 100 },
                { name: "Closed Lost", order: 6, probability: 0 },
            ],
        },
    ],
    tags: ["Hot Lead", "Referral", "VIP", "Follow Up"],
    leadSources: [
        "Website",
        "Referral",
        "Social Media",
        "Cold Call",
        "Email Campaign",
        "Walk-in",
        "Other",
    ],
    statuses: [
        { name: "Lead", order: 0, color: "#3b82f6" },
        { name: "Customer", order: 1, color: "#22c55e" },
        { name: "Past Customer", order: 2, color: "#6b7280" },
        { name: "Do Not Contact", order: 3, color: "#ef4444" },
    ],
    customFields: [],
}
