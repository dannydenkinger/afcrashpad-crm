import { ICON, type VestaBlock } from "./types"

export const ADVANCED_BLOCKS: VestaBlock[] = [
    {
        id: "vesta-html-code",
        label: "Custom HTML",
        category: "Advanced",
        media: ICON(
            '<path d="M7 8l-4 4 4 4M17 8l4 4-4 4M14 5l-4 14" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
        ),
        content:
            '<div><!-- Paste any email-safe HTML here (inline styles only; no external CSS). Gets auto-CSS-inlined at send time. -->Your custom HTML</div>',
    },
    {
        id: "vesta-map",
        label: "Map",
        category: "Advanced",
        media: ICON(
            '<path d="M3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="1.5"/>',
        ),
        content: `<a href="https://maps.google.com" style="display:block;max-width:600px;margin:16px auto;text-decoration:none;">
<img src="https://placehold.co/600x280?text=Map+preview" alt="Map" width="600" style="max-width:100%;height:auto;display:block;border-radius:8px;" />
<div style="text-align:center;padding:8px;font-size:13px;color:#0f172a;font-family:-apple-system,sans-serif;">123 Main Street, City, State</div>
</a>`,
    },
]
