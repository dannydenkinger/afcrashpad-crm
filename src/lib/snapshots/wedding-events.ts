import type { Snapshot } from "./types"

/**
 * Wedding / Event Planning — venue date drives the entire pipeline.
 * Stages collapse to "before" (sales) and "after" (post-event review/
 * referral). Custom fields capture the variables every contract needs.
 */
export const WEDDING_EVENTS_SNAPSHOT: Snapshot = {
    slug: "wedding-events",
    name: "Wedding & Event Planning",
    description:
        "Wedding planners, venues, photographers, caterers — inquiry through booked event and post-event referral loop.",
    category: "Services",
    pipelines: [
        {
            name: "Event Pipeline",
            stages: [
                { name: "Inquiry", order: 0, probability: 15 },
                { name: "Consultation Scheduled", order: 1, probability: 35 },
                { name: "Proposal Sent", order: 2, probability: 55 },
                { name: "Booked", order: 3, probability: 100 },
                { name: "Event Complete", order: 4, probability: 100 },
                { name: "Closed Lost", order: 5, probability: 0 },
            ],
        },
    ],
    tags: ["Hot Lead", "Premium Budget", "Off-Season Date", "Referral", "Repeat Client", "Vendor Partner"],
    leadSources: ["Website", "The Knot", "Zola", "WeddingWire", "Instagram", "Pinterest", "Vendor Referral", "Past Client", "Other"],
    statuses: [
        { name: "Inquiry", order: 0, color: "#3b82f6" },
        { name: "Booked Event", order: 1, color: "#22c55e" },
        { name: "Past Client", order: 2, color: "#6b7280" },
        { name: "Vendor Partner", order: 3, color: "#a855f7" },
        { name: "Do Not Contact", order: 4, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Event Type", key: "event_type", type: "select", options: ["Wedding", "Engagement Party", "Corporate Event", "Birthday", "Anniversary", "Bar/Bat Mitzvah", "Quinceañera", "Other"] },
        { entity: "opportunity", name: "Event Date", key: "event_date", type: "date" },
        { entity: "opportunity", name: "Venue", key: "venue", type: "text" },
        { entity: "opportunity", name: "Guest Count", key: "guest_count", type: "number" },
        { entity: "opportunity", name: "Budget", key: "budget", type: "number" },
        { entity: "opportunity", name: "Package Tier", key: "package_tier", type: "select", options: ["Basic", "Standard", "Premium", "Custom"] },
        { entity: "opportunity", name: "Deposit Paid", key: "deposit_paid", type: "number" },
        { entity: "opportunity", name: "Final Balance Due", key: "balance_due", type: "date" },
        { entity: "contact", name: "Partner Name", key: "partner_name", type: "text" },
        { entity: "contact", name: "How They Heard", key: "referral_source", type: "text" },
    ],
}
