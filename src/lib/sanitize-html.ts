import DOMPurify from "dompurify"

/**
 * Sanitize HTML before rendering to the DOM via dangerouslySetInnerHTML.
 *
 * Use this for ANY HTML that ultimately came from a user — document templates,
 * generated content, rich-text form fields, email previews, etc. Even if the
 * author is "trusted" (admin role), an attacker who compromises one admin
 * account would otherwise have script execution against every recipient who
 * views or signs a document.
 *
 * Allows a generous set of formatting tags + safe inline styles. Strips all
 * <script>, on* event handlers, javascript: URLs, and dangerous attributes.
 *
 * Browser-only on purpose. Every caller is a "use client" component, so we
 * don't need the isomorphic-dompurify wrapper — it pulls in jsdom, which
 * crashes Vercel's static page generation trying to load a default
 * stylesheet at build time. During SSR we return "" and let the client
 * re-render with the real sanitized output.
 */
export function sanitizeHtml(input: string | null | undefined): string {
    if (!input) return ""
    if (typeof window === "undefined") return ""
    return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [
            "p", "br", "hr", "div", "span",
            "h1", "h2", "h3", "h4", "h5", "h6",
            "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
            "ul", "ol", "li",
            "a", "img",
            "blockquote", "pre", "code",
            "table", "thead", "tbody", "tr", "th", "td",
            "figure", "figcaption",
        ],
        ALLOWED_ATTR: [
            "href", "src", "alt", "title", "class", "id", "style",
            "target", "rel",
            "width", "height",
            "colspan", "rowspan",
            "data-signature-block", "data-block-id", // For doc signing block UI
        ],
        // No <script>, <iframe>, <object>, <embed>, on* handlers, javascript: URLs
        FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button"],
        FORBID_ATTR: ["formaction"],
        ALLOW_DATA_ATTR: false,
        // Reject javascript:/vbscript:/data: URLs in href/src
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    })
}
