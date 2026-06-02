/**
 * Sentry browser SDK config. Loaded on every client page render.
 *
 * If SENTRY_DSN is unset, Sentry.init becomes a no-op — useful for local
 * dev and self-hosters who don't want to wire up a Sentry project. In
 * production, set NEXT_PUBLIC_SENTRY_DSN in Vercel env.
 */
import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,
        // Avoid spamming Sentry with noise from common browser quirks.
        ignoreErrors: [
            "ResizeObserver loop limit exceeded",
            "ResizeObserver loop completed with undelivered notifications",
            "Non-Error promise rejection captured",
        ],
    })
}
