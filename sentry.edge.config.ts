/**
 * Sentry config for the Edge runtime (middleware + edge route handlers).
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
