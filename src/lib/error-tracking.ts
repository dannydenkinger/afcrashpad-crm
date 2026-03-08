/**
 * Lightweight error tracking utility.
 *
 * Currently logs to the console. When you're ready to integrate a production
 * error monitoring service (e.g. Sentry), replace the implementations below:
 *
 *   1. Install the Sentry SDK:
 *      npm install @sentry/nextjs
 *
 *   2. Initialize Sentry in `sentry.client.config.ts` and `sentry.server.config.ts`
 *      with your DSN (requires an API key from https://sentry.io).
 *
 *   3. Swap the function bodies here:
 *      - captureError  -> Sentry.captureException(error, { extra: context })
 *      - captureMessage -> Sentry.captureMessage(message, level)
 *
 *   4. Optionally wrap the Next.js config with `withSentryConfig()` for
 *      automatic source-map uploads and broader instrumentation.
 */

export function captureError(error: Error, context?: Record<string, unknown>) {
  console.error('[ERROR]', error.message, context)
  // In production, this would send to Sentry/LogRocket
  // When ready, replace with: Sentry.captureException(error, { extra: context })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  console[level === 'warning' ? 'warn' : level](`[${level.toUpperCase()}]`, message)
}
