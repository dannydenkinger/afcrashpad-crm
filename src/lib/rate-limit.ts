/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach. Suitable for single-instance deployments (Netlify Functions).
 */

const windowMs = 60_000 // 1 minute window
const store = new Map<string, { count: number; resetAt: number }>()

// Clean up expired entries periodically
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
        if (now > entry.resetAt) store.delete(key)
    }
}, 60_000)

export function rateLimit(key: string, maxRequests: number): { allowed: boolean; remaining: number } {
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, remaining: maxRequests - 1 }
    }

    if (entry.count >= maxRequests) {
        return { allowed: false, remaining: 0 }
    }

    entry.count++
    return { allowed: true, remaining: maxRequests - entry.count }
}

/**
 * Get a rate limit key from a request (uses IP or forwarded IP)
 */
export function getRateLimitKey(req: Request, prefix: string): string {
    const forwarded = req.headers.get("x-forwarded-for")
    const ip = forwarded?.split(",")[0]?.trim() || "unknown"
    return `${prefix}:${ip}`
}
