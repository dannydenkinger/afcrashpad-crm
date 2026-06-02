/**
 * Apply workspace branding to a starter / template HTML string.
 *
 * Starter templates ship with a fixed indigo palette (#4f46e5 primary,
 * #4338ca dark, #eef2ff light) and a default font stack. When the
 * workspace has set custom branding in Settings → Branding, we swap
 * those tokens in-place so the email lands on-brand without manual edits.
 *
 * This runs server-side at the templates page / starter picker, so the
 * user sees the branded preview before they even click into the editor.
 */

import type { BrandingSettings } from "@/app/settings/branding/types"

// ── Default tokens that ship in starter-templates.ts ─────────────────────
const DEFAULTS = {
    primary: "#4f46e5",
    primaryDark: "#4338ca",
    primaryLight: "#eef2ff",
    font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
}

/**
 * Take a hex color and shift its lightness by `amount` (positive = brighter,
 * negative = darker). Used to derive primaryDark / primaryLight from
 * a single user-supplied primaryColor when secondary isn't set.
 */
function shiftLightness(hex: string, amount: number): string {
    // Normalize hex; tolerate "#abc" and "rgba(...)" by bailing out
    const m = /^#?([a-f\d]{6}|[a-f\d]{3})$/i.exec(hex.trim())
    if (!m) return hex
    let h = m[1]
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255

    // sRGB → HSL
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let H = 0
    let S = 0
    const L = (max + min) / 2
    if (max !== min) {
        const d = max - min
        S = L > 0.5 ? d / (2 - max - min) : d / (max + min)
        if (max === r) H = ((g - b) / d + (g < b ? 6 : 0)) / 6
        else if (max === g) H = ((b - r) / d + 2) / 6
        else H = ((r - g) / d + 4) / 6
    }
    const newL = Math.max(0, Math.min(1, L + amount))

    // HSL → sRGB
    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1 / 6) return p + (q - p) * 6 * t
        if (t < 1 / 2) return q
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
        return p
    }
    let R: number, G: number, B: number
    if (S === 0) {
        R = G = B = newL
    } else {
        const q = newL < 0.5 ? newL * (1 + S) : newL + S - newL * S
        const p = 2 * newL - q
        R = hue2rgb(p, q, H + 1 / 3)
        G = hue2rgb(p, q, H)
        B = hue2rgb(p, q, H - 1 / 3)
    }
    const toHex = (n: number) =>
        Math.round(n * 255)
            .toString(16)
            .padStart(2, "0")
    return `#${toHex(R)}${toHex(G)}${toHex(B)}`
}

/**
 * Replace branded tokens in HTML. No-op if branding is null/undefined.
 */
export function applyBrandingToHtml(
    html: string,
    branding: BrandingSettings | null | undefined,
): string {
    if (!branding) return html
    let out = html

    if (branding.primaryColor) {
        const primary = branding.primaryColor
        const dark = branding.secondaryColor || shiftLightness(primary, -0.1)
        const light = shiftLightness(primary, 0.42)
        // Replace case-insensitively because some templates use uppercase hex
        out = out.replace(new RegExp(escapeRegex(DEFAULTS.primary), "gi"), primary)
        out = out.replace(new RegExp(escapeRegex(DEFAULTS.primaryDark), "gi"), dark)
        out = out.replace(new RegExp(escapeRegex(DEFAULTS.primaryLight), "gi"), light)
    }

    if (branding.fontFamily) {
        // Match the exact baseline font stack the starters ship with
        out = out.split(DEFAULTS.font).join(branding.fontFamily)
    }

    if (branding.footerAddress) {
        // Inject the address line right above the unsubscribe-link block in
        // every starter footer. Match either of the common phrasings the
        // starter templates use.
        const addressLine = `<span style="display:block;margin:6px 0;opacity:0.85;">${escapeHtml(branding.footerAddress)}</span>`
        out = out.replace(
            /(<strong[^>]*>\{\{company\}\}<\/strong>[^<]*<br>)/,
            `$1${addressLine}`,
        )
    }

    return out
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

/**
 * Apply branding to every starter template in an array. Useful for the
 * templates picker page so users see on-brand previews up front.
 */
export function applyBrandingToStarters<T extends { renderedHtml: string }>(
    starters: T[],
    branding: BrandingSettings | null | undefined,
): T[] {
    if (!branding || (!branding.primaryColor && !branding.fontFamily && !branding.footerAddress)) {
        return starters
    }
    return starters.map((s) => ({
        ...s,
        renderedHtml: applyBrandingToHtml(s.renderedHtml, branding),
    }))
}
