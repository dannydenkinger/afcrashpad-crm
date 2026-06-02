import type { Snapshot } from "./types"

/**
 * Medical / Dental practice — patient acquisition + recall. Note that
 * Vesta is NOT HIPAA-compliant out of the box; this template helps with
 * marketing/scheduling workflows but should not store PHI. Practices
 * doing actual chart work should use a HIPAA-covered EHR.
 */
export const MEDICAL_DENTAL_SNAPSHOT: Snapshot = {
    slug: "medical-dental",
    name: "Medical / Dental Practice",
    description:
        "Patient acquisition and recall — inquiry through consult, treatment plan, and recall reminders. NOT for storing PHI.",
    category: "Health",
    pipelines: [
        {
            name: "New Patient Pipeline",
            stages: [
                { name: "Inquiry", order: 0, probability: 20 },
                { name: "Consultation Booked", order: 1, probability: 50 },
                { name: "Consult Complete", order: 2, probability: 70 },
                { name: "Treatment Plan Sent", order: 3, probability: 80 },
                { name: "Treatment Started", order: 4, probability: 95 },
                { name: "Active Patient", order: 5, probability: 100 },
                { name: "Closed Lost", order: 6, probability: 0 },
            ],
        },
        {
            name: "Recall Pipeline",
            stages: [
                { name: "Recall Due", order: 0, probability: 60 },
                { name: "Contacted", order: 1, probability: 75 },
                { name: "Booked", order: 2, probability: 90 },
                { name: "Seen", order: 3, probability: 100 },
                { name: "Declined", order: 4, probability: 0 },
            ],
        },
    ],
    tags: ["New Patient", "VIP", "Cosmetic Interest", "Membership Plan", "Referral", "Insurance Verified", "Self-Pay"],
    leadSources: ["Google Search", "Google Maps", "Insurance Directory", "Referral", "Existing Patient", "Social Media", "Direct Mail", "Other"],
    statuses: [
        { name: "Inquiry", order: 0, color: "#3b82f6" },
        { name: "Active Patient", order: 1, color: "#22c55e" },
        { name: "Inactive Patient", order: 2, color: "#6b7280" },
        { name: "Membership Plan", order: 3, color: "#a855f7" },
        { name: "Do Not Contact", order: 4, color: "#ef4444" },
    ],
    customFields: [
        { entity: "opportunity", name: "Treatment Type", key: "treatment_type", type: "text", description: "General category only — do not enter PHI" },
        { entity: "opportunity", name: "Estimated Treatment Value", key: "treatment_value", type: "number" },
        { entity: "opportunity", name: "Insurance Status", key: "insurance_status", type: "select", options: ["Self-Pay", "PPO", "HMO", "Verified", "Pending Verification", "Denied"] },
        { entity: "opportunity", name: "First Visit Date", key: "first_visit", type: "date" },
        { entity: "contact", name: "Insurance Carrier", key: "insurance_carrier", type: "text" },
        { entity: "contact", name: "Last Visit", key: "last_visit", type: "date" },
        { entity: "contact", name: "Recall Interval (months)", key: "recall_interval", type: "number" },
        { entity: "contact", name: "Referred By", key: "referred_by", type: "text" },
    ],
}
