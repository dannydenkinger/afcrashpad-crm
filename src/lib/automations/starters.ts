/**
 * Pre-built automation starters — one-click templates users can fork. Each
 * starter is a ready-made trigger + node sequence with sensible defaults
 * and inline copy. Users edit names / lists / tag IDs after forking.
 *
 * Adding a starter: append to STARTER_AUTOMATIONS. Use `email-template`
 * placeholders for HTML so users know to swap in their own template.
 */

import type {
    AutomationNode,
    Trigger,
    TriggerType,
} from "./types"

export type StarterCategory =
    | "Onboarding"
    | "Engagement"
    | "Sales"
    | "Retention"
    | "Lifecycle"
    | "Events"

export interface AutomationStarter {
    slug: string
    name: string
    description: string
    category: StarterCategory
    trigger: Trigger
    /** Node factory — receives a fresh-id generator so each fork gets unique ids. */
    buildNodes: (newId: () => string) => AutomationNode[]
}

const C = {
    primary: "#4f46e5",
    text: "#0f172a",
    textMuted: "#64748b",
    bgSubtle: "#f8fafc",
}
const FONT =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

const wrapEmail = (preheader: string, body: string) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.bgSubtle};font-family:${FONT};color:${C.text};">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:${C.bgSubtle};">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
<tr><td style="padding:40px 44px;">
${body}
<p style="margin:32px 0 0 0;font-size:13px;color:${C.textMuted};">
<a href="{{unsubscribe_url}}" style="color:${C.textMuted};text-decoration:underline;">Unsubscribe</a>
</p>
</td></tr></table>
</td></tr></table>
</body></html>`

const cta = (label: string) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
<tr><td style="border-radius:10px;background:${C.primary};">
<a href="#" style="display:inline-block;padding:13px 28px;color:#fff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">${label}</a>
</td></tr></table>`

export const STARTER_AUTOMATIONS: AutomationStarter[] = [
    {
        slug: "welcome-series",
        name: "Welcome series (3 emails)",
        description: "Greet new contacts with a 3-email onboarding drip over 5 days.",
        category: "Onboarding",
        trigger: { type: "contact_created" as TriggerType, config: {} },
        buildNodes: (newId) => [
            {
                id: newId(),
                type: "send_email",
                subject: "Welcome to {{company}}, {{first_name}} 👋",
                html: wrapEmail(
                    "Glad to have you. Here's where to start.",
                    `<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;letter-spacing:-0.02em;">Welcome aboard, {{first_name}}</h1>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">Thanks for joining {{company}}. Over the next few days I'll send a couple of short notes to help you get the most out of it.</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">First, take 2 minutes to complete your profile so we can personalize things:</p>
${cta("Complete your profile")}`,
                ),
            },
            { id: newId(), type: "wait", delayMinutes: 2 * 24 * 60 },
            {
                id: newId(),
                type: "send_email",
                subject: "{{first_name}}, the one feature most people miss",
                html: wrapEmail(
                    "A 90-second walkthrough of what trips up new users.",
                    `<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;letter-spacing:-0.02em;">Quick tip</h1>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">Hey {{first_name}} — we noticed most new users miss this one feature, and it's the thing that saves them the most time:</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;"><em>Describe the feature here.</em></p>
${cta("See how it works")}`,
                ),
            },
            { id: newId(), type: "wait", delayMinutes: 3 * 24 * 60 },
            {
                id: newId(),
                type: "send_email",
                subject: "Anything I can help with, {{first_name}}?",
                html: wrapEmail(
                    "Just checking in.",
                    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Hi {{first_name}},</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">You've been with {{company}} for almost a week now. How's it going?</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Reply to this email — I read every one. If something's getting in the way, I'd love to know.</p>
<p style="margin:24px 0 0 0;font-size:14px;color:${C.textMuted};">— The {{company}} team</p>`,
                ),
            },
            { id: newId(), type: "end" },
        ],
    },
    {
        slug: "abandoned-cart",
        name: "Abandoned cart recovery",
        description:
            "Follow up with shoppers who left items in their cart. Triggered by tag added — set the tag from your e-commerce webhook.",
        category: "Sales",
        trigger: { type: "tag_added" as TriggerType, config: {} },
        buildNodes: (newId) => [
            { id: newId(), type: "wait", delayMinutes: 60 },
            {
                id: newId(),
                type: "send_email",
                subject: "{{first_name}}, you left something behind",
                html: wrapEmail(
                    "Your cart is still here. We saved it for you.",
                    `<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;letter-spacing:-0.02em;">Forget something?</h1>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">Looks like you left a few items in your cart, {{first_name}}. We held onto them — but they're going fast.</p>
${cta("Complete checkout")}`,
                ),
            },
            { id: newId(), type: "wait", delayMinutes: 24 * 60 },
            {
                id: newId(),
                type: "send_email",
                subject: "Last chance — 10% off if you check out today",
                html: wrapEmail(
                    "We saved the cart, plus a small thank-you.",
                    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">Hi {{first_name}}, your cart's still here. Use code <strong>COMEBACK10</strong> at checkout for 10% off — today only.</p>
${cta("Use my discount")}`,
                ),
            },
            { id: newId(), type: "end" },
        ],
    },
    {
        slug: "post-purchase",
        name: "Post-purchase thank-you",
        description: "Thank customers after a purchase and ask for feedback after 7 days.",
        category: "Retention",
        trigger: { type: "opportunity_won" as TriggerType, config: {} },
        buildNodes: (newId) => [
            {
                id: newId(),
                type: "send_email",
                subject: "Thanks for your order, {{first_name}} 🙌",
                html: wrapEmail(
                    "We appreciate you.",
                    `<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;letter-spacing:-0.02em;">Thanks for choosing {{company}}</h1>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">Your order is being processed — you'll get tracking info as soon as it ships.</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">If anything's off, just reply to this email.</p>`,
                ),
            },
            { id: newId(), type: "wait", delayMinutes: 7 * 24 * 60 },
            {
                id: newId(),
                type: "send_email",
                subject: "{{first_name}}, how's it going so far?",
                html: wrapEmail(
                    "Quick favor — got 60 seconds?",
                    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Hi {{first_name}},</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">It's been a week — how's the experience been? We'd love a quick rating or note.</p>
${cta("Leave a review")}`,
                ),
            },
            { id: newId(), type: "end" },
        ],
    },
    {
        slug: "lead-nurture",
        name: "Lead nurture (5 emails)",
        description:
            "Build trust with new leads via a 5-email educational drip over 2 weeks.",
        category: "Sales",
        trigger: { type: "form_submitted" as TriggerType, config: {} },
        buildNodes: (newId) => [
            {
                id: newId(),
                type: "send_email",
                subject: "Thanks for reaching out, {{first_name}}",
                html: wrapEmail(
                    "Quick acknowledgment + what to expect.",
                    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Hi {{first_name}}, thanks for getting in touch.</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Over the next two weeks I'll send a few short emails covering the things our customers find most useful. Nothing salesy — just useful stuff.</p>`,
                ),
            },
            { id: newId(), type: "wait", delayMinutes: 3 * 24 * 60 },
            {
                id: newId(),
                type: "send_email",
                subject: "The mistake most people make in [your niche]",
                html: wrapEmail(
                    "An educational read.",
                    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">[Educational content here. Aim for 250-400 words. Make it specific. Avoid platitudes.]</p>
${cta("Read more")}`,
                ),
            },
            { id: newId(), type: "wait", delayMinutes: 4 * 24 * 60 },
            {
                id: newId(),
                type: "send_email",
                subject: "How [customer] cut [pain point] in half",
                html: wrapEmail(
                    "A short customer story.",
                    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">[Customer story. Specific numbers. Specific names. Avoid vague claims.]</p>`,
                ),
            },
            { id: newId(), type: "wait", delayMinutes: 4 * 24 * 60 },
            {
                id: newId(),
                type: "send_email",
                subject: "{{first_name}}, want to chat?",
                html: wrapEmail(
                    "Soft CTA — only if it's the right time.",
                    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">If anything we've sent has resonated, I'd love a 15-minute chat. No sales pitch — just a chance to learn what you're working on.</p>
${cta("Book 15 minutes")}`,
                ),
            },
            { id: newId(), type: "end" },
        ],
    },
    {
        slug: "win-back",
        name: "Win-back campaign",
        description:
            "Re-engage contacts who haven't been active. Tag dormant contacts with a chosen tag to enroll.",
        category: "Retention",
        trigger: { type: "tag_added" as TriggerType, config: {} },
        buildNodes: (newId) => [
            {
                id: newId(),
                type: "send_email",
                subject: "It's been a minute, {{first_name}} 👋",
                html: wrapEmail(
                    "We miss you. Here's what's new.",
                    `<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;letter-spacing:-0.02em;">We've missed you</h1>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">Hey {{first_name}} — noticed you haven't been around for a while. Here's a quick update on what we've shipped since:</p>
<ul style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">
<li>[New feature 1]</li>
<li>[New feature 2]</li>
<li>[Improvement]</li>
</ul>
${cta("See what's new")}`,
                ),
            },
            { id: newId(), type: "wait", delayMinutes: 5 * 24 * 60 },
            {
                id: newId(),
                type: "send_email",
                subject: "One more thing — 20% off if you come back",
                html: wrapEmail(
                    "A small incentive.",
                    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Final note from us, {{first_name}} — if you're up for trying {{company}} again, here's a 20% discount on your next month: <strong>WELCOMEBACK</strong></p>
${cta("Welcome me back")}`,
                ),
            },
            { id: newId(), type: "end" },
        ],
    },
    {
        slug: "stage-moved-to-customer",
        name: "Pipeline → Customer notify",
        description:
            "Send a Slack-style internal notification (via webhook) and tag the contact when an opportunity is won.",
        category: "Sales",
        trigger: { type: "opportunity_won" as TriggerType, config: {} },
        buildNodes: (newId) => [
            {
                id: newId(),
                type: "add_tag",
                tagId: "",
            },
            {
                id: newId(),
                type: "update_contact_field",
                fieldPath: "status",
                value: "Customer",
            },
            {
                id: newId(),
                type: "webhook",
                url: "",
            },
            { id: newId(), type: "end" },
        ],
    },
    {
        slug: "list-welcome",
        name: "List subscriber welcome",
        description:
            "Send a thank-you the moment a contact joins a specific list. Pick the list in the trigger.",
        category: "Lifecycle",
        trigger: { type: "contact_added_to_list" as TriggerType, config: {} },
        buildNodes: (newId) => [
            {
                id: newId(),
                type: "send_email",
                subject: "Thanks for subscribing, {{first_name}}",
                html: wrapEmail(
                    "What to expect now that you're on the list.",
                    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Hi {{first_name}}, thanks for joining the list. You'll hear from us about [topic] roughly [cadence]. We won't spam you, promise.</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">In the meantime, here's our most-popular post — most subscribers say it changed how they think about [thing]:</p>
${cta("Read it")}`,
                ),
            },
            { id: newId(), type: "end" },
        ],
    },
    {
        slug: "engagement-reward",
        name: "Reward engaged readers",
        description:
            "When a contact clicks a campaign link, tag them as 'engaged' so you can target them for offers.",
        category: "Engagement",
        trigger: { type: "email_clicked" as TriggerType, config: {} },
        buildNodes: (newId) => [
            { id: newId(), type: "add_tag", tagId: "" },
            { id: newId(), type: "end" },
        ],
    },
    {
        slug: "appointment-confirmation",
        name: "Appointment confirmation + reminder",
        description:
            "When a contact books a meeting via Calendly/Cal.com, send an immediate confirmation and a 1-hour reminder.",
        category: "Events",
        trigger: { type: "appointment_booked" as TriggerType, config: {} },
        buildNodes: (newId) => [
            {
                id: newId(),
                type: "send_email",
                subject: "Confirmed — see you at our meeting",
                html: wrapEmail(
                    "Your meeting is on the calendar.",
                    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Hi {{first_name}},</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Your meeting with {{company}} is confirmed. You should have a calendar invite — if not, reply to this email and we'll resend.</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Looking forward to it.</p>`,
                ),
            },
            { id: newId(), type: "wait", delayMinutes: 60 },
            {
                id: newId(),
                type: "send_email",
                subject: "Quick reminder — we meet in about an hour",
                html: wrapEmail(
                    "See you soon.",
                    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Hi {{first_name}}, just a quick heads-up that our meeting starts in about an hour.</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;">Need to reschedule? Reply and we'll find another time.</p>`,
                ),
            },
            { id: newId(), type: "end" },
        ],
    },
    {
        slug: "ai-personal-followup",
        name: "AI personal follow-up",
        description:
            "Use Claude to write a one-off personalized follow-up to every new contact — short, specific, no template feel.",
        category: "Onboarding",
        trigger: { type: "contact_created" as TriggerType, config: {} },
        buildNodes: (newId) => [
            { id: newId(), type: "wait", delayMinutes: 60 },
            {
                id: newId(),
                type: "ai_send_email",
                subject: "Welcome — quick note from {{company}}",
                prompt:
                    "Write a warm, personal welcome email — the kind a founder would send themselves. Reference that they just signed up. Mention briefly what {{company}} helps people do (use the recipient's name), and invite a reply if they have any questions. Keep it short — 3 short paragraphs max. Sign off as 'The {{company}} team'.",
                model: "claude-haiku-4-5",
                maxOutputTokens: 600,
            },
            { id: newId(), type: "end" },
        ],
    },
]

export function getStarter(slug: string): AutomationStarter | undefined {
    return STARTER_AUTOMATIONS.find((s) => s.slug === slug)
}
