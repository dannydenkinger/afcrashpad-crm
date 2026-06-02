/**
 * Starter email templates shipped with the app.
 *
 * Inline-styled, table-based, mobile-friendly HTML that renders well in
 * Gmail / Outlook / Apple Mail without juice having to do much. Designed to
 * match the look of our GrapesJS blocks (indigo brand, slate text, generous
 * spacing) so a user can swap freely between starters and dropped blocks.
 *
 * Tokens like {{first_name}} and {{company}} are filled per-recipient.
 */

export interface StarterTemplate {
    slug: string
    name: string
    subject: string
    description: string
    /** Used to group templates on the picker. */
    category: "Onboarding" | "Marketing" | "Transactional" | "Engagement" | "Events"
    renderedHtml: string
}

// ── Design tokens (mirrors src/components/email/grapes/blocks/types.ts) ────
const C = {
    primary: "#4f46e5",
    primaryDark: "#4338ca",
    primaryLight: "#eef2ff",
    text: "#0f172a",
    textMuted: "#64748b",
    textSubtle: "#94a3b8",
    border: "#e2e8f0",
    borderSubtle: "#f1f5f9",
    bg: "#ffffff",
    bgSubtle: "#f8fafc",
    accent: "#f59e0b",
    success: "#16a34a",
    danger: "#dc2626",
}
const FONT =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

const wrap = (preheader: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{company}}</title>
</head>
<body style="margin:0;padding:0;background:${C.bgSubtle};font-family:${FONT};color:${C.text};-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;color:${C.bgSubtle};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bgSubtle};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${C.bg};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.04),0 8px 24px rgba(15,23,42,0.06);">
<tr><td>
${body}
</td></tr>
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin-top:20px;">
<tr><td style="padding:0 24px;text-align:center;font-size:12px;color:${C.textMuted};line-height:1.7;">
<strong style="color:${C.text};font-weight:600;">{{company}}</strong> &middot; You received this because you opted in.<br>
<a href="{{unsubscribe_url}}" style="color:${C.textMuted};text-decoration:underline;margin:0 6px;">Unsubscribe</a>
<a href="#" style="color:${C.textMuted};text-decoration:underline;margin:0 6px;">View in browser</a>
<a href="#" style="color:${C.textMuted};text-decoration:underline;margin:0 6px;">Privacy</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

const heroGradient = (title: string, subtitle: string, badge?: string) =>
    `<tr><td style="padding:56px 48px 40px 48px;background:linear-gradient(180deg,${C.primaryLight} 0%,${C.bg} 100%);text-align:center;">
${badge ? `<div style="display:inline-block;padding:6px 14px;background:${C.primary};color:#ffffff;font-size:11px;font-weight:600;border-radius:999px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:20px;">${badge}</div>` : ""}
<h1 style="margin:0 0 14px 0;font-size:32px;font-weight:700;color:${C.text};line-height:1.15;letter-spacing:-0.02em;">${title}</h1>
<p style="margin:0;font-size:16px;color:${C.textMuted};line-height:1.55;">${subtitle}</p>
</td></tr>`

const button = (label: string, href = "#", variant: "primary" | "secondary" = "primary") => {
    if (variant === "secondary") {
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="border-radius:10px;border:1.5px solid ${C.primary};"><a href="${href}" style="display:inline-block;padding:12px 28px;color:${C.primary};font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">${label}</a></td></tr></table>`
    }
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="border-radius:10px;background:${C.primary};box-shadow:0 1px 2px rgba(15,23,42,0.08);"><a href="${href}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">${label}</a></td></tr></table>`
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
    // ── Onboarding ─────────────────────────────────────────────────────────
    {
        slug: "welcome",
        name: "Welcome email",
        subject: "Welcome to {{company}}, {{first_name}} 👋",
        description: "Greet new contacts and orient them to your product.",
        category: "Onboarding",
        renderedHtml: wrap(
            "Glad to have you with us. Here's where to start.",
            `${heroGradient(
                "Welcome to {{company}}",
                "We're so glad you joined. Here's what to do next so you get value right away.",
                "Welcome",
            )}
<tr><td style="padding:8px 48px 48px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 28px 0;">
<tr><td style="padding:14px 0;border-bottom:1px solid ${C.borderSubtle};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="width:40px;vertical-align:top;"><div style="width:28px;height:28px;background:${C.primaryLight};color:${C.primary};border-radius:8px;text-align:center;line-height:28px;font-weight:700;font-size:13px;">1</div></td>
<td style="vertical-align:top;padding-left:14px;">
<div style="font-weight:600;font-size:15px;color:${C.text};margin-bottom:2px;letter-spacing:-0.01em;">Complete your profile</div>
<div style="font-size:13px;color:${C.textMuted};line-height:1.55;">Takes 2 minutes — unlocks personalized recommendations.</div>
</td></tr></table>
</td></tr>
<tr><td style="padding:14px 0;border-bottom:1px solid ${C.borderSubtle};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="width:40px;vertical-align:top;"><div style="width:28px;height:28px;background:${C.primaryLight};color:${C.primary};border-radius:8px;text-align:center;line-height:28px;font-weight:700;font-size:13px;">2</div></td>
<td style="vertical-align:top;padding-left:14px;">
<div style="font-weight:600;font-size:15px;color:${C.text};margin-bottom:2px;letter-spacing:-0.01em;">Explore the dashboard</div>
<div style="font-size:13px;color:${C.textMuted};line-height:1.55;">Most of the magic happens there. Take the 60-second tour.</div>
</td></tr></table>
</td></tr>
<tr><td style="padding:14px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="width:40px;vertical-align:top;"><div style="width:28px;height:28px;background:${C.primaryLight};color:${C.primary};border-radius:8px;text-align:center;line-height:28px;font-weight:700;font-size:13px;">3</div></td>
<td style="vertical-align:top;padding-left:14px;">
<div style="font-weight:600;font-size:15px;color:${C.text};margin-bottom:2px;letter-spacing:-0.01em;">Reply if you have questions</div>
<div style="font-size:13px;color:${C.textMuted};line-height:1.55;">This email is monitored — a real person reads everything.</div>
</td></tr></table>
</td></tr>
</table>
${button("Get started")}
<p style="margin:32px 0 0 0;font-size:14px;color:${C.textMuted};line-height:1.6;text-align:center;">
— The {{company}} team
</p>
</td></tr>`,
        ),
    },

    // ── Marketing ─────────────────────────────────────────────────────────
    {
        slug: "newsletter",
        name: "Monthly newsletter",
        subject: "{{company}} — what's new this month",
        description: "Round up of updates and stories for your contact list.",
        category: "Marketing",
        renderedHtml: wrap(
            "Three updates worth your time, plus what's coming next.",
            `<tr><td style="padding:48px 48px 16px 48px;">
<div style="font-size:11px;font-weight:600;color:${C.primary};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">Issue #12 · April</div>
<h1 style="margin:0 0 14px 0;font-size:30px;font-weight:700;color:${C.text};line-height:1.2;letter-spacing:-0.02em;">Hi {{first_name}}, here's the rundown</h1>
<p style="margin:0;font-size:16px;color:${C.textMuted};line-height:1.6;">A short recap of what we shipped, what we learned, and what's coming next at {{company}}.</p>
</td></tr>

<tr><td style="padding:24px 48px 0 48px;">
<a href="#" style="text-decoration:none;color:inherit;display:block;">
<img src="https://placehold.co/504x240?bg=eef2ff&fg=4f46e5&font=raleway&text=Featured+story" alt="" width="504" style="width:100%;height:auto;display:block;border-radius:12px;margin-bottom:16px;" />
<div style="font-size:11px;font-weight:600;color:${C.primary};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Featured</div>
<h2 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${C.text};letter-spacing:-0.01em;line-height:1.3;">The big update everyone's been asking for</h2>
<p style="margin:0;font-size:14px;color:${C.textMuted};line-height:1.6;">A short teaser paragraph. Why this matters and what's inside. Reading time, etc. <span style="color:${C.primary};font-weight:600;">Read more →</span></p>
</a>
</td></tr>

<tr><td style="padding:32px 48px 0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td valign="top" style="width:50%;padding-right:8px;">
<a href="#" style="text-decoration:none;color:inherit;">
<div style="font-size:10px;font-weight:600;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Product</div>
<h3 style="margin:0 0 6px 0;font-size:15px;font-weight:600;color:${C.text};letter-spacing:-0.01em;line-height:1.35;">Faster search with smarter filters</h3>
<p style="margin:0;font-size:13px;color:${C.textMuted};line-height:1.55;">One-line teaser describing the update.</p>
</a>
</td>
<td valign="top" style="width:50%;padding-left:8px;">
<a href="#" style="text-decoration:none;color:inherit;">
<div style="font-size:10px;font-weight:600;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Insight</div>
<h3 style="margin:0 0 6px 0;font-size:15px;font-weight:600;color:${C.text};letter-spacing:-0.01em;line-height:1.35;">What we learned shipping in public</h3>
<p style="margin:0;font-size:13px;color:${C.textMuted};line-height:1.55;">One-line teaser describing the post.</p>
</a>
</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:32px 48px 48px 48px;">
<div style="border-top:1px solid ${C.borderSubtle};padding-top:24px;">
<div style="font-size:11px;font-weight:600;color:${C.primary};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Coming next</div>
<p style="margin:0 0 16px 0;font-size:15px;color:${C.text};line-height:1.6;">A peek at what's on the roadmap for next month — and how to influence it.</p>
${button("Read the roadmap", "#", "secondary")}
</div>
</td></tr>`,
        ),
    },

    {
        slug: "promo",
        name: "Promo / sale",
        subject: "{{first_name}}, your exclusive offer ends Friday",
        description: "Drive a time-limited offer with a clear CTA.",
        category: "Marketing",
        renderedHtml: wrap(
            "Your exclusive 25% off — but not for long.",
            `<tr><td style="padding:64px 48px 48px 48px;background:linear-gradient(135deg,${C.primaryLight} 0%,#fff7ed 100%);text-align:center;">
<div style="display:inline-block;padding:6px 14px;background:${C.accent};color:#ffffff;font-size:11px;font-weight:700;border-radius:999px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:24px;">Limited time</div>
<h1 style="margin:0 0 14px 0;font-size:46px;font-weight:800;color:${C.text};line-height:1.05;letter-spacing:-0.03em;">Save 25%<br/><span style="color:${C.primary};">just for you</span></h1>
<p style="margin:0;font-size:16px;color:${C.textMuted};line-height:1.55;max-width:380px;margin-left:auto;margin-right:auto;">Hi {{first_name}}, we're sending this to a small group of customers. Use the code below before Friday.</p>
</td></tr>

<tr><td style="padding:32px 48px 8px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:32px;background:${C.primaryLight};border:2px dashed ${C.primary};border-radius:14px;text-align:center;">
<div style="font-size:11px;color:${C.primary};font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">Your code</div>
<div style="font-size:36px;font-weight:800;color:${C.text};letter-spacing:0.14em;line-height:1;font-family:${FONT};">SAVE25</div>
<div style="font-size:13px;color:${C.textMuted};margin-top:12px;">Valid through Friday at midnight</div>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:24px 48px 48px 48px;">
${button("Shop now")}
<p style="margin:24px 0 0 0;font-size:13px;color:${C.textSubtle};text-align:center;line-height:1.6;">
Questions? Reply to this email — we'll help.
</p>
</td></tr>`,
        ),
    },

    {
        slug: "product-launch",
        name: "Product launch",
        subject: "Introducing our biggest update yet",
        description: "Announce a launch with hero, three benefits, and a CTA.",
        category: "Marketing",
        renderedHtml: wrap(
            "Something we've been working on for months — finally here.",
            `${heroGradient(
                "A bold new way to {{company}}",
                "Hi {{first_name}}, here's what we've been quietly building. Three things you'll notice right away.",
                "Just launched",
            )}

<tr><td style="padding:8px 48px 24px 48px;">
<img src="https://placehold.co/504x300?bg=eef2ff&fg=4f46e5&font=raleway&text=Hero+screenshot" alt="" width="504" style="width:100%;height:auto;display:block;border-radius:14px;margin-bottom:8px;box-shadow:0 12px 40px rgba(79,70,229,0.18);" />
</td></tr>

<tr><td style="padding:24px 48px 0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td valign="top" style="width:33.33%;padding:0 8px;">
<div style="display:inline-block;width:44px;height:44px;background:${C.primaryLight};color:${C.primary};border-radius:12px;text-align:center;line-height:44px;font-size:22px;margin-bottom:10px;">⚡</div>
<h3 style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:${C.text};letter-spacing:-0.01em;">Faster</h3>
<p style="margin:0;font-size:13px;color:${C.textMuted};line-height:1.55;">2x quicker on every action.</p>
</td>
<td valign="top" style="width:33.33%;padding:0 8px;">
<div style="display:inline-block;width:44px;height:44px;background:${C.primaryLight};color:${C.primary};border-radius:12px;text-align:center;line-height:44px;font-size:22px;margin-bottom:10px;">🎯</div>
<h3 style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:${C.text};letter-spacing:-0.01em;">Sharper</h3>
<p style="margin:0;font-size:13px;color:${C.textMuted};line-height:1.55;">Smarter defaults, less tuning.</p>
</td>
<td valign="top" style="width:33.33%;padding:0 8px;">
<div style="display:inline-block;width:44px;height:44px;background:${C.primaryLight};color:${C.primary};border-radius:12px;text-align:center;line-height:44px;font-size:22px;margin-bottom:10px;">🔒</div>
<h3 style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:${C.text};letter-spacing:-0.01em;">Safer</h3>
<p style="margin:0;font-size:13px;color:${C.textMuted};line-height:1.55;">Built for the long haul.</p>
</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:36px 48px 48px 48px;text-align:center;">
${button("See what's new")}
<p style="margin:20px 0 0 0;font-size:13px;color:${C.textMuted};">
Already a customer? It's live in your account.
</p>
</td></tr>`,
        ),
    },

    {
        slug: "abandoned-cart",
        name: "Abandoned cart",
        subject: "{{first_name}}, you left something behind",
        description: "Win back shoppers who left items in their cart.",
        category: "Marketing",
        renderedHtml: wrap(
            "Your cart is still here. We saved it for you.",
            `<tr><td style="padding:48px 48px 24px 48px;">
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:${C.text};letter-spacing:-0.02em;line-height:1.2;">Forget something, {{first_name}}?</h1>
<p style="margin:0;font-size:15px;color:${C.textMuted};line-height:1.6;">Looks like you left a few items in your cart. We held onto them — but they're going fast.</p>
</td></tr>

<tr><td style="padding:8px 48px 0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.border};border-radius:14px;overflow:hidden;">
<tr><td style="padding:18px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="width:88px;vertical-align:top;">
<img src="https://placehold.co/80x80?bg=eef2ff&fg=4f46e5" alt="" width="80" style="border-radius:10px;display:block;" />
</td>
<td style="vertical-align:middle;padding-left:16px;">
<div style="font-weight:600;font-size:15px;color:${C.text};margin-bottom:2px;letter-spacing:-0.01em;">Product name</div>
<div style="font-size:12px;color:${C.textMuted};margin-bottom:6px;">Variant or size</div>
<div style="font-size:16px;font-weight:700;color:${C.text};">$49.00</div>
</td>
</tr></table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:24px 48px 0 48px;">
${button("Complete checkout")}
</td></tr>

<tr><td style="padding:24px 48px 8px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:18px 22px;background:${C.bgSubtle};border:1px dashed ${C.accent};border-radius:12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="vertical-align:middle;">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:${C.accent};font-weight:700;margin-bottom:2px;">As a thank-you</div>
<div style="font-size:14px;color:${C.text};">Use <strong style="letter-spacing:0.08em;">COMEBACK10</strong> for 10% off</div>
</td>
<td align="right" style="vertical-align:middle;font-size:24px;line-height:1;">🎁</td>
</tr></table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:24px 48px 48px 48px;text-align:center;font-size:13px;color:${C.textMuted};line-height:1.6;">
Questions? Just reply — we'll help.
</td></tr>`,
        ),
    },

    // ── Engagement ────────────────────────────────────────────────────────
    {
        slug: "follow-up",
        name: "Thank you / follow-up",
        subject: "Quick follow-up, {{first_name}}",
        description: "Personal one-to-one touch after a meeting or signup.",
        category: "Engagement",
        renderedHtml: wrap(
            "Just wanted to say thanks and share next steps.",
            `<tr><td style="padding:48px 48px 32px 48px;">
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:${C.text};">
Hi {{first_name}},
</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:${C.text};">
Just wanted to send a quick note to say thanks for connecting earlier. Here are the next steps from our chat:
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
<tr><td style="padding:8px 0;border-left:3px solid ${C.primary};padding-left:16px;">
<div style="font-size:15px;color:${C.text};line-height:1.55;font-weight:500;">What you'll do next</div>
<div style="font-size:14px;color:${C.textMuted};line-height:1.55;margin-top:2px;">Quick line about the action.</div>
</td></tr>
<tr><td style="padding:8px 0;border-left:3px solid ${C.primary};padding-left:16px;">
<div style="font-size:15px;color:${C.text};line-height:1.55;font-weight:500;">What I'll send over</div>
<div style="font-size:14px;color:${C.textMuted};line-height:1.55;margin-top:2px;">Quick line about the deliverable.</div>
</td></tr>
<tr><td style="padding:8px 0;border-left:3px solid ${C.primary};padding-left:16px;">
<div style="font-size:15px;color:${C.text};line-height:1.55;font-weight:500;">When we'll talk again</div>
<div style="font-size:14px;color:${C.textMuted};line-height:1.55;margin-top:2px;">Quick line about timing.</div>
</td></tr>
</table>
<p style="margin:0 0 28px 0;font-size:16px;line-height:1.7;color:${C.text};">
Reply to this email anytime — it lands directly in my inbox.
</p>
<p style="margin:0;font-size:16px;line-height:1.7;color:${C.text};">
Talk soon,<br>
<strong>{{first_name_signature}}</strong><br>
<span style="font-size:13px;color:${C.textMuted};">{{company}}</span>
</p>
</td></tr>`,
        ),
    },

    {
        slug: "survey",
        name: "Customer survey",
        subject: "Quick favor, {{first_name}}? (2 minutes)",
        description: "Gather customer feedback with a low-friction CTA.",
        category: "Engagement",
        renderedHtml: wrap(
            "Help us understand how to make {{company}} better for you.",
            `<tr><td style="padding:56px 48px 16px 48px;text-align:center;">
<div style="display:inline-block;width:64px;height:64px;background:${C.primaryLight};border-radius:18px;color:${C.primary};text-align:center;line-height:64px;font-size:30px;margin-bottom:24px;">💭</div>
<h1 style="margin:0 0 14px 0;font-size:26px;font-weight:700;color:${C.text};line-height:1.25;letter-spacing:-0.02em;">We'd love your honest take</h1>
<p style="margin:0;font-size:16px;color:${C.textMuted};line-height:1.6;max-width:420px;margin-left:auto;margin-right:auto;">
{{first_name}}, you've been with us a while. We're working on what comes next and your answers shape what we build.
</p>
</td></tr>

<tr><td style="padding:24px 48px 0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bgSubtle};border-radius:12px;">
<tr><td style="padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="vertical-align:middle;font-size:14px;color:${C.text};line-height:1.5;">
<strong>6 questions · ~2 minutes</strong><br>
<span style="color:${C.textMuted};">First 50 responders get a free month on us.</span>
</td>
<td align="right" style="vertical-align:middle;font-size:11px;color:${C.success};font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Free month</td>
</tr></table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:24px 48px 0 48px;text-align:center;">
${button("Take the survey")}
</td></tr>

<tr><td style="padding:32px 48px 48px 48px;text-align:center;font-size:14px;color:${C.textMuted};line-height:1.6;">
Or just hit reply with your thoughts — I read every one.
</td></tr>`,
        ),
    },

    {
        slug: "feature-spotlight",
        name: "Feature spotlight",
        subject: "Did you know about {{company}}'s newest tool?",
        description: "Educate users on a feature they may not have discovered.",
        category: "Engagement",
        renderedHtml: wrap(
            "A short walkthrough of one feature most people miss.",
            `<tr><td style="padding:0;">
<div style="position:relative;">
<img src="https://placehold.co/600x320?bg=4f46e5&fg=ffffff&font=raleway&text=" alt="" width="600" style="width:100%;height:auto;display:block;border-radius:16px 16px 0 0;" />
<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80px;height:80px;background:rgba(255,255,255,0.95);border-radius:50%;text-align:center;line-height:80px;font-size:28px;color:${C.primary};box-shadow:0 8px 24px rgba(15,23,42,0.25);">▶</div>
</div>
</td></tr>

<tr><td style="padding:32px 48px 16px 48px;">
<div style="font-size:11px;font-weight:600;color:${C.primary};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">Feature spotlight</div>
<h1 style="margin:0 0 14px 0;font-size:26px;font-weight:700;color:${C.text};letter-spacing:-0.02em;line-height:1.2;">The one feature most people miss</h1>
<p style="margin:0 0 14px 0;font-size:16px;line-height:1.65;color:${C.textMuted};">
Hey {{first_name}} — quick one. We noticed many customers haven't tried this yet, and we think you'll like it.
</p>
<p style="margin:0;font-size:16px;line-height:1.65;color:${C.textMuted};">
In one sentence: <em style="color:${C.text};">describe the value here</em>. The kind of thing that saves an hour a week if you set it up once.
</p>
</td></tr>

<tr><td style="padding:24px 48px 48px 48px;text-align:center;">
${button("Watch the 90-second demo")}
<p style="margin:20px 0 0 0;font-size:13px;color:${C.textMuted};">
Or skip the video — <a href="#" style="color:${C.primary};font-weight:600;text-decoration:none;">read how to set it up →</a>
</p>
</td></tr>`,
        ),
    },

    {
        slug: "holiday-greeting",
        name: "Holiday greeting",
        subject: "From all of us at {{company}} — thank you, {{first_name}}",
        description: "A warm seasonal note — no sales push.",
        category: "Engagement",
        renderedHtml: wrap(
            "A small thank-you from the team.",
            `<tr><td style="padding:64px 48px 48px 48px;background:linear-gradient(180deg,${C.primaryLight} 0%,${C.bg} 60%);text-align:center;">
<div style="font-size:64px;line-height:1;margin-bottom:24px;">🎉</div>
<h1 style="margin:0 0 18px 0;font-size:28px;font-weight:700;color:${C.text};line-height:1.25;letter-spacing:-0.02em;">Thank you for being part of {{company}}</h1>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:${C.textMuted};max-width:440px;margin-left:auto;margin-right:auto;">
{{first_name}}, this is just a quick note from the whole team to say thanks. People like you — who try the product, give feedback, and reply to our emails — are why we get to do this work.
</p>
<p style="margin:0;font-size:16px;line-height:1.7;color:${C.textMuted};max-width:440px;margin-left:auto;margin-right:auto;">
Wishing you a great rest of the year. We can't wait to share what's coming.
</p>
</td></tr>

<tr><td style="padding:8px 48px 56px 48px;text-align:center;">
<div style="display:inline-block;width:60px;height:1px;background:${C.border};margin:24px 0;"></div>
<p style="margin:0;font-size:14px;color:${C.text};line-height:1.6;font-style:italic;">
With gratitude,<br>
<strong style="font-style:normal;">The {{company}} team</strong>
</p>
</td></tr>`,
        ),
    },

    {
        slug: "re-engage",
        name: "Re-engagement (we miss you)",
        subject: "We've missed you, {{first_name}}",
        description: "Win back contacts who haven't been active in a while.",
        category: "Engagement",
        renderedHtml: wrap(
            "Here's what's changed since you've been away.",
            `${heroGradient(
                "It's been a minute, {{first_name}} 👋",
                "We noticed you haven't been around. Here's what's new at {{company}} — and a small welcome-back gift.",
            )}

<tr><td style="padding:24px 48px 0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
<tr><td style="padding:14px 0;border-bottom:1px solid ${C.borderSubtle};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="width:36px;vertical-align:top;font-size:20px;line-height:1;">⚡</td>
<td style="vertical-align:top;padding-left:12px;">
<div style="font-weight:600;font-size:15px;color:${C.text};letter-spacing:-0.01em;">Faster, simpler workflow</div>
<div style="font-size:13px;color:${C.textMuted};margin-top:2px;line-height:1.55;">A major shipping update you'll feel right away.</div>
</td></tr></table>
</td></tr>
<tr><td style="padding:14px 0;border-bottom:1px solid ${C.borderSubtle};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="width:36px;vertical-align:top;font-size:20px;line-height:1;">🔌</td>
<td style="vertical-align:top;padding-left:12px;">
<div style="font-weight:600;font-size:15px;color:${C.text};letter-spacing:-0.01em;">New integrations</div>
<div style="font-size:13px;color:${C.textMuted};margin-top:2px;line-height:1.55;">Works with the tools you already use.</div>
</td></tr></table>
</td></tr>
<tr><td style="padding:14px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="width:36px;vertical-align:top;font-size:20px;line-height:1;">💬</td>
<td style="vertical-align:top;padding-left:12px;">
<div style="font-weight:600;font-size:15px;color:${C.text};letter-spacing:-0.01em;">Same-day support</div>
<div style="font-size:13px;color:${C.textMuted};margin-top:2px;line-height:1.55;">Reply guaranteed within the day.</div>
</td></tr></table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:18px 22px;background:${C.primaryLight};border-radius:12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="vertical-align:middle;font-size:14px;color:${C.text};line-height:1.5;">
<strong>15% off your next month</strong><br>
<span style="color:${C.textMuted};">Welcome back. Code applied at checkout.</span>
</td>
<td align="right" style="vertical-align:middle;font-size:24px;">🎁</td>
</tr></table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:24px 48px 48px 48px;text-align:center;">
${button("Welcome me back")}
<p style="margin:18px 0 0 0;font-size:13px;color:${C.textMuted};line-height:1.6;">
Or just reply and let us know what would make {{company}} useful for you again.
</p>
</td></tr>`,
        ),
    },

    // ── Events ────────────────────────────────────────────────────────────
    {
        slug: "event-invite",
        name: "Event invitation",
        subject: "You're invited: {{company}} live event",
        description: "Drive RSVPs to a webinar, workshop, or in-person event.",
        category: "Events",
        renderedHtml: wrap(
            "Save your spot — limited capacity.",
            `${heroGradient(
                "Join us for an exclusive session",
                "Hi {{first_name}}, we'd love to have you at our upcoming event with founders, customers, and special guests.",
                "You're invited",
            )}

<tr><td style="padding:24px 48px 0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.text};border-radius:14px;color:#ffffff;">
<tr><td style="padding:28px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="vertical-align:top;width:50%;padding-right:12px;border-right:1px solid rgba(255,255,255,0.12);">
<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:6px;">When</div>
<div style="font-size:16px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;line-height:1.3;">Thu, April 18<br/>2:00 PM EST</div>
</td>
<td style="vertical-align:top;width:50%;padding-left:18px;">
<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:6px;">Where</div>
<div style="font-size:16px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;line-height:1.3;">Live online<br/><span style="color:#cbd5e1;font-weight:500;font-size:14px;">Link emailed after RSVP</span></div>
</td>
</tr></table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:32px 48px 0 48px;">
<div style="font-size:11px;font-weight:600;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;text-align:center;">Featuring</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td valign="top" style="width:33.33%;text-align:center;padding:0 6px;">
<img src="https://i.pravatar.cc/96?img=11" alt="" width="64" style="border-radius:50%;display:inline-block;margin-bottom:8px;" />
<div style="font-size:13px;font-weight:600;color:${C.text};letter-spacing:-0.01em;">Jane Cooper</div>
<div style="font-size:11px;color:${C.textMuted};margin-top:1px;">CEO</div>
</td>
<td valign="top" style="width:33.33%;text-align:center;padding:0 6px;">
<img src="https://i.pravatar.cc/96?img=33" alt="" width="64" style="border-radius:50%;display:inline-block;margin-bottom:8px;" />
<div style="font-size:13px;font-weight:600;color:${C.text};letter-spacing:-0.01em;">Marcus Lee</div>
<div style="font-size:11px;color:${C.textMuted};margin-top:1px;">Head of Product</div>
</td>
<td valign="top" style="width:33.33%;text-align:center;padding:0 6px;">
<img src="https://i.pravatar.cc/96?img=47" alt="" width="64" style="border-radius:50%;display:inline-block;margin-bottom:8px;" />
<div style="font-size:13px;font-weight:600;color:${C.text};letter-spacing:-0.01em;">Sara Patel</div>
<div style="font-size:11px;color:${C.textMuted};margin-top:1px;">Customer</div>
</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:32px 48px 0 48px;text-align:center;">
${button("RSVP — save my spot")}
</td></tr>

<tr><td style="padding:24px 48px 48px 48px;text-align:center;font-size:13px;color:${C.textMuted};line-height:1.6;">
Can't make it? <a href="#" style="color:${C.primary};font-weight:600;text-decoration:none;">Add to calendar</a> &middot; <a href="#" style="color:${C.primary};font-weight:600;text-decoration:none;">Share with a friend</a>
</td></tr>`,
        ),
    },

    // ── Transactional ────────────────────────────────────────────────────
    {
        slug: "receipt",
        name: "Order receipt",
        subject: "Your {{company}} order #1042",
        description: "Transactional confirmation after purchase.",
        category: "Transactional",
        renderedHtml: wrap(
            "Order confirmed — here's your receipt.",
            `<tr><td style="padding:48px 48px 16px 48px;">
<div style="display:inline-block;width:48px;height:48px;background:${C.success};color:#ffffff;border-radius:14px;text-align:center;line-height:48px;font-size:24px;margin-bottom:18px;">✓</div>
<h1 style="margin:0 0 6px 0;font-size:24px;font-weight:700;color:${C.text};letter-spacing:-0.02em;line-height:1.2;">Thanks for your order, {{first_name}}</h1>
<p style="margin:0;font-size:14px;color:${C.textMuted};">
Order <strong style="color:${C.text};">#1042</strong> &middot; placed on Apr 12, 2026
</p>
</td></tr>

<tr><td style="padding:24px 48px 0 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.border};border-radius:14px;overflow:hidden;">
<tr><td style="padding:18px 22px;border-bottom:1px solid ${C.borderSubtle};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td><div style="font-weight:600;color:${C.text};font-size:15px;letter-spacing:-0.01em;">Product name</div><div style="font-size:12px;color:${C.textMuted};margin-top:2px;">Qty 1</div></td>
<td align="right" style="font-weight:700;color:${C.text};font-size:15px;tabular-nums;">$49.00</td>
</tr></table>
</td></tr>
<tr><td style="padding:18px 22px;border-bottom:1px solid ${C.borderSubtle};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td><div style="font-weight:600;color:${C.text};font-size:15px;letter-spacing:-0.01em;">Another item</div><div style="font-size:12px;color:${C.textMuted};margin-top:2px;">Qty 2</div></td>
<td align="right" style="font-weight:700;color:${C.text};font-size:15px;">$30.00</td>
</tr></table>
</td></tr>
<tr><td style="padding:18px 22px;background:${C.bgSubtle};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="color:${C.textMuted};font-size:13px;padding-bottom:6px;">Shipping</td>
<td align="right" style="color:${C.textMuted};font-size:13px;padding-bottom:6px;">$5.00</td>
</tr><tr>
<td style="color:${C.textMuted};font-size:13px;padding-bottom:10px;">Tax</td>
<td align="right" style="color:${C.textMuted};font-size:13px;padding-bottom:10px;">$5.95</td>
</tr><tr>
<td style="font-weight:700;color:${C.text};font-size:18px;padding-top:10px;border-top:1px solid ${C.border};letter-spacing:-0.01em;">Total</td>
<td align="right" style="font-weight:700;color:${C.text};font-size:18px;padding-top:10px;border-top:1px solid ${C.border};">$89.95</td>
</tr></table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:28px 48px 0 48px;text-align:center;">
${button("View order details")}
</td></tr>

<tr><td style="padding:24px 48px 48px 48px;text-align:center;font-size:13px;color:${C.textMuted};line-height:1.6;">
Questions about your order? <a href="#" style="color:${C.primary};font-weight:600;text-decoration:none;">Contact support</a>
</td></tr>`,
        ),
    },
]
