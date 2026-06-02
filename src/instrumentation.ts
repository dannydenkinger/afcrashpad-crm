/**
 * Next.js instrumentation hook — runs once when the server boots.
 * Used to register Sentry's server + edge SDKs at the right time.
 *
 * Lives at src/instrumentation.ts because this project uses a src/
 * directory. Next.js looks for it here when src/ exists; a root-level
 * instrumentation file is silently ignored.
 *
 * No-op when SENTRY_DSN is unset.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("../sentry.server.config")
    } else if (process.env.NEXT_RUNTIME === "edge") {
        await import("../sentry.edge.config")
    }
}

import * as Sentry from "@sentry/nextjs"

export const onRequestError = Sentry.captureRequestError
