import type { Snapshot } from "./types"

/**
 * Service Business snapshot — covers agencies, coaches, consultants,
 * freelancers, and any other engagement-driven service. Common shape:
 * inquiry → discovery → proposal → engagement → completed.
 */
export const SERVICE_BUSINESS_SNAPSHOT: Snapshot = {
    slug: "service-business",
    name: "Service Business",
    description:
        "Agencies, consultants, coaches, freelancers — engagement-driven workflows from discovery to wrap-up.",
    category: "Services",
    pipelines: [
        {
            name: "Engagement Pipeline",
            stages: [
                { name: "Inquiry", order: 0, probability: 10 },
                { name: "Discovery Call", order: 1, probability: 25 },
                { name: "Proposal Sent", order: 2, probability: 50 },
                { name: "Negotiation", order: 3, probability: 70 },
                { name: "Engagement Active", order: 4, probability: 100 },
                { name: "Engagement Complete", order: 5, probability: 100 },
                { name: "Closed Lost", order: 6, probability: 0 },
            ],
        },
    ],
    tags: ["High Value", "Referral", "Repeat Client", "Retainer", "Project"],
    leadSources: [
        "Website",
        "Referral",
        "LinkedIn",
        "Cold Outreach",
        "Conference",
        "Existing Client",
        "Other",
    ],
    statuses: [
        { name: "Lead", order: 0, color: "#3b82f6" },
        { name: "Active Client", order: 1, color: "#22c55e" },
        { name: "Past Client", order: 2, color: "#6b7280" },
        { name: "Prospect", order: 3, color: "#a855f7" },
        { name: "Do Not Contact", order: 4, color: "#ef4444" },
    ],
    customFields: [
        {
            entity: "opportunity",
            name: "Project Type",
            key: "project_type",
            type: "select",
            options: ["One-off", "Retainer", "Subscription"],
        },
        {
            entity: "opportunity",
            name: "Estimated Hours",
            key: "estimated_hours",
            type: "number",
        },
        {
            entity: "contact",
            name: "Company",
            key: "company",
            type: "text",
        },
        {
            entity: "contact",
            name: "Industry",
            key: "industry",
            type: "text",
        },
    ],
    automations: [
        {
            name: "Discovery call follow-up",
            description: "After a discovery call, send a thanks note + proposal-on-the-way email.",
            enabled: false,
            trigger: { type: "pipeline_stage_entered", config: {} },
            nodes: [
                {
                    id: "n1",
                    type: "send_email",
                    subject: "Great talking, {{first_name}}",
                    html: "<p>Hi {{first_name}},</p><p>Really enjoyed our conversation today. As promised, I'm putting together a proposal that addresses what we discussed and will send it over within 48 hours.</p><p>Anything I can clarify in the meantime — just hit reply.</p><p>— {{first_name_owner}}</p>",
                },
                { id: "n2", type: "wait", delayMinutes: 60 * 24 * 2 },
                {
                    id: "n3",
                    type: "send_email",
                    subject: "Proposal sent — quick check-in",
                    html: "<p>Hi {{first_name}},</p><p>Wanted to make sure the proposal landed in your inbox. Take your time reviewing — happy to jump on another call if anything needs walking through.</p>",
                },
                { id: "n4", type: "end" },
            ],
        },
        {
            name: "New inquiry — auto-respond",
            description: "Sets expectations when a new lead form is submitted.",
            enabled: false,
            trigger: { type: "form_submitted", config: {} },
            nodes: [
                {
                    id: "n1",
                    type: "send_email",
                    subject: "Thanks for reaching out, {{first_name}}",
                    html: "<p>Hi {{first_name}},</p><p>Thanks for the inquiry! I'll be in touch within one business day to learn more about what you're looking for and see if we're a good fit.</p><p>If it's urgent, feel free to reply to this email or book a 30-min discovery call: [add your booking link]</p>",
                },
            ],
        },
    ],
    emailTemplates: [
        {
            name: "Discovery call invite",
            subject: "Quick 30-min chat about {{project_topic}}?",
            description: "Outreach to a warm lead inviting them to a discovery call.",
            renderedHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a;line-height:1.55;">
<p style="margin:0 0 16px;">Hi {{first_name}},</p>
<p style="margin:0 0 16px;">I'd love to learn more about what you're working on and see if we can help. Would you be open to a 30-minute discovery call this week or next?</p>
<p style="margin:0 0 16px;">Pick a time that works for you: <a href="#" style="color:#4f46e5;">[your booking link]</a></p>
<p style="margin:0 0 16px;">No pitch, no hard sell — just a conversation.</p>
<p style="margin:0;color:#64748b;font-size:13px;">— {{first_name_owner}} · {{company}}</p>
</div>`,
        },
        {
            name: "Project proposal sent",
            subject: "Your proposal — {{project_name}}",
            description: "Sent with the proposal attached / linked.",
            renderedHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a;line-height:1.55;">
<h2 style="margin:0 0 12px;font-size:22px;">Your proposal is ready</h2>
<p style="margin:0 0 16px;">Hi {{first_name}},</p>
<p style="margin:0 0 16px;">Based on what we discussed, here's a proposal that lays out the approach, deliverables, timeline, and investment.</p>
<p style="margin:0 0 24px;"><a href="#" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View proposal →</a></p>
<p style="margin:0 0 16px;">Take your time reviewing. I'm happy to walk through it together — just reply to this email or book another call.</p>
<p style="margin:0;color:#64748b;font-size:13px;">— {{first_name_owner}}</p>
</div>`,
        },
        {
            name: "Engagement wrap-up",
            subject: "Wrapping up — and what's next, {{first_name}}",
            description: "Sent at the end of an engagement — handoff + referral ask.",
            renderedHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a;line-height:1.55;">
<h2 style="margin:0 0 12px;font-size:22px;">It's been a pleasure working with you</h2>
<p style="margin:0 0 16px;">Hi {{first_name}},</p>
<p style="margin:0 0 16px;">As we wrap up this engagement, I wanted to say thanks. Working on this together has been a real highlight.</p>
<p style="margin:0 0 16px;">A couple things on the way out:</p>
<ul style="padding-left:20px;margin:0 0 16px;">
<li style="margin-bottom:6px;">Final invoice will be in your inbox shortly.</li>
<li style="margin-bottom:6px;">All deliverables are in your shared folder.</li>
<li>If you know anyone else who could use what we just built, I'd love an introduction — referrals are the lifeblood of the business.</li>
</ul>
<p style="margin:0 0 16px;">Stay in touch.</p>
<p style="margin:0;color:#64748b;font-size:13px;">— {{first_name_owner}}</p>
</div>`,
        },
    ],
}
