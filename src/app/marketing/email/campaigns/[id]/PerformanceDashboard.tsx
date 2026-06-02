"use client"

import { useMemo } from "react"
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import {
    ArrowDownRight,
    ArrowUpRight,
    Eye,
    ExternalLink,
    MailCheck,
    MousePointerClick,
    ShieldAlert,
    Users,
} from "lucide-react"

interface EngagementDay {
    date: string
    sent: number
    opened: number
    clicked: number
}

interface LinkRow {
    url: string
    clicks: number
    uniqueClickers: number
}

interface RecipientRow {
    email: string
    name?: string
    openedAt?: string | null
    clickedAt?: string | null
    clickCount?: number
}

export interface PerformanceDashboardProps {
    targeted: number
    sent: number
    failed: number
    opened: number
    clicked: number
    bounced: number
    timeline: EngagementDay[]
    links: LinkRow[]
    topEngaged: RecipientRow[]
}

export function PerformanceDashboard({
    targeted,
    sent,
    failed,
    opened,
    clicked,
    bounced,
    timeline,
    links,
    topEngaged,
}: PerformanceDashboardProps) {
    const openRate = sent > 0 ? (opened / sent) * 100 : 0
    const clickRate = sent > 0 ? (clicked / sent) * 100 : 0
    const ctor = opened > 0 ? (clicked / opened) * 100 : 0
    const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0
    const deliveryRate = sent > 0 ? ((sent - failed) / sent) * 100 : 0

    return (
        <div className="space-y-5">
            {/* Top KPI cards — Instantly-style with gradient borders + sparkline */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                    label="Delivery rate"
                    value={`${formatPct(deliveryRate)}%`}
                    sub={`${formatNum(sent - failed)} / ${formatNum(sent)} delivered`}
                    Icon={MailCheck}
                    accent="emerald"
                    trend={deliveryRate >= 95 ? "up" : deliveryRate >= 85 ? "flat" : "down"}
                    timeline={timeline}
                    timelineKey="sent"
                />
                <KpiCard
                    label="Open rate"
                    value={`${formatPct(openRate)}%`}
                    sub={`${formatNum(opened)} unique opens`}
                    Icon={Eye}
                    accent="blue"
                    trend={openRate >= 30 ? "up" : openRate >= 15 ? "flat" : "down"}
                    timeline={timeline}
                    timelineKey="opened"
                />
                <KpiCard
                    label="Click rate"
                    value={`${formatPct(clickRate)}%`}
                    sub={`${formatNum(clicked)} clicks · CTOR ${formatPct(ctor)}%`}
                    Icon={MousePointerClick}
                    accent="violet"
                    trend={clickRate >= 5 ? "up" : clickRate >= 2 ? "flat" : "down"}
                    timeline={timeline}
                    timelineKey="clicked"
                />
                <KpiCard
                    label="Bounce rate"
                    value={`${formatPct(bounceRate)}%`}
                    sub={`${formatNum(bounced)} bounces`}
                    Icon={ShieldAlert}
                    accent="rose"
                    trend={bounceRate <= 1 ? "up" : bounceRate <= 3 ? "flat" : "down"}
                    invert
                />
            </div>

            {/* Engagement timeline */}
            <div className="rounded-xl border bg-card relative overflow-hidden">
                <div
                    aria-hidden
                    className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none"
                />
                <div className="relative p-5 pb-2 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold">Engagement over time</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Daily delivered, opens and clicks. Most engagement lands in the first 24 hours.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                        <LegendDot color="hsl(160 84% 39%)" label="Sent" />
                        <LegendDot color="hsl(217 91% 60%)" label="Opens" />
                        <LegendDot color="hsl(266 85% 58%)" label="Clicks" />
                    </div>
                </div>
                <div className="relative h-[260px] px-2 pb-3">
                    {timeline.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                            No delivery data yet
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timeline} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="grad-sent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="grad-opens" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="grad-clicks" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="hsl(266 85% 58%)" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="hsl(266 85% 58%)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="currentColor"
                                    strokeOpacity={0.08}
                                />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
                                    tickFormatter={(d: string) =>
                                        new Date(d + "T00:00:00").toLocaleDateString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                        })
                                    }
                                    minTickGap={20}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
                                    width={36}
                                    allowDecimals={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="sent"
                                    stroke="hsl(160 84% 39%)"
                                    strokeWidth={2}
                                    fill="url(#grad-sent)"
                                    name="Sent"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="opened"
                                    stroke="hsl(217 91% 60%)"
                                    strokeWidth={2}
                                    fill="url(#grad-opens)"
                                    name="Opens"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="clicked"
                                    stroke="hsl(266 85% 58%)"
                                    strokeWidth={2}
                                    fill="url(#grad-clicks)"
                                    name="Clicks"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Link breakdown */}
                <div className="lg:col-span-3 rounded-xl border bg-card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold">Click breakdown by link</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Where the clicks landed. Hover any URL to see it in full.
                            </p>
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                            {links.length} URL{links.length === 1 ? "" : "s"}
                        </span>
                    </div>
                    {links.length === 0 ? (
                        <div className="py-10 text-center text-xs text-muted-foreground border border-dashed rounded-md">
                            No clicks yet. As recipients click links, they&rsquo;ll appear here with
                            per-link counts.
                        </div>
                    ) : (
                        <LinkBars links={links} />
                    )}
                </div>

                {/* Top engaged */}
                <div className="lg:col-span-2 rounded-xl border bg-card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-primary" />
                                Top engaged recipients
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Who&rsquo;s opening and clicking the most.
                            </p>
                        </div>
                    </div>
                    {topEngaged.length === 0 ? (
                        <div className="py-10 text-center text-xs text-muted-foreground border border-dashed rounded-md">
                            Engagement leaderboard appears after a few opens.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {topEngaged.map((r, idx) => (
                                <div
                                    key={`${r.email}-${idx}`}
                                    className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/40 transition-colors"
                                >
                                    <div
                                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold tabular-nums shrink-0 ${
                                            idx === 0
                                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                                : idx === 1
                                                  ? "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300"
                                                  : idx === 2
                                                    ? "bg-orange-500/15 text-orange-700 dark:text-orange-400"
                                                    : "bg-muted text-muted-foreground"
                                        }`}
                                    >
                                        {idx + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-medium truncate">
                                            {r.name || r.email}
                                        </div>
                                        {r.name && (
                                            <div className="text-[10px] text-muted-foreground truncate">
                                                {r.email}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] tabular-nums shrink-0">
                                        {r.clickCount && r.clickCount > 0 ? (
                                            <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                                                <MousePointerClick className="w-2.5 h-2.5" />
                                                {r.clickCount}
                                            </span>
                                        ) : null}
                                        {r.openedAt && (
                                            <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                                <Eye className="w-2.5 h-2.5" />
                                                opened
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
    return n.toLocaleString()
}

function formatPct(n: number): string {
    if (!Number.isFinite(n)) return "0"
    return n >= 10 ? n.toFixed(0) : n.toFixed(1)
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}
        </span>
    )
}

interface CustomTooltipProps {
    active?: boolean
    payload?: Array<{
        name?: string
        value?: number
        color?: string
        dataKey?: string
    }>
    label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload || payload.length === 0) return null
    return (
        <div className="rounded-md border bg-popover/95 backdrop-blur shadow-lg px-2.5 py-1.5 text-[11px]">
            <div className="font-medium mb-1">
                {label
                    ? new Date(label + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                      })
                    : ""}
            </div>
            <div className="space-y-0.5">
                {payload.map((p) => (
                    <div key={p.dataKey} className="flex items-center gap-2">
                        <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: p.color }}
                        />
                        <span className="text-muted-foreground">{p.name}</span>
                        <span className="ml-auto font-medium tabular-nums">{p.value}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// KPI card with gradient border and optional sparkline
function KpiCard({
    label,
    value,
    sub,
    Icon,
    accent,
    trend,
    timeline,
    timelineKey,
    invert,
}: {
    label: string
    value: string
    sub?: string
    Icon: React.ComponentType<{ className?: string }>
    accent: "emerald" | "blue" | "violet" | "rose"
    trend: "up" | "flat" | "down"
    timeline?: EngagementDay[]
    timelineKey?: keyof EngagementDay
    invert?: boolean
}) {
    const accentClass = {
        emerald: "from-emerald-500/30 to-emerald-500/0",
        blue: "from-blue-500/30 to-blue-500/0",
        violet: "from-violet-500/30 to-violet-500/0",
        rose: "from-rose-500/30 to-rose-500/0",
    }[accent]
    const iconBg = {
        emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
        rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    }[accent]
    const sparkColor = {
        emerald: "hsl(160 84% 39%)",
        blue: "hsl(217 91% 60%)",
        violet: "hsl(266 85% 58%)",
        rose: "hsl(346 87% 56%)",
    }[accent]

    // For "bounce" KPI, up means good (low) is positive — we invert the
    // semantics so the icon/color stays intuitive
    const trendUp = invert ? trend === "down" : trend === "up"
    const trendDown = invert ? trend === "up" : trend === "down"
    const TrendIcon = trendUp ? ArrowUpRight : trendDown ? ArrowDownRight : null
    const trendColor = trendUp
        ? "text-emerald-600 dark:text-emerald-400"
        : trendDown
          ? "text-rose-600 dark:text-rose-400"
          : "text-muted-foreground"

    return (
        <div className="relative group rounded-xl border bg-card p-4 overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
            <div
                aria-hidden
                className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentClass}`}
            />
            <div className="flex items-start justify-between mb-3">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconBg}`}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                {TrendIcon && (
                    <span className={`flex items-center text-[11px] ${trendColor}`}>
                        <TrendIcon className="w-3 h-3" />
                    </span>
                )}
            </div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                {label}
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-0.5">{value}</div>
            {sub && (
                <div className="text-[11px] text-muted-foreground tabular-nums mt-1 truncate">
                    {sub}
                </div>
            )}
            {timeline && timelineKey && timeline.length > 1 && (
                <div className="h-8 mt-2 -mx-1 -mb-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timeline}>
                            <defs>
                                <linearGradient
                                    id={`spark-${label}`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.4} />
                                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey={timelineKey as string}
                                stroke={sparkColor}
                                strokeWidth={1.5}
                                fill={`url(#spark-${label})`}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}

function LinkBars({ links }: { links: LinkRow[] }) {
    const max = useMemo(() => Math.max(...links.map((l) => l.clicks), 1), [links])
    return (
        <div className="space-y-2">
            {links.slice(0, 12).map((l) => {
                const pct = (l.clicks / max) * 100
                return (
                    <div key={l.url} className="group">
                        <div className="flex items-center justify-between gap-3 mb-1">
                            <a
                                href={l.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs font-medium truncate hover:text-primary transition-colors"
                                title={l.url}
                            >
                                <span className="truncate">{prettifyUrl(l.url)}</span>
                                <ExternalLink className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                            </a>
                            <div className="flex items-center gap-2 shrink-0 text-[11px] tabular-nums">
                                <span className="font-medium">{l.clicks}</span>
                                <span className="text-muted-foreground">
                                    · {l.uniqueClickers} unique
                                </span>
                            </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-violet-500/70 transition-all"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function prettifyUrl(url: string): string {
    try {
        const u = new URL(url)
        const path = u.pathname === "/" ? "" : u.pathname
        return `${u.hostname}${path}${u.search ? "?…" : ""}`
    } catch {
        return url
    }
}
