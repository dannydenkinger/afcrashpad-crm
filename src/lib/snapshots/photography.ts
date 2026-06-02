import type { Snapshot } from "./types"

/**
 * Photography / Creative Services — shoot-driven business: weddings,
 * portraits, brand work. Lifecycle: inquiry → consultation → booked →
 * shoot → delivery → review.
 */
export const PHOTOGRAPHY_SNAPSHOT: Snapshot = {
    slug: "photography",
    name: "Photography & Creative",
    description:
        "Photographers, videographers, designers — inquiry through consultation, booking, shoot day, and delivery.",
    category: "Services",
    pipelines: [
        {
            name: "Booking Pipeline",
            stages: [
                { name: "Inquiry", order: 0, probability: 15 },
                { name: "Consultation", order: 1, probability: 35 },
                { name: "Proposal Sent", order: 2, probability: 55 },
                { name: "Booked", order: 3, probability: 100 },
                { name: "Shoot Complete", order: 4, probability: 100 },
                { name: "Delivered", order: 5, probability: 100 },
                { name: "Closed Lost", order: 6, probability: 0 },
            ],
        },
    ],
    tags: ["Hot Lead", "Premium Package", "Repeat Client", "Vendor Partner", "Off-Season Date", "Portfolio Worthy"],
    leadSources: ["Website", "Instagram", "Pinterest", "Vendor Referral", "Past Client", "The Knot", "WeddingWire", "Google Search", "Other"],
    statuses: [
        { name: "Inquiry", order: 0, color: "#3b82f6" },
        { name: "Booked Client", order: 1, color: "#22c55e" },
        { name: "Past Client", order: 2, color: "#6b7280" },
        { name: "Vendor Partner", order: 3, color: "#a855f7" },
        { name: "Do Not Contact", order: 4, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Shoot Type", key: "shoot_type", type: "select", options: ["Wedding", "Engagement", "Portrait", "Family", "Brand", "Product", "Event", "Headshot", "Other"] },
        { entity: "opportunity", name: "Shoot Date", key: "shoot_date", type: "date" },
        { entity: "opportunity", name: "Shoot Location", key: "shoot_location", type: "text" },
        { entity: "opportunity", name: "Package", key: "package", type: "text" },
        { entity: "opportunity", name: "Package Price", key: "package_price", type: "number" },
        { entity: "opportunity", name: "Deposit Paid", key: "deposit_paid", type: "number" },
        { entity: "opportunity", name: "Delivery Deadline", key: "delivery_deadline", type: "date" },
        { entity: "opportunity", name: "Gallery URL", key: "gallery_url", type: "text" },
        { entity: "contact", name: "Partner Name", key: "partner_name", type: "text" },
        { entity: "contact", name: "Instagram Handle", key: "instagram_handle", type: "text" },
    ],
}
