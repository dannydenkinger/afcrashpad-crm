import { COLORS, FONT, ICON, type VestaBlock } from "./types"

export const HEADER_BLOCKS: VestaBlock[] = [
    {
        id: "vesta-preheader",
        label: "Pre-header",
        category: "Headers",
        media: ICON(
            '<line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/><text x="12" y="9" font-size="5" font-family="sans-serif" fill="currentColor" text-anchor="middle">HIDDEN</text>',
        ),
        content:
            '<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f8fafc;opacity:0;">This text shows in inbox previews — write something compelling that gets the open.</div>',
    },
    {
        id: "vesta-header-logo",
        label: "Logo header",
        category: "Headers",
        media: ICON(
            '<rect x="3" y="4" width="18" height="6" rx="1" fill="currentColor" opacity="0.1"/><rect x="3" y="4" width="18" height="6" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="7" r="1.5" fill="currentColor"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${COLORS.bg};"><tr><td align="center" style="padding:36px 24px 28px 24px;border-bottom:1px solid ${COLORS.borderSubtle};"><img src="https://placehold.co/160x44?text=YOUR+LOGO&bg=ffffff&fg=0f172a&font=raleway" alt="Your logo" width="160" style="display:inline-block;" /></td></tr></table>`,
    },
    {
        id: "vesta-header-nav",
        label: "Nav header",
        category: "Headers",
        media: ICON(
            '<rect x="3" y="4" width="18" height="6" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="7" cy="7" r="1" fill="currentColor"/><line x1="12" y1="7" x2="14" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="15.5" y1="7" x2="17.5" y2="7" stroke="currentColor" stroke-width="1.2"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};border-bottom:1px solid ${COLORS.borderSubtle};">
<tr>
<td valign="middle" style="padding:24px;">
<img src="https://placehold.co/130x36?text=LOGO&bg=ffffff&fg=0f172a&font=raleway" alt="Logo" width="130" style="display:block;" />
</td>
<td valign="middle" align="right" style="padding:24px;">
<a href="#" style="color:${COLORS.text};text-decoration:none;font-size:14px;font-weight:500;padding:0 12px;letter-spacing:-0.01em;">Home</a>
<a href="#" style="color:${COLORS.text};text-decoration:none;font-size:14px;font-weight:500;padding:0 12px;letter-spacing:-0.01em;">About</a>
<a href="#" style="color:${COLORS.text};text-decoration:none;font-size:14px;font-weight:500;padding:0 12px;letter-spacing:-0.01em;">Contact</a>
</td>
</tr>
</table>`,
    },
]

export const FOOTER_BLOCKS: VestaBlock[] = [
    {
        id: "vesta-footer-simple",
        label: "Simple footer",
        category: "Footers",
        media: ICON(
            '<rect x="3" y="14" width="18" height="6" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="7" y1="17" x2="17" y2="17" stroke="currentColor" stroke-width="1.2"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};">
<tr><td align="center" style="padding:32px 24px;color:${COLORS.textMuted};font-size:12px;line-height:1.7;border-top:1px solid ${COLORS.borderSubtle};">
<strong style="color:${COLORS.text};font-weight:600;">{{company}}</strong> · 123 Main St, City, State 12345<br>
© <span style="color:${COLORS.textSubtle};">{{company}}. All rights reserved.</span>
</td></tr>
</table>`,
    },
    {
        id: "vesta-footer-social",
        label: "Social footer",
        category: "Footers",
        media: ICON(
            '<rect x="3" y="10" width="18" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="9" cy="15" r="1.5" fill="currentColor"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/><circle cx="15" cy="15" r="1.5" fill="currentColor"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};">
<tr><td align="center" style="padding:36px 24px;border-top:1px solid ${COLORS.borderSubtle};">
<div style="margin-bottom:14px;font-size:13px;color:${COLORS.text};font-weight:600;letter-spacing:-0.01em;">Stay in touch</div>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;">
<tr>
<td style="padding:0 5px;"><a href="https://facebook.com" style="display:inline-block;width:34px;height:34px;background:${COLORS.bgSubtle};border-radius:50%;color:${COLORS.text};text-align:center;line-height:34px;font-weight:700;text-decoration:none;font-size:14px;">f</a></td>
<td style="padding:0 5px;"><a href="https://twitter.com" style="display:inline-block;width:34px;height:34px;background:${COLORS.bgSubtle};border-radius:50%;color:${COLORS.text};text-align:center;line-height:34px;font-weight:700;text-decoration:none;font-size:14px;">𝕏</a></td>
<td style="padding:0 5px;"><a href="https://linkedin.com" style="display:inline-block;width:34px;height:34px;background:${COLORS.bgSubtle};border-radius:50%;color:${COLORS.text};text-align:center;line-height:34px;font-weight:700;text-decoration:none;font-size:12px;">in</a></td>
</tr>
</table>
<div style="color:${COLORS.textMuted};font-size:12px;line-height:1.7;">
© <span style="color:${COLORS.text};font-weight:500;">{{company}}</span>. All rights reserved.<br>
<span style="color:${COLORS.textSubtle};">123 Main St, City, State 12345</span>
</div>
</td></tr>
</table>`,
    },
    {
        id: "vesta-footer-compliance",
        label: "Compliance footer",
        category: "Footers",
        media: ICON(
            '<rect x="3" y="8" width="18" height="12" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" stroke-width="1"/><line x1="6" y1="15" x2="16" y2="15" stroke="currentColor" stroke-width="1"/><line x1="6" y1="18" x2="12" y2="18" stroke="currentColor" stroke-width="1"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};">
<tr><td align="center" style="padding:36px 24px;background:${COLORS.bgSubtle};color:${COLORS.textMuted};font-size:12px;line-height:1.7;">
<div style="font-size:14px;font-weight:700;color:${COLORS.text};margin-bottom:6px;letter-spacing:-0.01em;">{{company}}</div>
<div style="color:${COLORS.textMuted};">123 Main Street · City, State 12345 · United States</div>
<div style="margin:14px 0;">
<a href="{{unsubscribe_url}}" style="color:${COLORS.textMuted};text-decoration:underline;margin:0 8px;">Unsubscribe</a> ·
<a href="#" style="color:${COLORS.textMuted};text-decoration:underline;margin:0 8px;">View in browser</a> ·
<a href="#" style="color:${COLORS.textMuted};text-decoration:underline;margin:0 8px;">Privacy policy</a>
</div>
<div style="font-size:11px;color:${COLORS.textSubtle};margin-top:8px;">You received this because you signed up on our website. © {{company}}.</div>
</td></tr>
</table>`,
    },
]
