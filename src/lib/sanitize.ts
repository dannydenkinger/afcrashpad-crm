/**
 * Lightweight HTML sanitizer for user-generated content.
 * Strips all HTML tags except a safe whitelist.
 * Use this before rendering any user content with dangerouslySetInnerHTML.
 */

const SAFE_TAGS = new Set([
    "b", "i", "em", "strong", "u", "br", "p", "ul", "ol", "li",
    "a", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre",
    "table", "thead", "tbody", "tr", "th", "td", "span", "div", "hr",
])

const SAFE_ATTRS = new Set(["href", "target", "rel", "class", "id"])

/**
 * Strip dangerous HTML while preserving safe formatting tags.
 * Removes script tags, event handlers, javascript: URLs, and data: URLs.
 */
export function sanitizeHtml(html: string): string {
    if (!html) return ""

    // Remove script tags and their content
    let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")

    // Remove event handlers (onclick, onerror, onload, etc.)
    clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
    clean = clean.replace(/\s+on\w+\s*=\s*\S+/gi, "")

    // Remove javascript: and data: URLs from attributes
    clean = clean.replace(/(?:href|src|action)\s*=\s*["']?\s*(?:javascript|data|vbscript):/gi, 'href="')

    // Remove style attributes (can be used for CSS-based attacks)
    clean = clean.replace(/\s+style\s*=\s*["'][^"']*["']/gi, "")

    // Strip tags not in our safe list
    clean = clean.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
        const tagLower = tag.toLowerCase()
        if (!SAFE_TAGS.has(tagLower)) return ""

        // For opening tags, strip unsafe attributes
        if (!match.startsWith("</")) {
            // Keep only safe attributes
            const stripped = match.replace(/\s+([a-zA-Z-]+)\s*=\s*["'][^"']*["']/g, (attrMatch, attrName) => {
                if (SAFE_ATTRS.has(attrName.toLowerCase())) return attrMatch
                return ""
            })
            return stripped
        }
        return match
    })

    return clean
}

/**
 * Escape HTML entities for safe text display.
 * Use this when you want to display user text as plain text (no HTML).
 */
export function escapeHtml(text: string): string {
    if (!text) return ""
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}
