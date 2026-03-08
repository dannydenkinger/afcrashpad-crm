import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that don't require authentication
const publicRoutes = [
    "/",
]

// Route prefixes that don't require authentication
const publicPrefixes = [
    "/sign/",    // E-signature signing pages are public by design
]

// API route prefixes that skip CSRF checking (they use their own auth mechanisms)
const csrfExemptPrefixes = [
    "/api/auth/",        // NextAuth handles its own CSRF
    "/api/webhooks/",    // Webhooks authenticate via Bearer token / shared secret
    "/api/cron/",        // Cron jobs authenticate via secret query param
    "/api/calendar/",    // Calendar feed is GET-only, public by design
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
        return NextResponse.redirect(new URL("/", nextUrl))
    }

    return NextResponse.next()
})

export const config = {
    matcher: [
        // Match all routes except static assets, internal Next.js paths, and images
        // Include /api routes in the matcher so CSRF middleware runs on them
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
}
