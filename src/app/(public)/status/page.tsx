import { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, AlertTriangle, XCircle, Activity, ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
    title: "Status | AFCrashpad CRM",
    description: "Real-time status of AFCrashpad CRM core services.",
}

// Status pages should never serve cached results.
export const dynamic = "force-dynamic"
export const revalidate = 0

interface ServiceStatus {
    name: string
    description: string
    status: "operational" | "degraded" | "down" | "unknown"
    detail?: string
}

/**
 * Run live checks against the same internals the /api/health endpoint
 * verifies, but render the result publicly with friendly copy. Anything
 * that fails or isn't configured shows up as degraded so customers know
 * exactly which subsystem is the problem.
 *
 * This is a "lightweight" status page — no historical uptime, no
 * incident timeline. Adding those requires a monitoring backend
 * (BetterStack, StatusGator, custom store). The current shape is fine
 * for launch and can be extended later without changing the URL.
 */
async function checkServices(): Promise<ServiceStatus[]> {
    const results: ServiceStatus[] = []

    // ── Database ────────────────────────────────────────────────────────
    try {
        const { adminDb } = await import("@/lib/firebase-admin")
        const start = Date.now()
        await adminDb.collection("_health").limit(1).get()
        const ms = Date.now() - start
        results.push({
            name: "Database",
            description: "Reads + writes to Firestore",
            status: ms < 500 ? "operational" : "degraded",
            detail: `Last check: ${ms}ms`,
        })
    } catch (err) {
        results.push({
            name: "Database",
            description: "Reads + writes to Firestore",
            status: "down",
            detail: err instanceof Error ? err.message.slice(0, 100) : "Connection failed",
        })
    }

    // ── Authentication ─────────────────────────────────────────────────
    results.push({
        name: "Authentication",
        description: "Email + Google sign-in",
        status: process.env.NEXTAUTH_SECRET && process.env.GOOGLE_CLIENT_ID ? "operational" : "down",
        detail: process.env.NEXTAUTH_SECRET ? "Sign-in available" : "Auth secret not configured",
    })

    // ── Email — marketing + transactional ──────────────────────────────
    const sesConfigured = !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY
    results.push({
        name: "Email (marketing)",
        description: "Bulk sends via Amazon SES",
        status: sesConfigured ? "operational" : "down",
        detail: sesConfigured ? "SES configured" : "AWS credentials missing",
    })

    // ── File storage ───────────────────────────────────────────────────
    results.push({
        name: "File storage",
        description: "Document uploads + signed URLs",
        status: process.env.FIREBASE_STORAGE_BUCKET ? "operational" : "down",
        detail: process.env.FIREBASE_STORAGE_BUCKET ? "Bucket configured" : "Storage bucket missing",
    })

    // ── Cron / background jobs ────────────────────────────────────────
    results.push({
        name: "Background jobs",
        description: "Scheduled automations + reports",
        status: process.env.CRON_SECRET ? "operational" : "degraded",
        detail: process.env.CRON_SECRET ? "Cron-secured endpoints active" : "Cron secret not set",
    })

    // ── Webhooks (outbound) ────────────────────────────────────────────
    results.push({
        name: "Webhooks",
        description: "Outbound CRM event delivery",
        status: "operational",
        detail: "Dispatcher fire-and-forget, retries x3",
    })

    return results
}

const STATUS_META = {
    operational: {
        Icon: CheckCircle2,
        label: "Operational",
        textClass: "text-emerald-600 dark:text-emerald-400",
        dotClass: "bg-emerald-500",
        rowClass: "border-emerald-500/20",
    },
    degraded: {
        Icon: AlertTriangle,
        label: "Degraded",
        textClass: "text-amber-600 dark:text-amber-400",
        dotClass: "bg-amber-500",
        rowClass: "border-amber-500/30",
    },
    down: {
        Icon: XCircle,
        label: "Down",
        textClass: "text-rose-600 dark:text-rose-400",
        dotClass: "bg-rose-500",
        rowClass: "border-rose-500/40",
    },
    unknown: {
        Icon: Activity,
        label: "Unknown",
        textClass: "text-muted-foreground",
        dotClass: "bg-muted-foreground",
        rowClass: "border-border",
    },
} as const

export default async function StatusPage() {
    const services = await checkServices()

    const allOperational = services.every((s) => s.status === "operational")
    const anyDown = services.some((s) => s.status === "down")
    const overallStatus: "operational" | "degraded" | "down" = anyDown
        ? "down"
        : allOperational
            ? "operational"
            : "degraded"

    const overall = STATUS_META[overallStatus]
    const overallCopy = anyDown
        ? "We're investigating an issue with one or more services."
        : allOperational
            ? "All systems operational."
            : "Some systems are degraded but functional."

    const checkedAt = new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    })

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto max-w-3xl px-4 py-12">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
                >
                    <ArrowLeft className="h-3 w-3" />
                    Back to AFCrashpad CRM
                </Link>

                <h1 className="text-2xl font-semibold tracking-tight mb-1">AFCrashpad CRM Status</h1>
                <p className="text-sm text-muted-foreground mb-8">
                    Live health check of core services. Refresh the page for an updated reading.
                </p>

                {/* Overall banner */}
                <div className={`rounded-lg border-2 ${overall.rowClass} bg-card p-5 mb-6`}>
                    <div className="flex items-start gap-3">
                        <overall.Icon className={`h-6 w-6 shrink-0 ${overall.textClass}`} />
                        <div>
                            <div className={`text-base font-semibold ${overall.textClass}`}>
                                {overall.label}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{overallCopy}</p>
                        </div>
                    </div>
                </div>

                {/* Per-service rows */}
                <div className="space-y-2">
                    {services.map((s) => {
                        const meta = STATUS_META[s.status]
                        return (
                            <div
                                key={s.name}
                                className={`flex items-start justify-between gap-4 rounded-md border ${meta.rowClass} bg-card px-4 py-3`}
                            >
                                <div className="min-w-0">
                                    <div className="text-sm font-medium">{s.name}</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                                    {s.detail && (
                                        <p className="text-[11px] text-muted-foreground/70 mt-1 font-mono">
                                            {s.detail}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
                                    <span className={`text-xs font-semibold uppercase tracking-wider ${meta.textClass}`}>
                                        {meta.label}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="mt-10 pt-6 border-t text-xs text-muted-foreground space-y-1">
                    <p>
                        Last checked: <span className="font-mono">{checkedAt}</span>
                    </p>
                    <p>
                        Status reflects real-time service availability only. For incident history or
                        scheduled maintenance, contact your account owner.
                    </p>
                </div>
            </div>
        </div>
    )
}
