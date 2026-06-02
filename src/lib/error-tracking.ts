/**
 * Error tracking facade. Sends to Sentry when SENTRY_DSN is configured,
 * otherwise prints to the console so local dev still works.
 *
 * Always import from here rather than @sentry/nextjs directly — keeps
 * call sites stable if we switch providers later.
 */
import * as Sentry from "@sentry/nextjs"

const sentryEnabled =
    !!process.env.NEXT_PUBLIC_SENTRY_DSN || !!process.env.SENTRY_DSN

export function captureError(error: unknown, context?: Record<string, unknown>) {
    const err = error instanceof Error ? error : new Error(String(error))
    if (sentryEnabled) {
        Sentry.captureException(err, { extra: context })
    } else if (process.env.NODE_ENV !== "production") {
        console.error("[ERROR]", err.message, context)
    }
}

export function captureMessage(
    message: string,
    level: "info" | "warning" | "error" = "info",
) {
    if (sentryEnabled) {
        Sentry.captureMessage(message, level === "warning" ? "warning" : level)
    } else if (process.env.NODE_ENV !== "production") {
        const fn = level === "warning" ? console.warn : level === "error" ? console.error : console.info
        fn(`[${level.toUpperCase()}]`, message)
    }
}

export function setUser(user: { id: string; email?: string; workspaceId?: string } | null) {
    if (!sentryEnabled) return
    if (!user) {
        Sentry.setUser(null)
        return
    }
    Sentry.setUser({ id: user.id, email: user.email })
    if (user.workspaceId) {
        Sentry.setTag("workspaceId", user.workspaceId)
    }
}
