import type { Snapshot } from "./types"

/**
 * Auto Sales / Dealership — used or new car retail. Test-drive-driven
 * funnel with financing and trade-in handoffs along the way.
 */
export const AUTO_SALES_SNAPSHOT: Snapshot = {
    slug: "auto-sales",
    name: "Auto Sales / Dealership",
    description:
        "New + used vehicle sales — lead through test drive, financing, and delivery.",
    category: "Services",
    pipelines: [
        {
            name: "Sales Pipeline",
            stages: [
                { name: "Lead", order: 0, probability: 10 },
                { name: "Showroom Visit", order: 1, probability: 25 },
                { name: "Test Drive", order: 2, probability: 45 },
                { name: "Negotiation", order: 3, probability: 65 },
                { name: "Financing", order: 4, probability: 80 },
                { name: "Sold", order: 5, probability: 95 },
                { name: "Delivered", order: 6, probability: 100 },
                { name: "Closed Lost", order: 7, probability: 0 },
            ],
        },
    ],
    tags: ["Hot Buyer", "Cash Buyer", "Trade-In", "Financing Pre-Approved", "Repeat Buyer", "Service Lead"],
    leadSources: ["Walk-In", "Phone Call", "Website", "AutoTrader", "Cars.com", "CarGurus", "Facebook Marketplace", "Referral", "Repeat Customer", "Other"],
    statuses: [
        { name: "Lead", order: 0, color: "#3b82f6" },
        { name: "Active Buyer", order: 1, color: "#22c55e" },
        { name: "Past Customer", order: 2, color: "#6b7280" },
        { name: "Service Customer", order: 3, color: "#a855f7" },
        { name: "Do Not Contact", order: 4, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Vehicle of Interest", key: "vehicle_of_interest", type: "text" },
        { entity: "opportunity", name: "Stock Number", key: "stock_number", type: "text" },
        { entity: "opportunity", name: "Listed Price", key: "listed_price", type: "number" },
        { entity: "opportunity", name: "Sale Price", key: "sale_price", type: "number" },
        { entity: "opportunity", name: "Financing Status", key: "financing_status", type: "select", options: ["Cash", "Pre-Approved", "Pending", "Approved", "Declined", "In-House"] },
        { entity: "opportunity", name: "Trade-In Vehicle", key: "trade_in_vehicle", type: "text" },
        { entity: "opportunity", name: "Trade-In Value", key: "trade_in_value", type: "number" },
        { entity: "opportunity", name: "Delivery Date", key: "delivery_date", type: "date" },
        { entity: "contact", name: "Driver License", key: "driver_license", type: "text" },
        { entity: "contact", name: "Credit Tier", key: "credit_tier", type: "select", options: ["Prime", "Near Prime", "Subprime", "Deep Subprime", "Unknown"] },
    ],
}
