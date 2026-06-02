/**
 * Email-friendly CSS inlining.
 *
 * Most email clients (Gmail, Outlook, Yahoo, Apple Mail) only honor inline
 * `style=""` attributes. They strip or ignore `<style>` blocks. So when a
 * user pastes HTML designed for the web (from Claude, Figma, etc.), we
 * convert any <style> rules to inline styles before sending.
 *
 * Media queries are preserved in a remaining <style> block (some clients
 * like Apple Mail support them for responsive layouts).
 */

import juice from "juice"

export function inlineCss(html: string): string {
    if (!html || !html.includes("<")) return html

    try {
        return juice(html, {
            // Keep media queries in <style> — clients that respect them get
            // responsive behavior; clients that don't fall back to inline styles.
            preserveMediaQueries: true,
            // Same for keyframes / pseudo-classes that can't be inlined.
            preserveKeyFrames: true,
            preservePseudos: true,
            // Don't strip CSS comments — sometimes contain MSO conditionals
            // that Outlook needs.
            removeStyleTags: false,
            // Convert `<img class="...">` widths from CSS to width attributes
            // (Outlook ignores CSS width on images).
            applyWidthAttributes: true,
            applyHeightAttributes: true,
            // Preserve `!important` (some users use it for Outlook overrides).
            preserveImportant: true,
        })
    } catch (err) {
        console.error("[email/inline-css] juice failed, returning original:", err)
        return html
    }
}
