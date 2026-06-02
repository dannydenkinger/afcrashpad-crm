import Link from "next/link"
import {
    AlertTriangle,
    Coins,
    Crown,
    Rocket,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Users,
    Zap,
} from "lucide-react"
import {
    computeOverview,
    computePlanDistribution,
    listWorkspaces,
    type WorkspaceRow,
} from "@/lib/admin/queries"
import { formatCents, formatNumber, formatPercent, formatRelative } from "@/lib/admin/format"
import { healthBadge } from "../workspaces/healthBadge"

export const dynamic = "force-dynamic"

export default async function InsightsPage() {
    const rows = await listWorkspaces()
    const m = computeOverview(rows)
    const dist = computePlanDistribution(rows)

    const recentSignups = [...rows]
        .filter((r) => r.createdAt)
        .sort(
            (a, b) =>
                new Date(b.createdAt as string).getTime() -
                new Date(a.createdAt as string).getTime(),
        )
        .slice(0, 6)

    const recentlyActive = [...rows]
        .filter((r) => r.lastActiveAt)
        .sort(
            (a, b) =>
                new Date(b.lastActiveAt as string).getTime() -
                new Date(a.lastActiveAt as string).getTime(),
        )
        .slice(0, 6)

    const alerts: WorkspaceRow[] = [
        ...rows.filter((r) => r.health === "past_due"),
        ...rows.filter((r) => r.health === "cap_approaching"),
        ...rows.filter((r) => r.health === "churn_risk").slice(0, 4),
        ...rows.filter((r) => r.health === "deleting"),
    ].slice(0, 10)

    const topByContacts = [...rows]
        .sort((a, b) => b.contactCount - a.contactCount)
        .slice(0, 5)

    const topByRevenue = [...rows]
        .filter((r) => r.monthlyRevenueCents > 0)
        .sort((a, b) => b.monthlyRevenueCents - a.monthlyRevenueCents)
        .slice(0, 5)

    const netMrrDelta = m.netNewMrrCentsThisMonth - m.churnedMrrCentsThisMonth

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Cross-workspace operator view. Data pulled live from Firestore + Stripe.
                </p>
            </header>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    label="MRR"
                    value={formatCents(m.mrrCents)}
                    sub={`ARR ${formatCents(m.arrCents, { compact: true })}`}
                />
                <StatCard
                    label="Paid workspaces"
                    value={formatNumber(m.paidWorkspaces)}
                    sub={`${formatNumber(m.freeWorkspaces)} on free`}
                />
                <StatCard
                    label="ARPU"
                    value={formatCents(m.arpuCents)}
                    sub="across paid"
                />
                <StatCard
                    label="Net new MRR (mo)"
                    value={formatCents(netMrrDelta)}
                    sub={`+${formatCents(m.netNewMrrCentsThisMonth)} / -${formatCents(m.churnedMrrCentsThisMonth)}`}
                    delta={netMrrDelta >= 0 ? "up" : "down"}
                />

                <StatCard
                    label="Active 7d"
                    value={formatNumber(m.activeLast7d)}
                    sub={`${formatNumber(m.activeLast30d)} in 30d`}
                />
                <StatCard
                    label="Signups 30d"
                    value={formatNumber(m.signupsLast30d)}
                    sub={`${formatNumber(m.signupsLast7d)} this week · ${formatNumber(m.signupsToday)} today`}
                />
                <StatCard
                    label="Free → Paid (30d)"
                    value={formatPercent(m.freeToPaidConversionPct)}
                    sub={`${m.paidSignupsLast30d} of ${m.signupsLast30d}`}
                />
                <StatCard
                    label="Health alerts"
                    value={formatNumber(
                        m.pastDueWorkspaces + m.churnRiskCount + m.capApproachingCount,
                    )}
                    sub={`${m.pastDueWorkspaces} past due · ${m.capApproachingCount} near cap · ${m.churnRiskCount} idle`}
                />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card title="Plan distribution" icon={<Sparkles className="h-4 w-4" />}>
                    <div className="space-y-3">
                        <PlanRow
                            tier="free"
                            count={dist.free.count}
                            total={m.totalWorkspaces}
                            icon={<Sparkles className="h-3.5 w-3.5" />}
                        />
                        <PlanRow
                            tier="pro"
                            count={dist.pro.count}
                            total={m.totalWorkspaces}
                            icon={<Rocket className="h-3.5 w-3.5" />}
                            mrr={dist.pro.mrrCents}
                        />
                        <PlanRow
                            tier="max"
                            count={dist.max.count}
                            total={m.totalWorkspaces}
                            icon={<Crown className="h-3.5 w-3.5" />}
                            mrr={dist.max.mrrCents}
                        />
                    </div>
                </Card>

                <Card title="Alerts needing attention" icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
                    {alerts.length === 0 ? (
                        <Empty message="Nothing on fire." />
                    ) : (
                        <ul className="space-y-1.5">
                            {alerts.map((r) => (
                                <li key={r.id}>
                                    <Link
                                        href={`/admin/workspaces/${r.id}`}
                                        className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/60"
                                    >
                                        <span className="truncate">{r.name}</span>
                                        {healthBadge(r.health)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card title="Top by MRR" icon={<Coins className="h-4 w-4 text-emerald-500" />}>
                    {topByRevenue.length === 0 ? (
                        <Empty message="No paid workspaces yet." />
                    ) : (
                        <ul className="space-y-1.5">
                            {topByRevenue.map((r) => (
                                <li key={r.id}>
                                    <Link
                                        href={`/admin/workspaces/${r.id}`}
                                        className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/60"
                                    >
                                        <span className="truncate">
                                            {r.name}
                                            <span className="text-muted-foreground ml-1.5">
                                                {r.plan}
                                            </span>
                                        </span>
                                        <span className="font-mono">
                                            {formatCents(r.monthlyRevenueCents)}/mo
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card title="Recent signups" icon={<Users className="h-4 w-4 text-violet-500" />}>
                    {recentSignups.length === 0 ? (
                        <Empty message="No signups yet." />
                    ) : (
                        <ul className="space-y-1.5">
                            {recentSignups.map((r) => (
                                <li key={r.id}>
                                    <Link
                                        href={`/admin/workspaces/${r.id}`}
                                        className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/60"
                                    >
                                        <span className="truncate">
                                            <span className="font-medium">{r.name}</span>
                                            <span className="text-muted-foreground ml-1.5">
                                                {r.ownerEmail}
                                            </span>
                                        </span>
                                        <span className="text-muted-foreground">
                                            {formatRelative(r.createdAt)}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card title="Most active 7d" icon={<Zap className="h-4 w-4 text-emerald-500" />}>
                    {recentlyActive.length === 0 ? (
                        <Empty message="No activity yet." />
                    ) : (
                        <ul className="space-y-1.5">
                            {recentlyActive.map((r) => (
                                <li key={r.id}>
                                    <Link
                                        href={`/admin/workspaces/${r.id}`}
                                        className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/60"
                                    >
                                        <span className="truncate">{r.name}</span>
                                        <span className="text-muted-foreground">
                                            {formatRelative(r.lastActiveAt)}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card title="Top by contacts" icon={<Users className="h-4 w-4" />}>
                    {topByContacts.length === 0 ? (
                        <Empty message="No data." />
                    ) : (
                        <ul className="space-y-1.5">
                            {topByContacts.map((r) => (
                                <li key={r.id}>
                                    <Link
                                        href={`/admin/workspaces/${r.id}`}
                                        className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/60"
                                    >
                                        <span className="truncate">{r.name}</span>
                                        <span className="font-mono">
                                            {formatNumber(r.contactCount)}
                                            {r.contactCap != null && (
                                                <span className="text-muted-foreground">
                                                    {" / "}
                                                    {formatNumber(r.contactCap)}
                                                </span>
                                            )}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </section>
        </div>
    )
}

function StatCard({
    label,
    value,
    sub,
    delta,
}: {
    label: string
    value: string
    sub?: string
    delta?: "up" | "down"
}) {
    return (
        <div className="rounded-xl border bg-card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
                <div className="text-2xl font-semibold tracking-tight">{value}</div>
                {delta === "up" && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                {delta === "down" && <TrendingDown className="h-4 w-4 text-rose-500" />}
            </div>
            {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
        </div>
    )
}

function Card({
    title,
    icon,
    children,
}: {
    title: string
    icon?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
                {icon}
                <h2 className="text-sm font-semibold">{title}</h2>
            </div>
            {children}
        </div>
    )
}

function PlanRow({
    tier,
    count,
    total,
    icon,
    mrr,
}: {
    tier: "free" | "pro" | "max"
    count: number
    total: number
    icon: React.ReactNode
    mrr?: number
}) {
    const pct = total > 0 ? (count / total) * 100 : 0
    const colorClass =
        tier === "max"
            ? "bg-amber-500"
            : tier === "pro"
              ? "bg-violet-500"
              : "bg-zinc-400 dark:bg-zinc-600"
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 capitalize">
                    {icon}
                    {tier}
                </span>
                <span className="font-mono">
                    {formatNumber(count)}
                    {mrr != null && mrr > 0 && (
                        <span className="text-muted-foreground ml-1.5">
                            · {formatCents(mrr)}/mo
                        </span>
                    )}
                </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}

function Empty({ message }: { message: string }) {
    return <p className="text-xs text-muted-foreground italic">{message}</p>
}
