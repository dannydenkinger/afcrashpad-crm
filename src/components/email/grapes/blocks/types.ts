/**
 * Shared types and design tokens for Vesta's GrapesJS block library.
 *
 * Block content is plain HTML strings (table-based, inline-styled, email-safe).
 * Tokens here keep the look consistent across blocks; juice will inline any
 * <style> at send time, so authors can drag blocks and they'll render in
 * Gmail/Outlook without further work.
 */

export interface VestaBlock {
    id: string
    label: string
    category: VestaBlockCategory
    media: string
    content: string
}

export type VestaBlockCategory =
    | "Layout"
    | "Content"
    | "Media"
    | "Actions"
    | "Commerce"
    | "Headers"
    | "Footers"
    | "Advanced"
    | "Tokens"

/** Inline-SVG icon wrapper used in block tiles (palette only, not in email). */
export const ICON = (path: string, viewBox = "0 0 24 24") =>
    `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${path}</svg>`

// ── Design tokens ───────────────────────────────────────────────────────────
export const COLORS = {
    primary: "#4f46e5", // indigo-600
    primaryDark: "#4338ca", // indigo-700
    primaryLight: "#eef2ff", // indigo-50
    text: "#0f172a", // slate-900
    textMuted: "#64748b", // slate-500
    textSubtle: "#94a3b8", // slate-400
    border: "#e2e8f0", // slate-200
    borderSubtle: "#f1f5f9", // slate-100
    bg: "#ffffff",
    bgSubtle: "#f8fafc", // slate-50
    accent: "#f59e0b", // amber-500
    success: "#16a34a", // green-600
    danger: "#dc2626", // red-600
}

export const FONT =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

/** Email-safe 600px container that centers content and matches our palette. */
export const section = (inner: string, extraStyle = "") =>
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;${extraStyle}"><tr><td align="center" style="padding:24px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;"><tr><td>${inner}</td></tr></table></td></tr></table>`

/** Reusable button HTML — used by hero/cards/etc so style stays consistent. */
export const button = (
    label: string,
    href = "#",
    variant: "primary" | "secondary" | "pill" = "primary",
) => {
    if (variant === "secondary") {
        return `<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:8px;border:1.5px solid ${COLORS.primary};"><a href="${href}" style="display:inline-block;padding:11px 26px;color:${COLORS.primary};font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:-0.01em;">${label}</a></td></tr></table>`
    }
    const radius = variant === "pill" ? "999px" : "10px"
    return `<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:${radius};background:${COLORS.primary};box-shadow:0 1px 2px rgba(15,23,42,0.08);"><a href="${href}" style="display:inline-block;padding:13px 30px;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;border-radius:${radius};letter-spacing:-0.01em;">${label}</a></td></tr></table>`
}
