import Link from "next/link"
import { Coins, TrendingDown, TrendingUp } from "lucide-react"
import {
    computeOverview,
    computePlanDistribution,
    listWorkspaces,
} from "@/lib/admin/queries"
import { formatCents, formatNumber, formatPercent, formatDate } from "@/lib/admin/format"
import { PLANS } from "@/lib/billing/plans"

export const dynamic = "force-dynamic"

export default async function RevenuePage() {
    const rows = await listWorkspaces()
    const m = computeOverview(rows)
    const dist = computePlanDistribution(rows)

    const paidRows = rows.filter((r) => r.plan !== "free")

    // Synthetic MRR-by-signup-month series, derived from current
    // workspace state. Best we can do without a snapshot history.
    const monthBuckets = new Map<string, { mrr: number; count: number }>()
    for (const r of paidRows) {
        if (!r.createdAt) continue
        const d = new Date(r.createdAt)
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
        const b = monthBuckets.get(key) ?? { mrr: 0, count: 0 }
        b.mrr += r.monthlyRevenueCents
        b.count++
        monthBuckets.set(key, b)
    }
    const bymonth = Array.from(monthBuckets.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .slice(-12)
    const maxMonthlyMrr = Math.max(1, ...bymonth.map(([, v]) => v.mrr))

    // Plan switchers — workspaces whose subscription is canceled but
    // they're still on a non-free tier (period not over yet).
    const canceledButActive = paidRows.filter((r) => r.planStatus === "canceled")
    const pastDue = paidRows.filter((r) => r.planStatus === "past_due")

    const netDelta = m.netNewMrrCentsThisMonth - m.churnedMrrCentsThisMonth
    const churnRate =
        paidRows.length > 0
            ? (m.churnedMrrCentsThisMonth / Math.max(1, m.mrrCents)) * 100
            : 0

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">Revenue</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Estimated from current workspace state + Stripe subscription metadata. Yearly
                    plans are spread evenly per month.
                </p>
            </header>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="MRR" value={formatCents(m.mrrCents)} sub={`${m.paidWorkspaces} paid workspaces`} />
                <Stat label="ARR" value={formatCents(m.arrCents, { compact: true })} sub="annualised" />
                <Stat label="ARPU" value={formatCents(m.arpuCents)} sub="per paid workspace" />
                <Stat
                    label="Net MRR (mo)"
                    value={formatCents(netDelta)}
                    sub={`+${formatCents(m.netNewMrrCentsThisMonth)} new · -${formatCents(m.churnedMrrCentsThisMonth)} churn`}
                    icon={
                        netDelta >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-rose-500" />
                        )
                    }
                />
                <Stat
                    label="Churn rate (mo)"
                    value={formatPercent(churnRate)}
                    sub="MRR-weighted"
                />
                <Stat
                    label="Past-due workspaces"
                    value={formatNumber(pastDue.length)}
                    sub={`${formatCents(pastDue.reduce((s, r) => s + r.monthlyRevenueCents, 0))} MRR at risk`}
                />
                <Stat
                    label="Canceled (period active)"
                    value={formatNumber(canceledButActive.length)}
                    sub="will churn at period end"
                />
                <Stat
                    label="Free → Paid (30d)"
                    value={formatPercent(m.freeToPaidConversionPct)}
                    sub={`${m.paidSignupsLast30d} of ${m.signupsLast30d}`}
                />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card p-4">
                    <h2 className="text-sm font-semibold mb-3">MRR by signup month</h2>
                    {bymonth.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No paid workspaces yet.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {bymonth.map(([key, v]) => (
                                <div key={key} className="text-xs">
                                    <div className="flex justify-between mb-0.5">
                                        <span className="text-muted-foreground">{key}</span>
                                        <span className="font-mono">
                                            {formatCents(v.mrr)}
                                            <span className="text-muted-foreground ml-1">
                                                · {v.count} ws
                                            </span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className="h-full bg-violet-500"
                                            style={{ width: `${(v.mrr / maxMonthlyMrr) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border bg-card p-4">
                    <h2 className="text-sm font-semibold mb-3">Per-plan economics</h2>
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-left text-muted-foreground">
                                <th className="py-1 font-medium">Plan</th>
                                <th className="py-1 font-medium text-right">Workspaces</th>
                                <th className="py-1 font-medium text-right">MRR</th>
                                <th className="py-1 font-medium text-right">% of MRR</th>
                                <th className="py-1 font-medium text-right">List price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(["max", "pro", "free"] as const).map((tier) => {
                                const d = dist[tier]
                                const share =
                                    m.mrrCents > 0 ? (d.mrrCents / m.mrrCents) * 100 : 0
                                return (
                                    <tr key={tier} className="border-t">
                                        <td className="py-1.5 capitalize">{tier}</td>
                                        <td className="py-1.5 text-right">
                                            {formatNumber(d.count)}
                                        </td>
                                        <td className="py-1.5 text-right font-mono">
                                            {formatCents(d.mrrCents)}
                                        </td>
                                        <td className="py-1.5 text-right">
                                            {formatPercent(share, 1)}
                                        </td>
                                        <td className="py-1.5 text-right text-muted-foreground">
                                            {tier === "free"
                                                ? "—"
                                                : `${formatCents(PLANS[tier].monthlyCents)}/mo`}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card p-4">
                    <h2 className="text-sm font-semibold mb-3 inline-flex items-center gap-2">
                        <Coins className="h-4 w-4 text-rose-500" />
                        At risk
                    </h2>
                    {pastDue.length === 0 && canceledButActive.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                            All paid workspaces are current.
                        </p>
                    ) : (
                        <ul className="space-y-1.5">
                            {[...pastDue, ...canceledButActive].map((r) => (
                                <li key={r.id}>
                                    <Link
                                        href={`/admin/workspaces/${r.id}`}
                                        className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/60"
                                    >
                                        <span className="truncate">
                                            <span className="font-medium">{r.name}</span>
                                            <span className="text-muted-foreground ml-1.5">
                                                {r.planStatus}
                                            </span>
                                        </span>
                                        <span className="font-mono shrink-0">
                                            {formatCents(r.monthlyRevenueCents)}
                                            {r.planExpiresAt && (
                                                <span className="text-muted-foreground ml-1.5 text-[10px]">
                                                    {formatDate(r.planExpiresAt)}
                                                </span>
                                            )}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="rounded-xl border bg-card p-4">
                    <h2 className="text-sm font-semibold mb-3">Top paying workspaces</h2>
                    {paidRows.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No paid workspaces yet.</p>
                    ) : (
                        <ul className="space-y-1.5">
                            {paidRows
                                .sort((a, b) => b.monthlyRevenueCents - a.monthlyRevenueCents)
                                .slice(0, 10)
                                .map((r) => (
                                    <li key={r.id}>
                                        <Link
                                            href={`/admin/workspaces/${r.id}`}
                                            className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/60"
                                        >
                                            <span className="truncate">
                                                <span className="font-medium">{r.name}</span>
                                                <span className="text-muted-foreground ml-1.5 uppercase text-[10px]">
                                                    {r.plan}
                                                </span>
                                            </span>
                                            <span className="font-mono shrink-0">
                                                {formatCents(r.monthlyRevenueCents)}/mo
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                        </ul>
                    )}
                </div>
            </section>
        </div>
    )
}

function Stat({
    label,
    value,
    sub,
    icon,
}: {
    label: string
    value: string
    sub?: string
    icon?: React.ReactNode
}) {
    return (
        <div className="rounded-xl border bg-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 flex items-baseline gap-2">
                <div className="text-2xl font-semibold tracking-tight">{value}</div>
                {icon}
            </div>
            {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
        </div>
    )
}
