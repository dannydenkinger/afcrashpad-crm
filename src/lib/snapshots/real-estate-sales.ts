import type { Snapshot } from "./types"

/**
 * Real Estate Sales — residential brokerage. Distinct from the rental
 * snapshot: this one's lifecycle ends at closing, not at lease signing,
 * and tracks commission + listing data instead of move-in fees.
 */
export const REAL_ESTATE_SALES_SNAPSHOT: Snapshot = {
    slug: "real-estate-sales",
    name: "Real Estate Sales",
    description:
        "Residential brokerage — buyer/seller leads through showings, offers, contract, and close.",
    category: "Real Estate",
    pipelines: [
        {
            name: "Buyer Pipeline",
            stages: [
                { name: "New Lead", order: 0, probability: 10 },
                { name: "Showing Scheduled", order: 1, probability: 25 },
                { name: "Showing Complete", order: 2, probability: 40 },
                { name: "Offer Made", order: 3, probability: 60 },
                { name: "Under Contract", order: 4, probability: 80 },
                { name: "Closed Won", order: 5, probability: 100 },
                { name: "Closed Lost", order: 6, probability: 0 },
            ],
        },
        {
            name: "Seller Pipeline",
            stages: [
                { name: "Lead", order: 0, probability: 10 },
                { name: "Listing Appointment", order: 1, probability: 30 },
                { name: "Listed", order: 2, probability: 60 },
                { name: "Offer Received", order: 3, probability: 75 },
                { name: "Under Contract", order: 4, probability: 90 },
                { name: "Closed Won", order: 5, probability: 100 },
                { name: "Withdrawn / Expired", order: 6, probability: 0 },
            ],
        },
    ],
    tags: ["Hot Buyer", "Hot Seller", "Cash Buyer", "First-Time Buyer", "Investor", "Referral", "Sphere"],
    leadSources: ["Zillow", "Realtor.com", "Open House", "Referral", "Past Client", "Sign Call", "Website", "Social Media", "Other"],
    statuses: [
        { name: "Lead", order: 0, color: "#3b82f6" },
        { name: "Active Buyer", order: 1, color: "#22c55e" },
        { name: "Active Seller", order: 2, color: "#a855f7" },
        { name: "Past Client", order: 3, color: "#6b7280" },
        { name: "Sphere of Influence", order: 4, color: "#f59e0b" },
        { name: "Do Not Contact", order: 5, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Property Address", key: "property_address", type: "text" },
        { entity: "opportunity", name: "List Price", key: "list_price", type: "number" },
        { entity: "opportunity", name: "Sale Price", key: "sale_price", type: "number" },
        { entity: "opportunity", name: "Commission %", key: "commission_pct", type: "number" },
        { entity: "opportunity", name: "MLS Number", key: "mls_number", type: "text" },
        { entity: "opportunity", name: "Closing Date", key: "closing_date", type: "date" },
        { entity: "contact", name: "Buyer or Seller", key: "buyer_or_seller", type: "select", options: ["Buyer", "Seller", "Both"] },
        { entity: "contact", name: "Pre-Approval Amount", key: "preapproval_amount", type: "number" },
        { entity: "contact", name: "Bedrooms Wanted", key: "bedrooms_wanted", type: "number" },
        { entity: "contact", name: "Target Neighborhoods", key: "target_neighborhoods", type: "text" },
    ],
}
