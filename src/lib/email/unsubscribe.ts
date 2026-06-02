/**
 * One-click unsubscribe links: HMAC-signed tokens that encode the workspace
 * and recipient email, plus optional campaign context. Public `/unsub/<token>`
 * page verifies the signature and writes to email_suppressions.
 *
 * Token format (compact, URL-safe):
 *   base64url( workspaceId + "." + email + "." + campaignId? ).<sig>
 *   sig = base64url( hmac-sha256(payload, TRACKING_SECRET) ).slice(0, 32)
 *
 * We reuse TRACKING_SECRET (already used for click/open tracking) so there's
 * one secret to rotate. Tokens don't expire — once signed, they remain valid.
 * That's intentional: an unsubscribe link in an email from 2 years ago should
 * still work the day someone digs it up.
 */

import crypto from "node:crypto"

const SECRET_ENV = "TRACKING_SECRET"
const APP_URL_ENV = "NEXT_PUBLIC_APP_URL"

function getSecret(): string {
    const secret = process.env[SECRET_ENV]
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error(`${SECRET_ENV} must be set in production`)
        }
        console.warn(`[unsubscribe] ${SECRET_ENV} not set — using dev-only fallback`)
        return "vesta-dev-fallback-secret-do-not-use-in-prod"
    }
    return secret
}

function getAppUrl(): string {
    return process.env[APP_URL_ENV] || "http://localhost:3000"
}

function b64urlEncode(s: string | Buffer): string {
    return Buffer.from(s)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

function b64urlDecode(s: string): string {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)
    return Buffer.from(padded, "base64").toString("utf8")
}

function sign(payload: string): string {
    const sig = crypto
        .createHmac("sha256", getSecret())
        .update(payload)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    return sig.slice(0, 32)
}

export function makeUnsubscribeToken(
    workspaceId: string,
    email: string,
    campaignId?: string,
): string {
    const normalized = email.trim().toLowerCase()
    const parts = [workspaceId, normalized]
    if (campaignId) parts.push(campaignId)
    const payload = parts.join(".")
    const encoded = b64urlEncode(payload)
    return `${encoded}.${sign(payload)}`
}

export interface ParsedUnsubscribeToken {
    workspaceId: string
    email: string
    campaignId?: string
}

export function verifyUnsubscribeToken(
    token: string,
): ParsedUnsubscribeToken | null {
    if (!token || !token.includes(".")) return null
    const [encoded, sig] = token.split(".")
    if (!encoded || !sig) return null
    let payload: string
    try {
        payload = b64urlDecode(encoded)
    } catch {
        return null
    }
    const expected = sign(payload)
    // Constant-time compare
    if (
        sig.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
        return null
    }
    const parts = payload.split(".")
    if (parts.length < 2) return null
    return {
        workspaceId: parts[0],
        email: parts[1],
        campaignId: parts[2] || undefined,
    }
}

export function unsubscribeUrlFor(
    workspaceId: string,
    email: string,
    campaignId?: string | null,
): string {
    const token = makeUnsubscribeToken(workspaceId, email, campaignId ?? undefined)
    return `${getAppUrl()}/unsub/${token}`
}
