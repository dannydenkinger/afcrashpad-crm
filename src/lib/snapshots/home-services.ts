import type { Snapshot } from "./types"

/**
 * Home Services — HVAC, plumbing, roofing, electrical, pest control,
 * remodeling. The lifecycle is shorter than B2B but service-call-driven:
 * estimate → job → review-request loop is the bread and butter.
 */
export const HOME_SERVICES_SNAPSHOT: Snapshot = {
    slug: "home-services",
    name: "Home Services",
    description:
        "HVAC, plumbing, roofing, electrical, remodeling — estimate-to-job lifecycle with review and recall loops.",
    category: "Services",
    pipelines: [
        {
            name: "Job Pipeline",
            stages: [
                { name: "Lead", order: 0, probability: 15 },
                { name: "Estimate Scheduled", order: 1, probability: 35 },
                { name: "Estimate Sent", order: 2, probability: 55 },
                { name: "Job Scheduled", order: 3, probability: 80 },
                { name: "In Progress", order: 4, probability: 90 },
                { name: "Job Complete", order: 5, probability: 100 },
                { name: "Closed Lost", order: 6, probability: 0 },
            ],
        },
        {
            name: "Maintenance / Recall",
            stages: [
                { name: "Due for Service", order: 0, probability: 60 },
                { name: "Contacted", order: 1, probability: 75 },
                { name: "Booked", order: 2, probability: 90 },
                { name: "Complete", order: 3, probability: 100 },
                { name: "Declined", order: 4, probability: 0 },
            ],
        },
    ],
    tags: ["Emergency Call", "Repeat Customer", "Maintenance Plan", "Warranty Active", "Referred", "Bad Pay"],
    leadSources: ["Google Search", "Google Local Service Ads", "Yelp", "Angi", "Thumbtack", "Referral", "Repeat Customer", "Direct Mail", "Yard Sign", "Other"],
    statuses: [
        { name: "Lead", order: 0, color: "#3b82f6" },
        { name: "Active Customer", order: 1, color: "#22c55e" },
        { name: "Past Customer", order: 2, color: "#6b7280" },
        { name: "Maintenance Plan", order: 3, color: "#a855f7" },
        { name: "Do Not Service", order: 4, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Service Type", key: "service_type", type: "select", options: ["Repair", "Installation", "Maintenance", "Inspection", "Emergency"] },
        { entity: "opportunity", name: "Job Address", key: "job_address", type: "text" },
        { entity: "opportunity", name: "Estimate Amount", key: "estimate_amount", type: "number" },
        { entity: "opportunity", name: "Final Invoice", key: "final_invoice", type: "number" },
        { entity: "opportunity", name: "Equipment / Make", key: "equipment_make", type: "text" },
        { entity: "opportunity", name: "Equipment Age (years)", key: "equipment_age", type: "number" },
        { entity: "opportunity", name: "Job Date", key: "job_date", type: "date" },
        { entity: "contact", name: "Property Type", key: "property_type", type: "select", options: ["Single Family", "Townhouse", "Condo", "Multi-Family", "Commercial"] },
        { entity: "contact", name: "Service Address", key: "service_address", type: "text" },
        { entity: "contact", name: "On Maintenance Plan", key: "on_maintenance_plan", type: "select", options: ["Yes", "No"] },
    ],
}
