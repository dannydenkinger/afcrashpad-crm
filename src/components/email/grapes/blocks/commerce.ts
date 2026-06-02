import { COLORS, FONT, ICON, button as btn, type VestaBlock } from "./types"

export const COMMERCE_BLOCKS: VestaBlock[] = [
    {
        id: "vesta-product-card",
        label: "Product card",
        category: "Commerce",
        media: ICON(
            '<rect x="5" y="3" width="14" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="6" y1="16" x2="18" y2="16" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="19" x2="14" y2="19" stroke="currentColor" stroke-width="1.5"/><rect x="6" y="21" width="7" height="0.5" fill="currentColor"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:340px;border-collapse:collapse;border:1px solid ${COLORS.border};border-radius:14px;overflow:hidden;font-family:${FONT};margin:0 auto;background:${COLORS.bg};">
<tr><td><img src="https://placehold.co/340x240?bg=eef2ff&fg=4f46e5" alt="Product" width="340" style="width:100%;height:auto;display:block;" /></td></tr>
<tr><td style="padding:18px 20px;">
<div style="font-size:11px;font-weight:600;color:${COLORS.primary};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">New</div>
<h3 style="margin:0 0 6px 0;font-size:17px;font-weight:600;color:${COLORS.text};letter-spacing:-0.01em;">Product name</h3>
<p style="margin:0 0 16px 0;font-size:13px;color:${COLORS.textMuted};line-height:1.55;">Short description of the product. One sentence is plenty.</p>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;">
<tr>
<td style="vertical-align:middle;font-size:20px;font-weight:700;color:${COLORS.text};letter-spacing:-0.02em;">$49</td>
<td align="right">${btn("Shop now", "#", "primary")}</td>
</tr>
</table>
</td></tr>
</table>`,
    },
    {
        id: "vesta-product-grid",
        label: "Product grid (3)",
        category: "Commerce",
        media: ICON(
            '<rect x="2" y="4" width="6" height="16" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="9" y="4" width="6" height="16" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="16" y="4" width="6" height="16" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};">
<tr>
<td valign="top" style="width:33.33%;padding:8px;">
<img src="https://placehold.co/180x160?bg=eef2ff&fg=4f46e5" alt="" width="180" style="width:100%;height:auto;display:block;border-radius:10px;" />
<div style="padding:10px 4px;">
<div style="font-size:14px;color:${COLORS.text};font-weight:600;letter-spacing:-0.01em;">Product one</div>
<div style="font-size:14px;color:${COLORS.text};font-weight:700;margin-top:3px;">$29</div>
</div>
</td>
<td valign="top" style="width:33.33%;padding:8px;">
<img src="https://placehold.co/180x160?bg=eef2ff&fg=4f46e5" alt="" width="180" style="width:100%;height:auto;display:block;border-radius:10px;" />
<div style="padding:10px 4px;">
<div style="font-size:14px;color:${COLORS.text};font-weight:600;letter-spacing:-0.01em;">Product two</div>
<div style="font-size:14px;color:${COLORS.text};font-weight:700;margin-top:3px;">$49</div>
</div>
</td>
<td valign="top" style="width:33.33%;padding:8px;">
<img src="https://placehold.co/180x160?bg=eef2ff&fg=4f46e5" alt="" width="180" style="width:100%;height:auto;display:block;border-radius:10px;" />
<div style="padding:10px 4px;">
<div style="font-size:14px;color:${COLORS.text};font-weight:600;letter-spacing:-0.01em;">Product three</div>
<div style="font-size:14px;color:${COLORS.text};font-weight:700;margin-top:3px;">$79</div>
</div>
</td>
</tr>
</table>`,
    },
    {
        id: "vesta-pricing-table",
        label: "Pricing table",
        category: "Commerce",
        media: ICON(
            '<rect x="3" y="4" width="8" height="16" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="13" y="4" width="8" height="16" rx="1" fill="currentColor" opacity="0.2"/><rect x="13" y="4" width="8" height="16" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};">
<tr>
<td valign="top" style="width:50%;padding:8px;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:14px;">
<tr><td style="padding:28px 24px;">
<div style="font-size:12px;font-weight:600;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.08em;">Starter</div>
<div style="font-size:32px;font-weight:700;color:${COLORS.text};margin:6px 0 4px 0;letter-spacing:-0.02em;line-height:1;">$19<span style="font-size:14px;font-weight:500;color:${COLORS.textMuted};letter-spacing:0;">/mo</span></div>
<p style="margin:0 0 18px 0;font-size:13px;color:${COLORS.textMuted};line-height:1.5;">For solo creators getting started.</p>
<ul style="margin:0 0 18px 0;padding-left:18px;font-size:14px;color:${COLORS.text};line-height:1.85;">
<li>Up to 5 users</li>
<li>Basic support</li>
<li>Core features</li>
</ul>
${btn("Choose Starter", "#", "secondary")}
</td></tr>
</table>
</td>
<td valign="top" style="width:50%;padding:8px;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;background:${COLORS.text};color:#fff;border-radius:14px;box-shadow:0 8px 24px rgba(15,23,42,0.16);">
<tr><td style="padding:28px 24px;position:relative;">
<div style="display:inline-block;padding:4px 10px;background:${COLORS.primary};color:#fff;font-size:10px;font-weight:700;border-radius:999px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Popular</div>
<div style="font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Pro</div>
<div style="font-size:32px;font-weight:700;color:#fff;margin:6px 0 4px 0;letter-spacing:-0.02em;line-height:1;">$49<span style="font-size:14px;font-weight:500;color:#94a3b8;letter-spacing:0;">/mo</span></div>
<p style="margin:0 0 18px 0;font-size:13px;color:#cbd5e1;line-height:1.5;">For growing teams that need more.</p>
<ul style="margin:0 0 18px 0;padding-left:18px;font-size:14px;color:#cbd5e1;line-height:1.85;">
<li>Unlimited users</li>
<li>Priority support</li>
<li>All features + API</li>
</ul>
<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:10px;background:#fff;"><a href="#" style="display:inline-block;padding:13px 30px;color:${COLORS.text};font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">Choose Pro</a></td></tr></table>
</td></tr>
</table>
</td>
</tr>
</table>`,
    },
    {
        id: "vesta-coupon",
        label: "Coupon code",
        category: "Commerce",
        media: ICON(
            '<rect x="3" y="7" width="18" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="3 2"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;margin:24px auto;border-collapse:collapse;font-family:${FONT};">
<tr><td style="padding:32px 28px;background:${COLORS.primaryLight};border:2px dashed ${COLORS.primary};border-radius:14px;text-align:center;">
<div style="font-size:11px;color:${COLORS.primary};font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Exclusive offer</div>
<div style="font-size:34px;font-weight:800;color:${COLORS.text};letter-spacing:0.12em;line-height:1;">SAVE25</div>
<div style="font-size:13px;color:${COLORS.textMuted};margin-top:10px;">Valid through Friday · 25% off your next order</div>
</td></tr>
</table>`,
    },
    {
        id: "vesta-countdown",
        label: "Countdown",
        category: "Commerce",
        media: ICON(
            '<circle cx="12" cy="13" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="13" x2="15" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9 4h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:20px auto;font-family:${FONT};">
<tr>
<td align="center" style="padding:0 6px;">
<div style="background:${COLORS.text};color:#fff;padding:14px 18px;border-radius:12px;min-width:64px;box-shadow:0 4px 12px rgba(15,23,42,0.12);">
<div style="font-size:28px;font-weight:700;letter-spacing:-0.02em;line-height:1;">03</div>
<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.1em;margin-top:6px;">Days</div>
</div>
</td>
<td align="center" style="padding:0 6px;">
<div style="background:${COLORS.text};color:#fff;padding:14px 18px;border-radius:12px;min-width:64px;box-shadow:0 4px 12px rgba(15,23,42,0.12);">
<div style="font-size:28px;font-weight:700;letter-spacing:-0.02em;line-height:1;">12</div>
<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.1em;margin-top:6px;">Hours</div>
</div>
</td>
<td align="center" style="padding:0 6px;">
<div style="background:${COLORS.text};color:#fff;padding:14px 18px;border-radius:12px;min-width:64px;box-shadow:0 4px 12px rgba(15,23,42,0.12);">
<div style="font-size:28px;font-weight:700;letter-spacing:-0.02em;line-height:1;">45</div>
<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.1em;margin-top:6px;">Mins</div>
</div>
</td>
</tr>
</table>
<p style="text-align:center;font-size:12px;color:${COLORS.textMuted};margin:6px 0 0 0;font-family:${FONT};">Static display. For animated countdowns in email, use a service like motioncdn.net.</p>`,
    },
]
