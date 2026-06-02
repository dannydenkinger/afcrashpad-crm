import { COLORS, FONT, ICON, type VestaBlock } from "./types"

export const CONTENT_BLOCKS: VestaBlock[] = [
    {
        id: "vesta-heading",
        label: "Heading",
        category: "Content",
        media: ICON(
            '<text x="4" y="18" font-size="16" font-family="sans-serif" font-weight="700" fill="currentColor">H1</text>',
        ),
        content: `<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:30px;font-weight:700;color:${COLORS.text};line-height:1.2;letter-spacing:-0.02em;">Your section heading</h1>`,
    },
    {
        id: "vesta-paragraph",
        label: "Paragraph",
        category: "Content",
        media: ICON(
            '<line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="17" x2="14" y2="17" stroke="currentColor" stroke-width="1.5"/>',
        ),
        content: `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;color:${COLORS.text};line-height:1.65;">A short, conversational paragraph that reads naturally on small screens. Aim for around 65-75 characters per line so people don&rsquo;t lose their place when they scan.</p>`,
    },
    {
        id: "vesta-quote",
        label: "Block quote",
        category: "Content",
        media: ICON(
            '<path d="M6 7 4 11v6h5v-6H6.5L8 7zm8 0-2 4v6h5v-6h-2.5L16 7z" fill="currentColor"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:24px 28px;background:${COLORS.bgSubtle};border-left:3px solid ${COLORS.primary};border-radius:0 8px 8px 0;font-family:${FONT};">
<p style="margin:0;font-size:18px;font-style:italic;color:${COLORS.text};line-height:1.55;letter-spacing:-0.01em;">&ldquo;A pull quote that lands the point in one or two sentences.&rdquo;</p>
<div style="margin-top:12px;font-size:13px;color:${COLORS.textMuted};font-weight:500;">— Author Name, Title</div>
</td></tr>
</table>`,
    },
    {
        id: "vesta-list-ul",
        label: "Bullet list",
        category: "Content",
        media: ICON(
            '<circle cx="5" cy="7" r="1.5" fill="currentColor"/><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="5" cy="17" r="1.5" fill="currentColor"/><line x1="10" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="17" x2="17" y2="17" stroke="currentColor" stroke-width="1.5"/>',
        ),
        content: `<ul style="margin:0 0 16px 0;padding-left:22px;font-family:${FONT};font-size:16px;color:${COLORS.text};line-height:1.75;">
<li>First benefit or talking point</li>
<li>Second benefit or talking point</li>
<li>Third benefit or talking point</li>
</ul>`,
    },
    {
        id: "vesta-list-ol",
        label: "Numbered list",
        category: "Content",
        media: ICON(
            '<text x="3" y="9" font-size="6" font-family="sans-serif" fill="currentColor">1.</text><text x="3" y="14" font-size="6" font-family="sans-serif" fill="currentColor">2.</text><text x="3" y="19" font-size="6" font-family="sans-serif" fill="currentColor">3.</text><line x1="10" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="17" x2="17" y2="17" stroke="currentColor" stroke-width="1.5"/>',
        ),
        content: `<ol style="margin:0 0 16px 0;padding-left:22px;font-family:${FONT};font-size:16px;color:${COLORS.text};line-height:1.75;">
<li>First step</li>
<li>Second step</li>
<li>Third step</li>
</ol>`,
    },
    {
        id: "vesta-feature-grid",
        label: "Feature grid",
        category: "Content",
        media: ICON(
            '<rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="13" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="3" y="13" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="13" y="13" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};margin:16px auto;">
<tr>
<td valign="top" style="width:33.33%;padding:16px;text-align:center;">
<div style="display:inline-block;width:48px;height:48px;background:${COLORS.primaryLight};border-radius:12px;line-height:48px;font-size:22px;margin-bottom:12px;">⚡</div>
<h3 style="margin:0 0 6px 0;font-size:15px;font-weight:600;color:${COLORS.text};letter-spacing:-0.01em;">Lightning fast</h3>
<p style="margin:0;font-size:13px;color:${COLORS.textMuted};line-height:1.55;">Short benefit statement. Keep it punchy.</p>
</td>
<td valign="top" style="width:33.33%;padding:16px;text-align:center;">
<div style="display:inline-block;width:48px;height:48px;background:${COLORS.primaryLight};border-radius:12px;line-height:48px;font-size:22px;margin-bottom:12px;">🔒</div>
<h3 style="margin:0 0 6px 0;font-size:15px;font-weight:600;color:${COLORS.text};letter-spacing:-0.01em;">Built secure</h3>
<p style="margin:0;font-size:13px;color:${COLORS.textMuted};line-height:1.55;">Short benefit statement. Keep it punchy.</p>
</td>
<td valign="top" style="width:33.33%;padding:16px;text-align:center;">
<div style="display:inline-block;width:48px;height:48px;background:${COLORS.primaryLight};border-radius:12px;line-height:48px;font-size:22px;margin-bottom:12px;">🎯</div>
<h3 style="margin:0 0 6px 0;font-size:15px;font-weight:600;color:${COLORS.text};letter-spacing:-0.01em;">On point</h3>
<p style="margin:0;font-size:13px;color:${COLORS.textMuted};line-height:1.55;">Short benefit statement. Keep it punchy.</p>
</td>
</tr>
</table>`,
    },
    {
        id: "vesta-testimonial",
        label: "Testimonial",
        category: "Content",
        media: ICON(
            '<path d="M6 7 4 11v6h5v-6H6.5L8 7z" fill="currentColor"/><circle cx="16" cy="15" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;margin:16px auto;">
<tr><td style="padding:32px;background:${COLORS.bgSubtle};border-radius:16px;font-family:${FONT};">
<div style="font-size:36px;line-height:1;color:${COLORS.primary};font-family:Georgia,serif;margin-bottom:12px;">&ldquo;</div>
<p style="margin:0 0 20px 0;font-size:18px;color:${COLORS.text};line-height:1.55;letter-spacing:-0.01em;">A specific, believable, results-oriented quote from a real customer. Avoid vague praise — name the outcome.</p>
<table role="presentation" border="0" cellpadding="0" cellspacing="0">
<tr>
<td style="padding-right:14px;vertical-align:middle;"><img src="https://i.pravatar.cc/96?img=11" alt="" width="44" height="44" style="border-radius:50%;display:block;" /></td>
<td style="vertical-align:middle;">
<div style="font-size:14px;font-weight:600;color:${COLORS.text};letter-spacing:-0.01em;">Jane Cooper</div>
<div style="font-size:12px;color:${COLORS.textMuted};margin-top:1px;">CEO, Acme Inc.</div>
</td>
</tr>
</table>
</td></tr>
</table>`,
    },
    {
        id: "vesta-star-rating",
        label: "Star rating",
        category: "Content",
        media: ICON(
            '<path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" fill="currentColor"/>',
        ),
        content: `<div style="text-align:center;padding:20px;font-family:${FONT};"><span style="font-size:32px;letter-spacing:6px;color:${COLORS.accent};line-height:1;">★★★★★</span><div style="margin-top:10px;font-size:13px;color:${COLORS.textMuted};">5.0 from <strong style="color:${COLORS.text};">1,247 reviews</strong></div></div>`,
    },
    {
        id: "vesta-author-byline",
        label: "Author byline",
        category: "Content",
        media: ICON(
            '<circle cx="8" cy="10" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="14" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1.5"/><line x1="14" y1="12" x2="18" y2="12" stroke="currentColor" stroke-width="1.5"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:16px 0;font-family:${FONT};">
<tr>
<td style="padding-right:14px;vertical-align:middle;"><img src="https://i.pravatar.cc/96?img=12" alt="" width="48" height="48" style="border-radius:50%;display:block;" /></td>
<td style="vertical-align:middle;">
<div style="font-size:14px;font-weight:600;color:${COLORS.text};letter-spacing:-0.01em;">Written by John Smith</div>
<div style="font-size:12px;color:${COLORS.textMuted};margin-top:2px;">Head of Growth · 4 min read</div>
</td>
</tr>
</table>`,
    },
    {
        id: "vesta-checklist",
        label: "Checklist",
        category: "Content",
        media: ICON(
            '<path d="M4 7l2 2 3-3M4 13l2 2 3-3M4 19l2 2 3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><line x1="13" y1="8" x2="21" y2="8" stroke="currentColor" stroke-width="1.5"/><line x1="13" y1="14" x2="21" y2="14" stroke="currentColor" stroke-width="1.5"/><line x1="13" y1="20" x2="19" y2="20" stroke="currentColor" stroke-width="1.5"/>',
        ),
        content: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${FONT};margin:16px 0;">
<tr><td style="padding:6px 0;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;padding-right:10px;"><span style="display:inline-block;width:22px;height:22px;background:${COLORS.success};color:#fff;border-radius:50%;text-align:center;line-height:22px;font-weight:700;font-size:13px;">✓</span></td>
<td style="vertical-align:top;font-size:15px;color:${COLORS.text};line-height:1.5;">First benefit — call out the specific outcome.</td>
</tr></table>
</td></tr>
<tr><td style="padding:6px 0;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;padding-right:10px;"><span style="display:inline-block;width:22px;height:22px;background:${COLORS.success};color:#fff;border-radius:50%;text-align:center;line-height:22px;font-weight:700;font-size:13px;">✓</span></td>
<td style="vertical-align:top;font-size:15px;color:${COLORS.text};line-height:1.5;">Second benefit — make it concrete.</td>
</tr></table>
</td></tr>
<tr><td style="padding:6px 0;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;padding-right:10px;"><span style="display:inline-block;width:22px;height:22px;background:${COLORS.success};color:#fff;border-radius:50%;text-align:center;line-height:22px;font-weight:700;font-size:13px;">✓</span></td>
<td style="vertical-align:top;font-size:15px;color:${COLORS.text};line-height:1.5;">Third benefit — what they walk away with.</td>
</tr></table>
</td></tr>
</table>`,
    },
]
