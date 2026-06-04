import { AlertCircle, CheckCircle2, Clock, CreditCard, ExternalLink, Workflow } from "lucide-react"
import { getStripe, isStripeConfigured } from "@/lib/billing/credit-topups"
import { getCronRunSummaries, type CronRunSummary } from "@/lib/cron-log"
import { formatRelative } from "@/lib/admin/format"
import type Stripe from "stripe"

export const dynamic = "force-dynamic"

interface StripeEventRow {
    id: string
    type: string
    createdAt: string
    pendingWebhooks: number
    livemode: boolean
}

async function loadStripeEvents(): Promise<{
    events: StripeEventRow[]
    configured: boolean
    error: string | null
}> {
    if (!isStripeConfigured()) {
        return { events: [], configured: false, error: null }
    }
    try {
        const stripe = getStripe()
        const list = await stripe.events.list({ limit: 20 })
        const events = list.data.map((e: Stripe.Event) => ({
            id: e.id,
            type: e.type,
            createdAt: new Date(e.created * 1000).toISOString(),
            pendingWebhooks: e.pending_webhooks,
            livemode: e.livemode,
        }))
        return { events, configured: true, error: null }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load"
        return { events: [], configured: true, error: message }
    }
}

export default async function IntegrationsPage() {
    const [crons, stripe] = await Promise.all([
        getCronRunSummaries(),
        loadStripeEvents(),
    ])

    const sentryConfigured = !!process.env.SENTRY_DSN
    const posthogConfigured = !!process.env.NEXT_PUBLIC_POSTHOG_KEY

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Health of the third-party services AFCrashpad depends on.
                </p>
            </header>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ServiceCard
                    title="Stripe"
                    icon={<CreditCard className="h-4 w-4" />}
                    status={
                        !stripe.configured
                            ? "off"
                            : stripe.error
                              ? "error"
                              : "ok"
                    }
                    detail={
                        !stripe.configured
                            ? "Not configured — STRIPE_SECRET_KEY not set"
                            : stripe.error
                              ? stripe.error
                              : `${stripe.events.length} recent events`
                    }
                    href="https://dashboard.stripe.com"
                />
                <ServiceCard
                    title="Sentry"
                    icon={<AlertCircle className="h-4 w-4" />}
                    status={sentryConfigured ? "ok" : "off"}
                    detail={
                        sentryConfigured
                            ? "SENTRY_DSN set — events reporting"
                            : "Not configured — SENTRY_DSN not set"
                    }
                    href="https://sentry.io"
                />
                <ServiceCard
                    title="PostHog"
                    icon={<Workflow className="h-4 w-4" />}
                    status={posthogConfigured ? "ok" : "off"}
                    detail={
                        posthogConfigured
                            ? "NEXT_PUBLIC_POSTHOG_KEY set — events capturing"
                            : "Not configured — analytics off"
                    }
                    href="https://us.posthog.com"
                />
            </section>

            <section className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4" />
                    <h2 className="text-sm font-semibold">Cron runs (last 24h)</h2>
                </div>
                <p className="text-xs text-muted-foreground -mt-2 mb-3">
                    Each row records the most recent successful and failed invocation. Crons
                    not yet instrumented with <code className="text-[10px]">logCronRun()</code>
                    {" "}show as &ldquo;never ran&rdquo; even when they have.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="text-left text-muted-foreground">
                            <tr>
                                <th className="px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider">
                                    Endpoint
                                </th>
                                <th className="px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider">
                                    Last success
                                </th>
                                <th className="px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider">
                                    Last failure
                                </th>
                                <th className="px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider text-right">
                                    24h runs
                                </th>
                                <th className="px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider text-right">
                                    Failures
                                </th>
                                <th className="px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider">
                                    Health
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {crons.map((c) => (
                                <CronRow key={c.name} c={c} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4 text-emerald-500" />
                    <h2 className="text-sm font-semibold">Recent Stripe events</h2>
                </div>
                {!stripe.configured ? (
                    <p className="text-xs text-muted-foreground italic">
                        Stripe isn&apos;t configured on this deployment.
                    </p>
                ) : stripe.error ? (
                    <p className="text-xs text-rose-600 dark:text-rose-400">
                        {stripe.error}
                    </p>
                ) : stripe.events.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                        No recent Stripe events.
                    </p>
                ) : (
                    <ul className="space-y-1.5">
                        {stripe.events.map((e) => (
                            <li key={e.id} className="text-xs">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="truncate">
                                        <span className="font-mono">{e.type}</span>
                                        {e.pendingWebhooks > 0 && (
                                            <span className="text-amber-600 dark:text-amber-400 ml-2 text-[10px]">
                                                · {e.pendingWebhooks} pending webhook
                                                {e.pendingWebhooks !== 1 ? "s" : ""}
                                            </span>
                                        )}
                                        {!e.livemode && (
                                            <span className="text-muted-foreground ml-2 text-[10px] uppercase">
                                                test
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        {formatRelative(e.createdAt)}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

function ServiceCard({
    title,
    icon,
    status,
    detail,
    href,
}: {
    title: string
    icon: React.ReactNode
    status: "ok" | "error" | "off"
    detail: string
    href?: string
}) {
    const indicator =
        status === "ok"
            ? "bg-emerald-500"
            : status === "error"
              ? "bg-rose-500"
              : "bg-zinc-400"
    return (
        <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                <span className={`h-2 w-2 rounded-full ${indicator}`} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{detail}</p>
            {href && (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline mt-2 inline-flex items-center gap-1"
                >
                    Open dashboard
                    <ExternalLink className="h-3 w-3" />
                </a>
            )}
        </div>
    )
}

function CronRow({ c }: { c: CronRunSummary }) {
    const everRan = c.lastSuccessAt || c.lastFailureAt
    const lastSuccessRecent = c.lastSuccessAt
        ? Date.now() - new Date(c.lastSuccessAt).getTime() < 24 * 60 * 60 * 1000
        : false
    const health: "ok" | "warn" | "fail" | "idle" = !everRan
        ? "idle"
        : c.last24hFailures > 0 && c.last24hFailures === c.last24hRuns
          ? "fail"
          : c.last24hFailures > 0
            ? "warn"
            : lastSuccessRecent
              ? "ok"
              : "warn"

    return (
        <tr className="border-t">
            <td className="px-2 py-1.5 font-mono">{c.name}</td>
            <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                {c.lastSuccessAt ? formatRelative(c.lastSuccessAt) : "never"}
            </td>
            <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground max-w-[260px] truncate">
                {c.lastFailureAt ? (
                    <span title={c.lastFailureError || undefined}>
                        {formatRelative(c.lastFailureAt)}
                        {c.lastFailureError && (
                            <span className="ml-2 text-[10px] text-rose-600 dark:text-rose-400 truncate">
                                {c.lastFailureError.slice(0, 60)}
                            </span>
                        )}
                    </span>
                ) : (
                    "—"
                )}
            </td>
            <td className="px-2 py-1.5 text-right font-mono">{c.last24hRuns}</td>
            <td
                className={`px-2 py-1.5 text-right font-mono ${c.last24hFailures > 0 ? "text-rose-600 dark:text-rose-400" : ""}`}
            >
                {c.last24hFailures}
            </td>
            <td className="px-2 py-1.5">
                {health === "ok" && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold uppercase">
                        <CheckCircle2 className="h-3 w-3" />
                        OK
                    </span>
                )}
                {health === "warn" && (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[10px] font-semibold uppercase">
                        <AlertCircle className="h-3 w-3" />
                        Warn
                    </span>
                )}
                {health === "fail" && (
                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 text-[10px] font-semibold uppercase">
                        <AlertCircle className="h-3 w-3" />
                        Fail
                    </span>
                )}
                {health === "idle" && (
                    <span className="text-zinc-500 text-[10px] font-semibold uppercase">
                        Idle
                    </span>
                )}
            </td>
        </tr>
    )
}
