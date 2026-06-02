import { ICON, type VestaBlock } from "./types"

/**
 * Personalization token blocks. Dropping one inserts the raw `{{token}}`
 * text into the email. At send time, our renderer replaces tokens per
 * recipient (see src/lib/templating/tokens.ts).
 *
 * The editor shows them as styled chips so they're visually distinct from
 * regular text while designing. The styling is inline so it shows up in
 * the WYSIWYG but is cosmetic — when the email actually sends, the chip
 * HTML becomes a `<span>` wrapping the resolved value.
 */

const chip = (token: string) =>
    `<span style="display:inline-block;padding:2px 8px;background:#eef2ff;color:#4f46e5;font-weight:600;border-radius:4px;font-size:0.9em;">${token}</span>`

export const TOKEN_BLOCKS: VestaBlock[] = [
    {
        id: "vesta-token-first-name",
        label: "First name",
        category: "Tokens",
        media: ICON(
            '<text x="12" y="15" font-size="11" font-family="sans-serif" font-weight="700" fill="currentColor" text-anchor="middle">{First}</text>',
        ),
        content: chip("{{first_name}}"),
    },
    {
        id: "vesta-token-last-name",
        label: "Last name",
        category: "Tokens",
        media: ICON(
            '<text x="12" y="15" font-size="11" font-family="sans-serif" font-weight="700" fill="currentColor" text-anchor="middle">{Last}</text>',
        ),
        content: chip("{{last_name}}"),
    },
    {
        id: "vesta-token-name",
        label: "Full name",
        category: "Tokens",
        media: ICON(
            '<text x="12" y="15" font-size="11" font-family="sans-serif" font-weight="700" fill="currentColor" text-anchor="middle">{Name}</text>',
        ),
        content: chip("{{name}}"),
    },
    {
        id: "vesta-token-email",
        label: "Email",
        category: "Tokens",
        media: ICON(
            '<rect x="3" y="7" width="18" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M3 8l9 6 9-6" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        ),
        content: chip("{{email}}"),
    },
    {
        id: "vesta-token-phone",
        label: "Phone",
        category: "Tokens",
        media: ICON(
            '<path d="M8 4h4l2 5-2.5 1.5a10 10 0 0 0 5 5L18 13l5 2v4a2 2 0 0 1-2 2h-1A17 17 0 0 1 4 5v-1a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
        ),
        content: chip("{{phone}}"),
    },
    {
        id: "vesta-token-company",
        label: "Company",
        category: "Tokens",
        media: ICON(
            '<path d="M3 21V9l9-6 9 6v12M9 21v-6h6v6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
        ),
        content: chip("{{company}}"),
    },
]
