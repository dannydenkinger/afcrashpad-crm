import Link from "next/link"
import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { getAttributionReport } from "./actions"
import { ArrowLeft, ArrowUpRight, BarChart3, DollarSign, Target, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

function fmtCurrency(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
    return `$${value.toLocaleString()}`
}

export default async function AttributionReportPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const role = (session.user as { role?: string }).role
    if (role !== "OWNER" && role !== "ADMIN") redirect("/finance")

    const res = await getAttributionReport()

    return (
        <div className="container mx-auto max-w-5xl py-6 px-4 space-y-6">
            <div>
                <Link
                    href="/finance/reports"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
                >
                    <ArrowLeft className="w-3 h-3" />
                    Reports
                </Link>
                <h1 className="text-2xl font-semibold tracking-tight">Source attribution</h1>
                <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
                    Which lead sources actually produce revenue? Each row aggregates contacts and
                    opportunities by their assigned <span className="font-mono text-foreground/80">leadSourceId</span>
                    {" "}or free-form <span className="font-mono text-foreground/80">source</span> field.
                    Records without either fall into <em>{`"Unattributed"`}</em>.
                </p>
            </div>

            {!res.success || !res.report ? (
                <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                        {res.error || "Couldn't load attribution data."}
                    </CardContent>
                </Card>
            ) : res.report.rows.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-2">
                        <EmptyState
                            Icon={BarChart3}
                            accent="violet"
                            title="No attribution data yet"
                            description="Tag your contacts with a lead source so this report can show which channels drive deals."
                            action={{ label: "Manage lead sources", href: "/settings/workspace/tags" }}
                        />
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* KPI strip */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <KpiTile
                            Icon={Users}
                            label="Total contacts"
                            value={res.report.totals.contacts.toLocaleString()}
                            accent="primary"
                        />
                        <KpiTile
                            Icon={Target}
                            label="Opportunities"
                            value={res.report.totals.opportunities.toLocaleString()}
                            accent="violet"
                        />
                        <KpiTile
                            Icon={ArrowUpRight}
                            label="Won deals"
                            value={res.report.totals.won.toLocaleString()}
                            accent="emerald"
                        />
                        <KpiTile
                            Icon={DollarSign}
                            label="Won revenue"
                            value={fmtCurrency(res.report.totals.wonRevenue)}
                            accent="emerald"
                        />
                    </div>

                    {/* Source table */}
                    <Card>
                        <CardContent className="p-0 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                                        <th className="text-left font-semibold px-4 py-3">Source</th>
                                        <th className="text-right font-semibold px-4 py-3">Contacts</th>
                                        <th className="text-right font-semibold px-4 py-3">Opps</th>
                                        <th className="text-right font-semibold px-4 py-3">Won</th>
                                        <th className="text-right font-semibold px-4 py-3">Lost</th>
                                        <th className="text-right font-semibold px-4 py-3">Win rate</th>
                                        <th className="text-right font-semibold px-4 py-3">Avg deal</th>
                                        <th className="text-right font-semibold px-4 py-3">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {res.report.rows.map((row) => {
                                        const winColor = row.winRate >= 50
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : row.winRate >= 25
                                                ? "text-amber-600 dark:text-amber-400"
                                                : "text-rose-600 dark:text-rose-400"
                                        return (
                                            <tr
                                                key={row.sourceId || `name:${row.source}`}
                                                className="border-b border-border/40 hover:bg-muted/10 transition-colors"
                                            >
                                                <td className="px-4 py-3 font-medium">{row.source}</td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    {row.contacts.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    {row.opportunities.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                                                    {row.won.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                                                    {row.lost.toLocaleString()}
                                                </td>
                                                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${winColor}`}>
                                                    {(row.won + row.lost) > 0 ? `${row.winRate}%` : "—"}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    {row.avgDealValue > 0 ? fmtCurrency(row.avgDealValue) : "—"}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                                                    {row.wonRevenue > 0 ? fmtCurrency(row.wonRevenue) : "—"}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}

function KpiTile({
    Icon,
    label,
    value,
    accent,
}: {
    Icon: React.ComponentType<{ className?: string }>
    label: string
    value: string
    accent: "primary" | "violet" | "emerald"
}) {
    const tone = {
        primary: "bg-primary/10 text-primary",
        violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
        emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    }[accent]
    return (
        <div className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                    {label}
                </p>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
            </div>
            <div className="text-2xl font-bold tabular-nums tracking-tight leading-none">{value}</div>
        </div>
    )
}
