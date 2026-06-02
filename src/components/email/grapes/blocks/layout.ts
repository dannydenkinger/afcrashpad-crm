import { COLORS, FONT, ICON, button, section, type VestaBlock } from "./types"

export const LAYOUT_BLOCKS: VestaBlock[] = [
    {
        id: "vesta-section",
        label: "Section",
        category: "Layout",
        media: ICON(
            '<rect x="3" y="5" width="18" height="14" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: section(
            `<div style="padding:32px;background:${COLORS.bgSubtle};border-radius:12px;text-align:center;color:${COLORS.textMuted};font-family:${FONT};font-size:14px;">Drop blocks here</div>`,
        ),
    },
    {
        id: "vesta-columns-2",
        label: "2 columns",
        category: "Layout",
        media: ICON(
            '<rect x="3" y="5" width="8" height="14" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="13" y="5" width="8" height="14" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};">
<tr>
<td valign="top" style="width:50%;padding:16px;color:${COLORS.text};font-size:15px;line-height:1.6;">Left column. Drop blocks here.</td>
<td valign="top" style="width:50%;padding:16px;color:${COLORS.text};font-size:15px;line-height:1.6;">Right column. Drop blocks here.</td>
</tr>
</table>`,
    },
    {
        id: "vesta-columns-3",
        label: "3 columns",
        category: "Layout",
        media: ICON(
            '<rect x="2" y="5" width="6" height="14" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="9" y="5" width="6" height="14" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="16" y="5" width="6" height="14" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};">
<tr>
<td valign="top" style="width:33.33%;padding:12px;color:${COLORS.text};font-size:14px;line-height:1.6;">Column 1 content.</td>
<td valign="top" style="width:33.33%;padding:12px;color:${COLORS.text};font-size:14px;line-height:1.6;">Column 2 content.</td>
<td valign="top" style="width:33.33%;padding:12px;color:${COLORS.text};font-size:14px;line-height:1.6;">Column 3 content.</td>
</tr>
</table>`,
    },
    {
        id: "vesta-columns-4",
        label: "4 columns",
        category: "Layout",
        media: ICON(
            '<rect x="1.5" y="5" width="4.5" height="14" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="7" y="5" width="4.5" height="14" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="12.5" y="5" width="4.5" height="14" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="18" y="5" width="4.5" height="14" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};">
<tr>
<td valign="top" style="width:25%;padding:8px;color:${COLORS.text};font-size:13px;line-height:1.6;">Item 1</td>
<td valign="top" style="width:25%;padding:8px;color:${COLORS.text};font-size:13px;line-height:1.6;">Item 2</td>
<td valign="top" style="width:25%;padding:8px;color:${COLORS.text};font-size:13px;line-height:1.6;">Item 3</td>
<td valign="top" style="width:25%;padding:8px;color:${COLORS.text};font-size:13px;line-height:1.6;">Item 4</td>
</tr>
</table>`,
    },
    {
        id: "vesta-divider",
        label: "Divider",
        category: "Layout",
        media: ICON('<line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>'),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;"><tr><td style="padding:24px 0;"><hr style="border:none;border-top:1px solid ${COLORS.border};margin:0;" /></td></tr></table>`,
    },
    {
        id: "vesta-spacer",
        label: "Spacer",
        category: "Layout",
        media: ICON(
            '<line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="2" stroke-dasharray="2 3"/>',
        ),
        content:
            '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;"><tr><td style="height:48px;line-height:48px;font-size:1px;">&nbsp;</td></tr></table>',
    },
    {
        id: "vesta-hero",
        label: "Hero",
        category: "Layout",
        media: ICON(
            '<rect x="3" y="4" width="18" height="10" rx="1" fill="currentColor" opacity="0.2"/><rect x="3" y="4" width="18" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="8" y="16" width="8" height="3" rx="0.5" fill="currentColor"/>',
        ),
        content: section(
            `<div style="padding:64px 32px;background:linear-gradient(180deg,${COLORS.primaryLight} 0%,${COLORS.bg} 100%);border-radius:16px;text-align:center;font-family:${FONT};">
<div style="display:inline-block;padding:6px 14px;background:${COLORS.primary};color:#ffffff;font-size:11px;font-weight:600;border-radius:999px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:20px;">New release</div>
<h1 style="margin:0 0 16px 0;font-size:36px;font-weight:700;color:${COLORS.text};line-height:1.15;letter-spacing:-0.02em;">A headline that converts</h1>
<p style="margin:0 0 32px 0;font-size:17px;color:${COLORS.textMuted};line-height:1.55;max-width:480px;margin-left:auto;margin-right:auto;">A short, specific subheading that tells readers exactly who this is for and what they&rsquo;ll get out of it.</p>
<div style="display:inline-block;">${button("Get started", "#", "primary")}</div>
</div>`,
        ),
    },
]
