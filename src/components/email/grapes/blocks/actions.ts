import { COLORS, FONT, ICON, button as btn, type VestaBlock } from "./types"

export const ACTIONS_BLOCKS: VestaBlock[] = [
    {
        id: "vesta-button-primary",
        label: "Button",
        category: "Actions",
        media: ICON(
            '<rect x="4" y="8" width="16" height="8" rx="4" fill="currentColor"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px auto;"><tr><td>${btn("Get started", "#", "primary")}</td></tr></table>`,
    },
    {
        id: "vesta-button-secondary",
        label: "Button (outline)",
        category: "Actions",
        media: ICON(
            '<rect x="4" y="8" width="16" height="8" rx="4" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px auto;"><tr><td>${btn("Learn more", "#", "secondary")}</td></tr></table>`,
    },
    {
        id: "vesta-button-pill",
        label: "Pill button",
        category: "Actions",
        media: ICON(
            '<rect x="4" y="8" width="16" height="8" rx="8" fill="currentColor"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px auto;"><tr><td>${btn("Sign up free", "#", "pill")}</td></tr></table>`,
    },
    {
        id: "vesta-button-row",
        label: "Button row",
        category: "Actions",
        media: ICON(
            '<rect x="2" y="9" width="8" height="6" rx="2" fill="currentColor"/><rect x="14" y="9" width="8" height="6" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px auto;">
<tr>
<td style="padding:0 6px;">${btn("Buy now", "#", "primary")}</td>
<td style="padding:0 6px;">${btn("View demo", "#", "secondary")}</td>
</tr>
</table>`,
    },
    {
        id: "vesta-social-icons",
        label: "Social icons",
        category: "Actions",
        media: ICON(
            '<circle cx="6" cy="12" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="18" cy="12" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:20px auto;font-family:${FONT};">
<tr>
<td style="padding:0 6px;"><a href="https://facebook.com" style="display:inline-block;width:36px;height:36px;background:${COLORS.bgSubtle};border-radius:50%;color:${COLORS.text};text-align:center;line-height:36px;font-weight:700;text-decoration:none;font-size:15px;">f</a></td>
<td style="padding:0 6px;"><a href="https://twitter.com" style="display:inline-block;width:36px;height:36px;background:${COLORS.bgSubtle};border-radius:50%;color:${COLORS.text};text-align:center;line-height:36px;font-weight:700;text-decoration:none;font-size:15px;">𝕏</a></td>
<td style="padding:0 6px;"><a href="https://linkedin.com" style="display:inline-block;width:36px;height:36px;background:${COLORS.bgSubtle};border-radius:50%;color:${COLORS.text};text-align:center;line-height:36px;font-weight:700;text-decoration:none;font-size:13px;">in</a></td>
<td style="padding:0 6px;"><a href="https://instagram.com" style="display:inline-block;width:36px;height:36px;background:${COLORS.bgSubtle};border-radius:50%;color:${COLORS.text};text-align:center;line-height:36px;font-weight:700;text-decoration:none;font-size:13px;">IG</a></td>
<td style="padding:0 6px;"><a href="https://youtube.com" style="display:inline-block;width:36px;height:36px;background:${COLORS.bgSubtle};border-radius:50%;color:${COLORS.text};text-align:center;line-height:36px;font-weight:700;text-decoration:none;font-size:13px;">▶</a></td>
</tr>
</table>`,
    },
    {
        id: "vesta-nav-menu",
        label: "Nav menu",
        category: "Actions",
        media: ICON(
            '<line x1="3" y1="12" x2="8" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="17" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:16px auto;font-family:${FONT};">
<tr>
<td style="padding:0 14px;"><a href="#" style="color:${COLORS.text};text-decoration:none;font-size:14px;font-weight:500;letter-spacing:-0.01em;">Home</a></td>
<td style="padding:0 14px;"><a href="#" style="color:${COLORS.text};text-decoration:none;font-size:14px;font-weight:500;letter-spacing:-0.01em;">Features</a></td>
<td style="padding:0 14px;"><a href="#" style="color:${COLORS.text};text-decoration:none;font-size:14px;font-weight:500;letter-spacing:-0.01em;">Pricing</a></td>
<td style="padding:0 14px;"><a href="#" style="color:${COLORS.text};text-decoration:none;font-size:14px;font-weight:500;letter-spacing:-0.01em;">Contact</a></td>
</tr>
</table>`,
    },
]
