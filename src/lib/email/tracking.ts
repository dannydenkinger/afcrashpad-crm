/**
 * Open and click tracking for outbound emails.
 *
 * Open tracking:
 *   - Inject a 1×1 transparent pixel at the end of the body that hits
 *     /api/track/open/{logId}. First load updates `email_logs.openedAt`.
 *
 * Click tracking:
 *   - Rewrite every <a href="..."> to /api/track/click/{logId}?url=<orig>&t=<hmac>
 *   - Route verifies the HMAC, updates `email_logs.clickedAt`, then 302s to
 *     the original URL.
 *   - HMAC prevents the route from becoming an open redirect.
 *
 * Requires NEXT_PUBLIC_APP_URL and TRACKING_SECRET env vars. If either is
 * missing the helpers no-op and return the HTML unchanged.
 */

import crypto from "crypto"

export function getAppUrl(): string | null {
    const url = process.env.NEXT_PUBLIC_APP_URL
    if (!url) return null
    return url.replace(/\/$/, "")
}

function getTrackingSecret(): string | null {
    return process.env.TRACKING_SECRET || null
}

/**
 * Sign a URL for click tracking. Uses HMAC-SHA256 on the URL, base64url-encoded
 * and truncated to 22 chars (ample collision resistance for this use case).
 */
export function signClickUrl(targetUrl: string): string {
    const secret = getTrackingSecret()
    if (!secret) return ""
    return crypto
        .createHmac("sha256", secret)
        .update(targetUrl)
        .digest("base64url")
        .slice(0, 22)
}

export function verifyClickSignature(targetUrl: string, signature: string): boolean {
    const secret = getTrackingSecret()
    if (!secret) return false
    if (!signature) return false
    const expected = signClickUrl(targetUrl)
    if (!expected) return false
    if (expected.length !== signature.length) return false
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    } catch {
        return false
    }
}

interface InjectArgs {
    html: string
    emailLogId: string
}

/**
 * Add an invisible tracking pixel just before </body> (or appended to the end
 * if no body tag is present). Idempotent — won't double-inject if a pixel
 * for this log already exists in the HTML.
 */
export function injectOpenPixel({ html, emailLogId }: InjectArgs): string {
    const appUrl = getAppUrl()
    if (!appUrl) return html
    if (!emailLogId) return html

    const pixelUrl = `${appUrl}/api/track/ses/open/${encodeURIComponent(emailLogId)}.png`
    if (html.includes(pixelUrl)) return html

    const pixel = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;outline:0;" />`

    if (/<\/body\s*>/i.test(html)) {
        return html.replace(/<\/body\s*>/i, `${pixel}</body>`)
    }
    return html + pixel
}

/**
 * Rewrite all <a href="..."> URLs to go through our click tracker. Skips:
 *   - mailto:, tel:, sms:, javascript:, # anchors
 *   - URLs that are already pointing at our tracker (idempotent)
 *   - Unsubscribe links if they include data-no-track (TODO when needed)
 */
export function rewriteLinks({ html, emailLogId }: InjectArgs): string {
    const appUrl = getAppUrl()
    const secret = getTrackingSecret()
    if (!appUrl || !secret) return html
    if (!emailLogId) return html

    return html.replace(
        /<a\b([^>]*?)\shref=(["'])([^"']*)\2/gi,
        (full, before: string, quote: string, url: string) => {
            const trimmed = url.trim()
            if (!trimmed) return full
            if (/^(mailto:|tel:|sms:|javascript:|#)/i.test(trimmed)) return full
            if (trimmed.startsWith(`${appUrl}/api/track/ses/click/`)) return full

            const sig = signClickUrl(trimmed)
            const wrapped = `${appUrl}/api/track/ses/click/${encodeURIComponent(emailLogId)}?url=${encodeURIComponent(trimmed)}&t=${sig}`
            return `<a${before} href=${quote}${wrapped}${quote}`
        },
    )
}

/** Single 1×1 transparent PNG, base64-decoded. Used by the pixel route. */
export const TRACKING_PIXEL_PNG: Buffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
)
