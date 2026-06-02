"use client"

import { useState, useEffect } from "react"
import {
    Loader2, TrendingUp, TrendingDown, Clock, DollarSign, Target,
    ArrowRight, AlertTriangle, Zap, ChevronRight,
} from "lucide-react"
import { getPipelineConversionMetrics } from "./actions"
import { cn } from "@/lib/utils"

interface ConversionMetricsProps {
    pipelineId: string
}

function formatCurrency(value: number) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
}

const STAGE_COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
    "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#6366f1",
]

export function ConversionMetrics({ pipelineId }: ConversionMetricsProps) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getPipelineConversionMetrics(pipelineId).then((result) => {
            if (result.success) setData(result.data)
            setLoading(false)
        })
    }, [pipelineId])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Calculating metrics…</p>
            </div>
        )
    }

    if (!data || data.totalDeals === 0) {
        return (
            <div className="text-center py-16 px-6 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Target className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm font-semibold">No deals to analyze yet</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
                        Win rate, conversion funnel, and cycle metrics show up once
                        you have at least one deal in this pipeline.
                    </p>
                </div>
            </div>
        )
    }

    // Find the slowest stage (longest avg time) — that's the bottleneck
    const stagesWithTime = data.stages.filter((s: any) => s.avgTimeInStage != null)
    const slowestStage = stagesWithTime.length > 0
        ? stagesWithTime.reduce((max: any, s: any) =>
            (s.avgTimeInStage > (max?.avgTimeInStage ?? 0) ? s : max), null)
        : null

    // Find the worst-converting stage transition
    const stagesWithConv = data.stages.filter((s: any, idx: number) =>
        s.conversionToNext != null && idx < data.stages.length - 1)
    const worstConvStage = stagesWithConv.length > 0
        ? stagesWithConv.reduce((min: any, s: any) =>
            (s.conversionToNext < (min?.conversionToNext ?? 100) ? s : min), null)
        : null

    return (
        <div className="space-y-6">
            {/* ── Hero KPI tiles ── */}
            <div className="grid grid-cols-2 gap-3">
                <KpiTile
                    label="Win rate"
                    value={`${data.winRate}%`}
                    Icon={TrendingUp}
                    accent="emerald"
                    sub={`${data.wonCount ?? "—"} won of ${data.totalDeals} total`}
                />
                <KpiTile
                    label="Loss rate"
                    value={`${data.lossRate}%`}
                    Icon={TrendingDown}
                    accent="rose"
                    sub={data.lostCount != null ? `${data.lostCount} closed-lost` : "Closed-lost ratio"}
                />
                <KpiTile
                    label="Avg cycle"
                    value={data.avgDealCycleDays != null ? `${data.avgDealCycleDays}d` : "—"}
                    Icon={Clock}
                    accent="blue"
                    sub="Created → closed"
                />
                <KpiTile
                    label="Won value"
                    value={formatCurrency(data.totalWonValue)}
                    Icon={DollarSign}
                    accent="emerald"
                    sub={data.totalLostValue > 0 ? `${formatCurrency(data.totalLostValue)} lost` : "All-time"}
                />
            </div>

            {/* ── Smart insights ── */}
            {(slowestStage || worstConvStage) && (
                <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-primary/60" />
                        Insights
                    </p>
                    {slowestStage && slowestStage.avgTimeInStage > 7 && (
                        <InsightCard
                            tone="amber"
                            Icon={Clock}
                            title={`Deals sit longest in "${slowestStage.stageName}"`}
                            body={`Average ~${slowestStage.avgTimeInStage} days. Consider what's blocking them or whether the stage definition is too broad.`}
                        />
                    )}
                    {worstConvStage && worstConvStage.conversionToNext < 50 && (
                        <InsightCard
                            tone="rose"
                            Icon={AlertTriangle}
                            title={`Drop-off after "${worstConvStage.stageName}"`}
                            body={`Only ${worstConvStage.conversionToNext}% of deals advance to the next stage. Likely your biggest conversion lever.`}
                        />
                    )}
                </div>
            )}

            {/* ── Conversion funnel ── */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-primary/60" />
                        Conversion funnel
                    </p>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                        {data.totalDeals} deal{data.totalDeals === 1 ? "" : "s"} total
                    </span>
                </div>
                <div className="space-y-3">
                    {data.stages.map((stage: any, idx: number) => {
                        const maxCount = Math.max(...data.stages.map((s: any) => s.count), 1)
                        const widthPct = Math.max((stage.count / maxCount) * 100, 6)
                        const stageColor = STAGE_COLORS[idx % STAGE_COLORS.length]
                        const isLast = idx === data.stages.length - 1

                        return (
                            <div key={stage.stageId}>
                                {/* Stage row */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: stageColor }}
                                            />
                                            <span className="text-xs font-semibold truncate">
                                                {stage.stageName}
                                            </span>
                                            {stage.avgTimeInStage != null && (
                                                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                                    ~{stage.avgTimeInStage}d
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-xs font-bold tabular-nums">
                                                {stage.count}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground ml-1.5 tabular-nums">
                                                {formatCurrency(stage.value)}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Bar */}
                                    <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700 ease-out"
                                            style={{
                                                width: `${widthPct}%`,
                                                backgroundColor: stageColor,
                                                opacity: 0.85,
                                            }}
                                        />
                                    </div>
                                </div>
                                {/* Conversion arrow */}
                                {stage.conversionToNext != null && !isLast && (
                                    <div className="flex items-center gap-1.5 pl-3 py-1.5 text-[10px]">
                                        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                                        <span
                                            className={cn(
                                                "font-semibold tabular-nums",
                                                stage.conversionToNext >= 60
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : stage.conversionToNext >= 30
                                                        ? "text-amber-600 dark:text-amber-400"
                                                        : "text-rose-600 dark:text-rose-400",
                                            )}
                                        >
                                            {stage.conversionToNext}%
                                        </span>
                                        <span className="text-muted-foreground">advance</span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ── Won vs Lost split ── */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-primary/60" />
                    Closed deals
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Won
                        </div>
                        <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(data.totalWonValue)}
                        </div>
                        <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                                style={{ width: `${Math.max(data.winRate, 4)}%` }}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Lost
                        </div>
                        <div className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
                            {formatCurrency(data.totalLostValue)}
                        </div>
                        <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-rose-500 rounded-full transition-all duration-700"
                                style={{ width: `${Math.max(data.lossRate, 4)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Hero KPI tile ─────────────────────────────────────────────────

const ACCENT_TONES = {
    emerald: { gradient: "from-emerald-500/30 to-transparent", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
    rose: { gradient: "from-rose-500/30 to-transparent", bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
    blue: { gradient: "from-blue-500/30 to-transparent", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
    primary: { gradient: "from-primary/30 to-transparent", bg: "bg-primary/10", text: "text-primary" },
} as const

function KpiTile({
    label, value, sub, Icon, accent,
}: {
    label: string
    value: string
    sub: string
    Icon: React.ComponentType<{ className?: string }>
    accent: keyof typeof ACCENT_TONES
}) {
    const tone = ACCENT_TONES[accent]
    return (
        <div className="relative rounded-lg border bg-card p-3 overflow-hidden">
            <div aria-hidden className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", tone.gradient)} />
            <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                    {label}
                </p>
                <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0", tone.bg, tone.text)}>
                    <Icon className="h-3 w-3" />
                </div>
            </div>
            <div className={cn("text-xl font-bold tabular-nums leading-none", tone.text)}>
                {value}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 truncate">
                {sub}
            </p>
        </div>
    )
}

// ─── Insight callout ──────────────────────────────────────────────

const INSIGHT_TONES = {
    amber: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    rose: "border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300",
} as const

function InsightCard({
    tone, Icon, title, body,
}: {
    tone: keyof typeof INSIGHT_TONES
    Icon: React.ComponentType<{ className?: string }>
    title: string
    body: string
}) {
    return (
        <div className={cn("rounded-lg border p-3 flex items-start gap-2.5", INSIGHT_TONES[tone])}>
            <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-semibold leading-tight">{title}</p>
                <p className="text-[11px] opacity-90 leading-relaxed">{body}</p>
            </div>
        </div>
    )
}
