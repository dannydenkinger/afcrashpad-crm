import { COLORS, FONT, ICON, type VestaBlock } from "./types"

export const MEDIA_BLOCKS: VestaBlock[] = [
    {
        id: "vesta-image",
        label: "Image",
        category: "Media",
        media: ICON(
            '<rect x="3" y="4" width="18" height="16" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="9" cy="10" r="2" fill="currentColor"/><path d="M3 17l5-5 4 4 3-3 6 6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;"><tr><td style="padding:16px;text-align:center;"><img src="https://placehold.co/600x340?text=&font=raleway&bg=eef2ff&fg=4f46e5" alt="" width="600" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,0.06);" /></td></tr></table>`,
    },
    {
        id: "vesta-image-text-left",
        label: "Image + text",
        category: "Media",
        media: ICON(
            '<rect x="3" y="5" width="8" height="14" rx="1" fill="currentColor" opacity="0.3"/><line x1="13" y1="8" x2="21" y2="8" stroke="currentColor" stroke-width="1.5"/><line x1="13" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="13" y1="16" x2="18" y2="16" stroke="currentColor" stroke-width="1.5"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};margin:16px auto;">
<tr>
<td valign="top" style="width:45%;padding:16px;">
<img src="https://placehold.co/280x220?bg=eef2ff&fg=4f46e5&font=raleway" alt="" width="280" style="max-width:100%;height:auto;display:block;border-radius:10px;" />
</td>
<td valign="top" style="width:55%;padding:24px 16px;">
<h3 style="margin:0 0 8px 0;font-size:20px;font-weight:600;color:${COLORS.text};letter-spacing:-0.01em;line-height:1.3;">Section headline</h3>
<p style="margin:0 0 14px 0;font-size:14px;color:${COLORS.textMuted};line-height:1.55;">A short paragraph about whatever&rsquo;s in the image. Keep it tight — one idea per row.</p>
<a href="#" style="color:${COLORS.primary};text-decoration:none;font-size:14px;font-weight:600;">Read more →</a>
</td>
</tr>
</table>`,
    },
    {
        id: "vesta-logo",
        label: "Logo",
        category: "Media",
        media: ICON(
            '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" fill="none"/><text x="12" y="16" text-anchor="middle" font-size="9" font-family="sans-serif" font-weight="700" fill="currentColor">LOGO</text>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;"><tr><td style="padding:32px;text-align:center;"><img src="https://placehold.co/180x52?text=YOUR+LOGO&bg=ffffff&fg=0f172a&font=raleway" alt="Your logo" width="180" style="display:inline-block;" /></td></tr></table>`,
    },
    {
        id: "vesta-video",
        label: "Video (thumbnail)",
        category: "Media",
        media: ICON(
            '<rect x="3" y="5" width="18" height="14" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><polygon points="10,9 10,15 15,12" fill="currentColor"/>',
        ),
        content: `<a href="https://www.youtube.com/" style="display:block;max-width:600px;margin:16px auto;position:relative;text-decoration:none;">
<img src="https://placehold.co/600x340?bg=0f172a&fg=ffffff&text=&font=raleway" alt="Play video" width="600" style="max-width:100%;height:auto;display:block;border-radius:12px;" />
<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72px;height:72px;background:rgba(255,255,255,0.95);border-radius:50%;color:${COLORS.primary};text-align:center;line-height:72px;font-size:24px;box-shadow:0 4px 16px rgba(15,23,42,0.25);">▶</div>
</a>`,
    },
    {
        id: "vesta-icon-block",
        label: "Icon",
        category: "Media",
        media: ICON(
            '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
        ),
        content: `<div style="text-align:center;padding:20px;">
<div style="display:inline-block;width:64px;height:64px;background:${COLORS.primaryLight};border-radius:16px;line-height:64px;font-size:32px;">🎉</div>
</div>`,
    },
]
