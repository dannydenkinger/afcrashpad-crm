import type { Snapshot } from "./types"

/**
 * Real Estate Rental snapshot — short-term-rental / property-management
 * vocabulary. Restores the tenant/lease/move-in language that the base
 * CRM used to ship with, but as an opt-in template.
 */
export const REAL_ESTATE_RENTAL_SNAPSHOT: Snapshot = {
    slug: "real-estate-rental",
    name: "Real Estate Rental",
    description:
        "Short-term rentals, crashpads, leasing, and property management — tenant lifecycle from inquiry to move-out.",
    category: "Real Estate",
    pipelines: [
        {
            name: "Rental Pipeline",
            stages: [
                { name: "Inquiry", order: 0, probability: 10 },
                { name: "Application Received", order: 1, probability: 25 },
                { name: "Application Approved", order: 2, probability: 50 },
                { name: "Lease Signed", order: 3, probability: 75 },
                { name: "Move In Scheduled", order: 4, probability: 90 },
                { name: "Current Tenant", order: 5, probability: 100 },
                { name: "Past Tenant", order: 6, probability: 100 },
                { name: "Lost", order: 7, probability: 0 },
            ],
        },
    ],
    tags: ["Hot Lead", "Returning Tenant", "Pet Owner", "Long-term", "Short-term"],
    leadSources: [
        "Airbnb",
        "VRBO",
        "Furnished Finder",
        "Website",
        "Referral",
        "Walk-in",
        "Other",
    ],
    statuses: [
        { name: "Lead", order: 0, color: "#3b82f6" },
        { name: "Booked", order: 1, color: "#8b5cf6" },
        { name: "Active Stay", order: 2, color: "#22c55e" },
        { name: "Past Tenant", order: 3, color: "#6b7280" },
        { name: "Do Not Contact", order: 4, color: "#ef4444" },
    ],
    customFields: [
        {
            entity: "opportunity",
            name: "Property Address",
            key: "property_address",
            type: "text",
            description: "Address of the unit being rented",
        },
        {
            entity: "opportunity",
            name: "Number of Guests",
            key: "guest_count",
            type: "number",
        },
        {
            entity: "opportunity",
            name: "Pet?",
            key: "has_pet",
            type: "select",
            options: ["No", "Yes"],
        },
        {
            entity: "contact",
            name: "Employer",
            key: "employer",
            type: "text",
            description: "For verification on traveling-professional rentals",
        },
    ],
    automations: [
        {
            name: "New inquiry — auto-respond",
            description: "Sends a personalized acknowledgement when a new inquiry comes in via a form.",
            enabled: false,
            trigger: { type: "form_submitted", config: {} },
            nodes: [
                {
                    id: "n1",
                    type: "send_email",
                    subject: "Thanks for your inquiry, {{first_name}}",
                    html: "<p>Hi {{first_name}},</p><p>Thanks for reaching out about your stay! We'll review your request and get back to you within 24 hours with availability and next steps.</p><p>— The {{company}} Team</p>",
                },
            ],
        },
        {
            name: "Lease signed — welcome series",
            description: "Three-email welcome sequence kicked off when a deal moves to Lease Signed.",
            enabled: false,
            trigger: { type: "pipeline_stage_entered", config: {} },
            nodes: [
                {
                    id: "n1",
                    type: "send_email",
                    subject: "Welcome aboard, {{first_name}} 👋",
                    html: "<p>Hi {{first_name}},</p><p>Your lease is signed and we're thrilled to have you! Over the next few days, we'll send you everything you need: move-in details, a digital welcome packet, and a way to reach us 24/7.</p><p>— {{company}}</p>",
                },
                { id: "n2", type: "wait", delayMinutes: 60 * 24 },
                {
                    id: "n3",
                    type: "send_email",
                    subject: "Your move-in checklist",
                    html: "<p>Hi {{first_name}},</p><p>Quick checklist before move-in day:</p><ul><li>Confirm your start date</li><li>Set up renters insurance (we recommend Lemonade or State Farm)</li><li>Arrange utility transfer if needed</li><li>Save our 24/7 maintenance number</li></ul><p>Reply to this email with any questions.</p>",
                },
                { id: "n4", type: "wait", delayMinutes: 60 * 24 * 5 },
                {
                    id: "n5",
                    type: "send_email",
                    subject: "Settling in OK?",
                    html: "<p>Hi {{first_name}},</p><p>It's been a few days — how's everything going? We're here if you need anything: maintenance, supplies, recommendations for the area. Just reply to this email.</p>",
                },
                { id: "n6", type: "end" },
            ],
        },
    ],
    emailTemplates: [
        {
            name: "Inquiry response",
            subject: "Thanks for your inquiry, {{first_name}}",
            description: "Quick acknowledgement when a prospect reaches out about a unit.",
            renderedHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a;line-height:1.55;">
<h2 style="margin:0 0 12px;font-size:22px;">Thanks for reaching out, {{first_name}}</h2>
<p style="margin:0 0 16px;">We got your inquiry and we're so glad you're considering us. Here's what happens next:</p>
<ol style="padding-left:20px;margin:0 0 20px;">
<li style="margin-bottom:6px;">We'll check availability for your dates.</li>
<li style="margin-bottom:6px;">You'll get a personalized quote within 24 hours.</li>
<li>If it's a fit, we'll send a quick application + lease.</li>
</ol>
<p style="margin:0 0 24px;">Questions? Just reply to this email — we read every one.</p>
<p style="margin:0;color:#64748b;font-size:13px;">— The {{company}} Team</p>
</div>`,
        },
        {
            name: "Booking confirmation",
            subject: "You're booked — see you {{stayStartDate}} 🎉",
            description: "Sent when a deal closes / lease is signed.",
            renderedHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a;line-height:1.55;">
<h2 style="margin:0 0 12px;font-size:22px;">You're all set, {{first_name}} 🎉</h2>
<p style="margin:0 0 16px;">Your booking is confirmed. We can't wait to host you.</p>
<div style="background:#f1f5f9;border-radius:8px;padding:18px;margin:0 0 20px;">
<div style="font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-bottom:6px;">Your stay</div>
<div style="font-weight:600;">Check-in: {{stayStartDate}}</div>
<div style="font-weight:600;">Check-out: {{stayEndDate}}</div>
</div>
<p style="margin:0 0 16px;">A few days before your check-in, we'll send detailed move-in instructions, the access code, and our 24/7 contact number.</p>
<p style="margin:0;color:#64748b;font-size:13px;">— The {{company}} Team</p>
</div>`,
        },
        {
            name: "Move-out reminder",
            subject: "Your stay ends in 7 days — quick checklist",
            description: "Reminds tenant of move-out steps a week ahead.",
            renderedHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a;line-height:1.55;">
<h2 style="margin:0 0 12px;font-size:22px;">Wrapping up soon, {{first_name}}</h2>
<p style="margin:0 0 16px;">Your stay ends in 7 days. Here's a quick checklist so move-out is smooth:</p>
<ul style="padding-left:20px;margin:0 0 20px;">
<li style="margin-bottom:6px;">Confirm your move-out date and time</li>
<li style="margin-bottom:6px;">Remove all personal belongings</li>
<li style="margin-bottom:6px;">Leave keys / access devices on the kitchen counter</li>
<li>Reply to this email if you'd like to extend</li>
</ul>
<p style="margin:0 0 16px;">Thanks for staying with us — we'd love to host you again!</p>
<p style="margin:0;color:#64748b;font-size:13px;">— The {{company}} Team</p>
</div>`,
        },
    ],
}
