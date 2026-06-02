import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

// Routes that don't require authentication
const publicRoutes = [
    "/",
    "/login",
    "/register",
    "/privacy",
    "/terms",
    "/pricing",
    "/verify-email",
]

// Route prefixes that don't require authentication
const publicPrefixes = [
    "/sign/",     // E-signature signing pages are public by design
    "/invite/",   // Invitation acceptance pages are public
    "/form/",     // Legacy redirect to /forms/
    "/forms/",    // Hosted lead forms are public
    "/unsub/",    // One-click unsubscribe pages are public (HMAC-signed token)
    "/book/",     // Legacy redirect to /booking/
    "/booking/",  // Public booking pages + cancellation links
    "/payout/",   // Public payout-claim pages (token-gated)
]

// API route prefixes that skip CSRF checking (they use their own auth mechanisms)
const csrfExemptPrefixes = [
    "/api/auth/",        // NextAuth handles its own CSRF
    "/api/webhooks/",    // Webhooks authenticate via Bearer token / shared secret
    "/api/forms/",       // Form submissions come from external sites
    "/api/cron/",        // Cron jobs authenticate via secret query param
    "/api/calendar/",    // Calendar feed is GET-only, public by design
    "/api/v1/",          // Public REST API — auth via x-api-key / Bearer token
    "/api/automations/", // Public webhook-in trigger — HMAC-signed token in URL
]

/**
 * CSRF protection for API routes that accept mutating requests (POST/PUT/PATCH/DELETE).
 *
 * Server Actions already have built-in CSRF protection via the Next-Action header,
 * but API routes do not. This check verifies that the Origin header (when present)
 * matches the Host header, blocking cross-origin form submissions and fetch requests.
 *
 * - Requests without an Origin header are allowed (same-origin browser requests
 *   from older browsers or non-browser clients may omit it).
 * - Requests where Origin does not match the host are blocked with 403.
 */
function csrfCheck(req: NextRequest): NextResponse | null {
    const { pathname } = req.nextUrl

    // Only check API routes
    if (!pathname.startsWith("/api")) return null

    // Skip exempt routes
    for (const prefix of csrfExemptPrefixes) {
        if (pathname.startsWith(prefix)) return null
    }

    // Only check mutating methods
    const method = req.method.toUpperCase()
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null

    const origin = req.headers.get("origin")

    // If no Origin header, allow the request (same-origin requests don't always send it)
    if (!origin) return null

    // Compare origin against the host
    const host = req.headers.get("host")
    if (!host) return null

    try {
        const originUrl = new URL(origin)
        // Match hostname (and port if present). The Origin header includes scheme + host.
        // The Host header is just host[:port].
        const hostWithoutPort = host.split(":")[0]
        const originHost = originUrl.hostname

        if (originHost !== hostWithoutPort) {
            console.warn(
                `CSRF blocked: origin "${origin}" does not match host "${host}" for ${method} ${pathname}`
            )
            return NextResponse.json(
                { error: "CSRF validation failed: origin mismatch" },
                { status: 403 }
            )
        }

        // Also check port if the host header includes one
        if (host.includes(":")) {
            const hostPort = host.split(":")[1]
            const originPort = originUrl.port || (originUrl.protocol === "https:" ? "443" : "80")
            if (originPort !== hostPort) {
                console.warn(
                    `CSRF blocked: origin port "${originPort}" does not match host port "${hostPort}" for ${method} ${pathname}`
                )
                return NextResponse.json(
                    { error: "CSRF validation failed: origin mismatch" },
                    { status: 403 }
                )
            }
        }
    } catch {
        // Malformed origin header — block it
        return NextResponse.json(
            { error: "CSRF validation failed: malformed origin" },
            { status: 403 }
        )
    }

    return null
}

export default auth((req) => {
    // ── CSRF Protection ──
    // Run CSRF check before auth check so it applies to all API routes
    const csrfResponse = csrfCheck(req)
    if (csrfResponse) return csrfResponse

    // ── Auth Check ──
    const isLoggedIn = !!req.auth
    const { nextUrl } = req

    if (nextUrl.pathname.startsWith("/api") || nextUrl.pathname.startsWith("/_next")) {
        return NextResponse.next()
    }

    const isPublicRoute = publicRoutes.includes(nextUrl.pathname) ||
        publicPrefixes.some(prefix => nextUrl.pathname.startsWith(prefix))

    if (!isLoggedIn && !isPublicRoute) {
        return NextResponse.redirect(new URL("/login", nextUrl))
    }

    return NextResponse.next()
})

export const config = {
    matcher: [
        // Match all routes except static assets, internal Next.js paths, and
        // public files served from /public. Without these excluded, requests
        // to manifest.json / service workers / icons go through auth and get
        // an HTML redirect back instead of the actual file — browsers then
        // fail to parse them ("manifest.json: Line 1, column 1, Syntax error").
        // Include /api routes in the matcher so CSRF middleware runs on them.
        "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|firebase-messaging-sw.js|robots.txt|sitemap.xml|icons/).*)",
    ],
}
