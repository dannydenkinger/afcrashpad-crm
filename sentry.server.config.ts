/**
 * Sentry server SDK config. Loaded in Node + Edge runtimes.
 *
 * If SENTRY_DSN is unset, Sentry.init becomes a no-op.
 */
import * as Sentry from "@sentry/nextjs"

const dsn = process.env.SENTRY_DSN

if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
        tracesSampleRate: 0.1,
    })
}
