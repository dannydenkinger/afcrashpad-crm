"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import RGL from "react-grid-layout"
const { Responsive, WidthProvider } = RGL as unknown as {
    Responsive: React.ComponentType<any>
    WidthProvider: <P>(c: React.ComponentType<P>) => React.ComponentType<P>
}
type Layout = { i: string; x: number; y: number; w: number; h: number }
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import "./dashboard-grid.css"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    BarChart3, Calendar, CheckSquare, DollarSign, Flame, Home, Inbox,
    Megaphone, Pencil, PieChart, Plus, Sparkles, Target, Trash2,
    TrendingDown, TrendingUp, Trophy, Users, Wallet, Workflow,
} from "lucide-react"
import { LazyAreaChartWrapper, LazyPieChartWrapper } from "@/components/charts/LazyCharts"
import { MiniCalendar } from "@/components/MiniCalendar"
import { ActivityFeed } from "./ActivityFeed"
import { GoalTracker } from "./GoalTracker"
import { DashboardWidget } from "./DashboardWidget"
import {
    GRID_COLS, GRID_ROW_HEIGHT, WIDGETS_BY_ID,
    type WidgetMeta,
} from "./widget-registry"
import type { GridLayoutItem } from "./widget-registry"
import type { DashboardData } from "./types"
import { cn } from "@/lib/utils"

const ResponsiveGridLayout = WidthProvider(Responsive)

// Lazy-load the leaderboard widget so we don't pay for it unless used
const LeaderboardTab = dynamic(
    () => import("./LeaderboardTab").then((m) => m.LeaderboardTab),
    { ssr: false, loading: () => <div className="p-4 text-xs text-muted-foreground">Loading leaderboard…</div> },
)

interface GridDashboardProps {
    items: GridLayoutItem[]
    onChange: (items: GridLayoutItem[]) => void
    editMode: boolean
    onAddWidget: () => void
    data: DashboardData
    pipelineId: string
    timeframe: "1m" | "6m" | "1y"
    setTimeframe: (t: "1m" | "6m" | "1y") => void
    pendingTasks: DashboardData["tasks"]
    onToggleTask: (id: string, status: string) => void
    onEditTask: (task: any, e: React.MouseEvent) => void
    onDeleteTask: (id: string, e: React.MouseEvent) => void
    onAddTask: () => void
}

/**
 * Reactive widget grid built on react-grid-layout. Every widget has a
 * stable id (from the registry) and a position {x,y,w,h} on a 12-column
 * grid. Drag from the widget header (.widget-drag-handle), resize from
 * the bottom-right corner — only when editMode is true.
 */
export function GridDashboard({
    items,
    onChange,
    editMode,
    onAddWidget,
    data,
    pipelineId,
    timeframe,
    setTimeframe,
    pendingTasks,
    onToggleTask,
    onEditTask,
    onDeleteTask,
    onAddTask,
}: GridDashboardProps) {
    const router = useRouter()
    const kpi = data.kpi
    const valueData = data.pipelineData[pipelineId]?.valueOverTime[timeframe] || []
    const stageData = data.pipelineData[pipelineId]?.stageDistribution || []
    const donutData = data.pipelineData[pipelineId]?.statusDistribution.map((s) => ({ name: s.name, value: s.count, color: s.color })) || []
    const baseData = data.pipelineData[pipelineId]?.dealsByBase || []
    const sourceData = data.sourceAttribution || []

    const handleHide = (id: string) => {
        onChange(items.filter((it) => it.i !== id))
    }
    const handleMaximize = (id: string) => {
        onChange(items.map((it) => (it.i === id ? { ...it, w: 12 } : it)))
    }

    return (
        <div className="space-y-3">
            <div className={cn("dashboard-grid-wrapper", editMode && "dashboard-grid--edit")}>
                <ResponsiveGridLayout
                    className="dashboard-grid"
                    layouts={{ lg: items, md: items, sm: items }}
                    breakpoints={{ lg: 1024, md: 768, sm: 0 }}
                    cols={{ lg: GRID_COLS, md: GRID_COLS, sm: 4 }}
                    rowHeight={GRID_ROW_HEIGHT}
                    margin={[16, 16]}
                    containerPadding={[0, 0]}
                    isDraggable={editMode}
                    isResizable={editMode}
                    /* Whole card is draggable — only buttons, links, and inputs
                       are excluded so internal interactions still work. */
                    draggableCancel="button, a, input, select, textarea, .no-drag, [data-no-drag]"
                    resizeHandles={["se"]}
                    /* Heights snap to even multiples (h: 2, 4, 6, 8…) so widgets
                       in the same row line up naturally. Width still snaps to
                       the 12-column grid for free. */
                    onResizeStop={(layout: Layout[]) => {
                        const snapped = layout.map((l) => ({
                            i: l.i, x: l.x, y: l.y, w: l.w,
                            h: Math.max(2, Math.round(l.h / 2) * 2),
                        }))
                        onChange(snapped)
                    }}
                    onLayoutChange={(layout: Layout[]) => {
                        // Only persist when the layout actually changed dimensions
                        // (react-grid-layout fires this on first render too).
                        const next = layout.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
                        const changed = next.some((n) => {
                            const prev = items.find((p) => p.i === n.i)
                            return !prev || prev.x !== n.x || prev.y !== n.y || prev.w !== n.w || prev.h !== n.h
                        }) || next.length !== items.length
                        if (changed) onChange(next)
                    }}
                    compactType="vertical"
                    preventCollision={false}
                >
                    {items.map((item) => {
                        const meta = WIDGETS_BY_ID[item.i]
                        if (!meta) return null
                        return (
                            <div key={item.i}>
                                <DashboardWidget
                                    id={item.i}
                                    title={meta.title}
                                    editMode={editMode}
                                    onHide={() => handleHide(item.i)}
                                    onMaximize={() => handleMaximize(item.i)}
                                    chromeless={[
                                        // Only widgets that already render their own h-full Card
                                        // belong here. Everything else uses DashboardWidget's
                                        // built-in Card chrome so the resize handle anchors
                                        // correctly to the visible card edge.
                                        "activity", "goals",
                                    ].includes(item.i)}
                                >
                                    {renderWidget(item.i, {
                                        data, kpi, valueData, stageData, donutData, baseData, sourceData,
                                        pipelineId, timeframe, setTimeframe,
                                        router, pendingTasks,
                                        onToggleTask, onEditTask, onDeleteTask, onAddTask,
                                    })}
                                </DashboardWidget>
                            </div>
                        )
                    })}
                </ResponsiveGridLayout>
            </div>

            {/* Add widget tile, only in edit mode */}
            {editMode && (
                <button
                    type="button"
                    onClick={onAddWidget}
                    className="w-full rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-colors py-6 flex flex-col items-center justify-center gap-1.5 text-primary"
                >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold">Add widget</span>
                    <span className="text-[11px] text-primary/70">
                        Pick from {Object.keys(WIDGETS_BY_ID).length} widgets in the gallery
                    </span>
                </button>
            )}
        </div>
    )
}

// ─── Widget renderer ────────────────────────────────────────────────────

interface RenderCtx {
    data: DashboardData
    kpi: DashboardData["kpi"]
    valueData: { name: string; value: number }[]
    stageData: { name: string; count: number; value: number; color: string }[]
    donutData: { name: string; value: number; color: string }[]
    baseData: { name: string; deals: number; color: string }[]
    sourceData: { source: string; count: number; value: number }[]
    pipelineId: string
    timeframe: "1m" | "6m" | "1y"
    setTimeframe: (t: "1m" | "6m" | "1y") => void
    router: ReturnType<typeof useRouter>
    pendingTasks: DashboardData["tasks"]
    onToggleTask: (id: string, status: string) => void
    onEditTask: (task: any, e: React.MouseEvent) => void
    onDeleteTask: (id: string, e: React.MouseEvent) => void
    onAddTask: () => void
}

function renderWidget(id: string, ctx: RenderCtx): React.ReactNode {
    switch (id) {
        // ── KPI widgets ──────────────────────────────────────────────
        case "kpi-pipeline-value":
            return (
                <KpiInline
                    label="Pipeline value"
                    value={formatCurrency(ctx.kpi.totalPipelineValue)}
                    sublabel="Total opportunity value"
                    Icon={DollarSign}
                    accent="primary"
                    onClick={() => ctx.router.push("/pipeline")}
                    sparkline={
                        ctx.valueData.length > 1 ? (
                            <LazyAreaChartWrapper
                                variant="sparkline"
                                data={ctx.valueData}
                                dataKey="value"
                                gradientId="sparkPipeline"
                                strokeColor="hsl(var(--primary))"
                            />
                        ) : null
                    }
                />
            )
        case "kpi-monthly-revenue":
            return (
                <KpiInline
                    label="Monthly revenue"
                    value={formatCurrency(ctx.kpi.monthlyRevenue)}
                    Icon={Wallet}
                    accent="emerald"
                    trend={ctx.kpi.revenueTrend ?? null}
                    trendSuffix="vs last month"
                    sublabel={ctx.kpi.revenueTrend == null ? "Closed this month" : undefined}
                    onClick={() => ctx.router.push("/finance")}
                />
            )
        case "kpi-conversion-rate":
            return (
                <KpiInline
                    label="Conversion rate"
                    value={`${ctx.kpi.conversionRate}%`}
                    sublabel="Opportunities → Won"
                    Icon={TrendingUp}
                    accent="violet"
                    onClick={() => ctx.router.push("/pipeline")}
                />
            )
        case "kpi-open-inquiries":
            return (
                <KpiInline
                    label="Open inquiries"
                    value={ctx.kpi.openInquiries}
                    sublabel={ctx.kpi.avgDealValue > 0 ? `Avg ${formatCurrency(ctx.kpi.avgDealValue)}/deal` : "Active opportunities"}
                    Icon={Inbox}
                    accent="rose"
                    onClick={() => ctx.router.push("/pipeline")}
                />
            )
        case "kpi-active-customers":
            return (
                <KpiInline
                    label="Active Tenants"
                    value={ctx.kpi.activeStayCount}
                    sublabel={`${ctx.kpi.totalContacts} total contacts`}
                    Icon={Home}
                    accent="primary"
                    onClick={() => ctx.router.push("/contacts?status=Active+Stay")}
                />
            )
        case "kpi-closed-profit":
            return (
                <KpiInline
                    label="Total closed profit"
                    value={formatCurrency(ctx.kpi.totalClosedProfit)}
                    sublabel={ctx.kpi.avgProfitPerDeal > 0 ? `Avg ${formatCurrency(ctx.kpi.avgProfitPerDeal)}/deal` : "Across signed deals"}
                    Icon={Wallet}
                    accent="emerald"
                    onClick={() => ctx.router.push("/finance")}
                />
            )
        case "kpi-weighted-forecast":
            return (
                <KpiInline
                    label="Weighted forecast"
                    value={formatCurrency(ctx.kpi.weightedForecast)}
                    sublabel={ctx.kpi.forecastStdDev > 0
                        ? `± ${formatCurrency(ctx.kpi.forecastStdDev)} (1σ)`
                        : "Probability-adjusted"}
                    Icon={Target}
                    accent="sky"
                    onClick={() => ctx.router.push("/pipeline")}
                />
            )
        case "kpi-lead-velocity":
            return (
                <KpiInline
                    label="Lead velocity"
                    value={ctx.kpi.leadVelocity}
                    Icon={Users}
                    accent="amber"
                    trend={ctx.kpi.leadVelocityTrend ?? null}
                    trendSuffix="vs prior 30d"
                    sublabel={ctx.kpi.leadVelocityTrend == null ? "New contacts (30d)" : undefined}
                    onClick={() => ctx.router.push("/contacts")}
                />
            )
        case "kpi-avg-deal-value":
            return (
                <KpiInline
                    label="Avg deal value"
                    value={formatCurrency(ctx.kpi.avgDealValue)}
                    sublabel="Across active opportunities"
                    Icon={DollarSign}
                    accent="blue"
                    onClick={() => ctx.router.push("/pipeline")}
                />
            )
        case "kpi-tasks-due-today": {
            const today = new Date().toISOString().slice(0, 10)
            const dueToday = ctx.pendingTasks.filter((t) => t.dueDate === today).length
            return (
                <KpiInline
                    label="Tasks due today"
                    value={dueToday}
                    sublabel={`${ctx.pendingTasks.length} pending overall`}
                    Icon={CheckSquare}
                    accent="amber"
                    onClick={() => ctx.router.push("/tasks")}
                />
            )
        }

        // ── Charts ──────────────────────────────────────────────────
        case "chart":
            return (
                <div className="flex flex-col h-full p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <BarChart3 className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold leading-tight">Pipeline value</p>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                    Trend over the selected timeframe
                                </p>
                            </div>
                        </div>
                        <div className="flex bg-muted/30 p-0.5 rounded-md shrink-0">
                            {(["1m", "6m", "1y"] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => ctx.setTimeframe(t)}
                                    className={cn(
                                        "px-2 py-1 text-[10px] font-bold rounded-sm transition-all",
                                        ctx.timeframe === t
                                            ? "bg-background shadow-sm text-foreground"
                                            : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    {t.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        {ctx.valueData.some((d) => d.value > 0) ? (
                            <LazyAreaChartWrapper
                                variant="full"
                                data={ctx.valueData}
                                dataKey="value"
                                gradientId="colorValue"
                                strokeColor="#10b981"
                                gradientStopColor="#10b981"
                                xAxisInterval={ctx.timeframe === "1m" ? 4 : ctx.timeframe === "6m" ? 3 : 1}
                                yAxisFormatter={(value) => (value >= 1000000 ? `$${(value / 1000000).toFixed(1)}M` : `$${Math.round(value / 1000)}K`)}
                                tooltipFormatter={(value: any) => [`$${(Number(value) || 0).toLocaleString()}`, "Value"]}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                                No opportunity data for this period
                            </div>
                        )}
                    </div>
                </div>
            )

        case "stages":
            return (
                <DistributionList
                    title="Stage distribution"
                    description="Deal volume & value by stage"
                    Icon={BarChart3}
                    accent="violet"
                    items={ctx.stageData.map((s) => ({
                        name: s.name,
                        primary: s.count,
                        secondary: `$${s.value.toLocaleString()}`,
                        color: s.color,
                    }))}
                    suffix={(item) => `${item.primary} deals`}
                    emptyMessage="No deals in this pipeline"
                />
            )

        case "bases":
            return (
                <DistributionList
                    title="Inquiry Tracker"
                    description="Deals per Military Base"
                    Icon={Workflow}
                    accent="rose"
                    items={ctx.baseData.map((b) => ({
                        name: b.name,
                        primary: b.deals,
                        secondary: `${b.deals} ${b.deals === 1 ? "deal" : "deals"}`,
                        color: b.color,
                    }))}
                    suffix={(item) => `${item.primary}`}
                    emptyMessage="No location data available"
                />
            )

        case "donut":
            return (
                <div className="flex flex-col h-full p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                            <PieChart className="h-3.5 w-3.5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold leading-tight">Opportunity status</p>
                            <p className="text-[11px] text-muted-foreground leading-tight">
                                Open / Won / Lost
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        {ctx.donutData.length > 0 ? (
                            <LazyPieChartWrapper data={ctx.donutData} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                                No deals in this pipeline
                            </div>
                        )}
                    </div>
                </div>
            )

        case "source-attribution":
            return (
                <DistributionList
                    title="Lead source attribution"
                    description="Pipeline volume by source"
                    Icon={Megaphone}
                    accent="amber"
                    items={ctx.sourceData.map((s, idx) => ({
                        name: s.source || "Unattributed",
                        primary: s.count,
                        secondary: `$${s.value.toLocaleString()}`,
                        color: SOURCE_COLORS[idx % SOURCE_COLORS.length],
                    }))}
                    suffix={(item) => `${item.primary} deals`}
                    emptyMessage="No source data yet"
                />
            )

        // ── Lists ──────────────────────────────────────────────────
        case "tasks":
            return (
                <div className="flex flex-col h-full p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <CheckSquare className="h-3.5 w-3.5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold leading-tight">Priority tasks</p>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                    Immediate focus items
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={ctx.onAddTask}>
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto space-y-2">
                        {ctx.pendingTasks.length > 0 ? (
                            ctx.pendingTasks.slice(0, 8).map((task) => (
                                <div
                                    key={task.id}
                                    className="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group cursor-pointer"
                                    onClick={() => ctx.onToggleTask(task.id, task.status)}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={cn(
                                            "h-2 w-2 rounded-full shrink-0",
                                            task.priority === "High" ? "bg-rose-500" :
                                                task.priority === "Medium" ? "bg-amber-500" : "bg-emerald-500",
                                        )} />
                                        <span className="text-xs font-medium truncate">{task.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {task.dueDate && (
                                            <Badge variant="outline" className="text-[10px] h-5">
                                                {task.dueDate.split("-").slice(1).join("/")}
                                            </Badge>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => ctx.onEditTask(task, e)}
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                            onClick={(e) => ctx.onDeleteTask(task.id, e)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                                <p>No pending tasks</p>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={ctx.onAddTask}>
                                    <Plus className="h-3 w-3 mr-1" /> Add task
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )

        case "hot-deals":
            return <HotDealsList router={ctx.router} />
        case "recent-contacts":
            return <RecentContactsList router={ctx.router} />

        case "activity":
            return <ActivityFeed />

        // ── Other ──────────────────────────────────────────────────
        case "goals":
            return <GoalTracker kpi={ctx.kpi} />

        case "calendar":
            return (
                <div className="flex flex-col h-full p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-3 shrink-0">
                        <div className="w-7 h-7 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Calendar className="h-3.5 w-3.5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold leading-tight">Calendar</p>
                            <p className="text-[11px] text-muted-foreground leading-tight">
                                Quick date overview
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col">
                        <MiniCalendar
                            selectedDate={new Date()}
                            eventDates={ctx.pendingTasks.filter((t) => t.dueDate).map((t) => new Date(t.dueDate))}
                            onDayClick={() => ctx.router.push("/calendar")}
                            fillHeight
                        />
                    </div>
                </div>
            )

        case "setup-checklist":
            return (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground p-4">
                    <Sparkles className="h-6 w-6 text-primary opacity-60" />
                    <p className="text-sm font-medium text-foreground">Setup checklist</p>
                    <Link href="/setup" className="text-primary hover:underline">
                        Open setup wizard →
                    </Link>
                </div>
            )

        case "team-leaderboard":
            return (
                <div className="h-full overflow-auto p-4 sm:p-5">
                    <LeaderboardTab />
                </div>
            )

        default:
            return (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground p-4">
                    Unknown widget: {id}
                </div>
            )
    }
}

// ─── KPI inline (used inside DashboardWidget which provides Card chrome) ──

function KpiInline({
    label, value, sublabel, trend, trendSuffix, Icon, accent, onClick, sparkline,
}: {
    label: string
    value: React.ReactNode
    sublabel?: React.ReactNode
    trend?: number | null
    trendSuffix?: string
    Icon: React.ComponentType<{ className?: string }>
    accent: "primary" | "emerald" | "blue" | "violet" | "amber" | "rose" | "sky"
    onClick?: () => void
    sparkline?: React.ReactNode
}) {
    const tone = ACCENT_TONES[accent]
    const trendIsPositive = (trend ?? 0) >= 0
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                "h-full w-full text-left p-4 sm:p-5 transition-all relative flex flex-col overflow-hidden",
                onClick && "cursor-pointer",
            )}
        >
            <div
                aria-hidden
                className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", tone.gradient)}
            />
            <div className="flex items-start justify-between gap-2 mb-3 shrink-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                    {label}
                </p>
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", tone.iconBg)}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
            </div>
            <div className="text-2xl font-bold tabular-nums tracking-tight leading-none shrink-0">
                {value}
            </div>
            {trend != null ? (
                <p className={cn(
                    "text-[11px] mt-1.5 font-medium flex items-center gap-1 flex-wrap shrink-0",
                    trendIsPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                )}>
                    {trendIsPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span className="tabular-nums">
                        {trend > 0 ? "+" : ""}{trend}%
                    </span>
                    {trendSuffix && <span className="text-muted-foreground font-normal">{trendSuffix}</span>}
                </p>
            ) : sublabel ? (
                <p className="text-[11px] mt-1.5 text-muted-foreground font-medium shrink-0">{sublabel}</p>
            ) : null}
            {sparkline && (
                <div className="flex-1 min-h-0 -mx-1 mt-2">{sparkline}</div>
            )}
        </button>
    )
}

const ACCENT_TONES: Record<string, { iconBg: string; gradient: string }> = {
    primary: { iconBg: "bg-primary/10 text-primary", gradient: "from-primary/30 to-transparent" },
    emerald: { iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", gradient: "from-emerald-500/30 to-transparent" },
    blue: { iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400", gradient: "from-blue-500/30 to-transparent" },
    violet: { iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400", gradient: "from-violet-500/30 to-transparent" },
    amber: { iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400", gradient: "from-amber-500/30 to-transparent" },
    rose: { iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400", gradient: "from-rose-500/30 to-transparent" },
    sky: { iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400", gradient: "from-sky-500/30 to-transparent" },
}

// ─── Distribution list (stages, bases, sources) ────────────────────────

function DistributionList({
    title, description, Icon, accent, items, suffix, emptyMessage,
}: {
    title: string
    description: string
    Icon: React.ComponentType<{ className?: string }>
    accent: "primary" | "emerald" | "blue" | "violet" | "amber" | "rose" | "sky"
    items: { name: string; primary: number; secondary: string; color: string }[]
    suffix?: (item: { name: string; primary: number; secondary: string; color: string }) => string
    emptyMessage: string
}) {
    const tone = ACCENT_TONES[accent]
    const total = items.reduce((acc, curr) => acc + curr.primary, 0)
    const max = Math.max(1, ...items.map((d) => d.primary))
    return (
        <div className="flex flex-col h-full p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", tone.iconBg)}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{title}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight truncate">
                        {description}
                    </p>
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto space-y-2.5">
                {items.length > 0 ? (
                    items.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                    <span className="font-semibold text-foreground/90 truncate">{item.name}</span>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="font-bold text-foreground tabular-nums">
                                        {item.secondary}
                                    </span>
                                    <span className="ml-1.5 text-[10px] text-muted-foreground font-medium tabular-nums">
                                        {total > 0 ? Math.round((item.primary / total) * 100) : 0}%
                                    </span>
                                </div>
                            </div>
                            <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                        width: `${(item.primary / max) * 100}%`,
                                        backgroundColor: item.color,
                                        opacity: 0.85,
                                    }}
                                />
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                        {emptyMessage}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Hot deals list ─────────────────────────────────────────────────────

function HotDealsList({ router }: { router: ReturnType<typeof useRouter> }) {
    const [deals, setDeals] = React.useState<import("./actions").HotDeal[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        import("./actions").then(({ getHotDeals }) =>
            getHotDeals(6).then(res => {
                if (res.success && res.data) setDeals(res.data)
                setLoading(false)
            })
        )
    }, [])

    return (
        <div className="flex flex-col h-full p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3 shrink-0">
                <div className="w-7 h-7 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Flame className="h-3.5 w-3.5" />
                </div>
                <div>
                    <p className="text-sm font-semibold leading-tight">Hot deals</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                        Top open opportunities by value
                    </p>
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
                {loading ? (
                    <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-9 bg-muted/30 rounded animate-pulse" />
                        ))}
                    </div>
                ) : deals.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
                        <p>No open deals yet</p>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => router.push("/pipeline")}>
                            Go to pipeline
                        </Button>
                    </div>
                ) : (
                    <ul className="space-y-1.5">
                        {deals.map((d) => (
                            <li key={d.id}>
                                <button
                                    onClick={() => router.push(`/pipeline?deal=${d.id}`)}
                                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors text-left group"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate group-hover:text-foreground">
                                            {d.name}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                            {d.contactName ? `${d.contactName} · ` : ""}{d.stageName}
                                        </p>
                                    </div>
                                    <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                                        {formatCurrency(d.value)}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

// ─── Recent contacts list ───────────────────────────────────────────────

function RecentContactsList({ router }: { router: ReturnType<typeof useRouter> }) {
    const [contacts, setContacts] = React.useState<import("./actions").RecentContact[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        import("./actions").then(({ getRecentContacts }) =>
            getRecentContacts(6).then(res => {
                if (res.success && res.data) setContacts(res.data)
                setLoading(false)
            })
        )
    }, [])

    const relTime = (iso: string): string => {
        const ms = Date.now() - new Date(iso).getTime()
        const min = Math.floor(ms / 60000)
        const hr = Math.floor(min / 60)
        const day = Math.floor(hr / 24)
        if (min < 1) return "just now"
        if (min < 60) return `${min}m ago`
        if (hr < 24) return `${hr}h ago`
        if (day < 7) return `${day}d ago`
        return `${Math.floor(day / 7)}w ago`
    }

    return (
        <div className="flex flex-col h-full p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3 shrink-0">
                <div className="w-7 h-7 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Users className="h-3.5 w-3.5" />
                </div>
                <div>
                    <p className="text-sm font-semibold leading-tight">Recent contacts</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                        Latest contacts added across all sources
                    </p>
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
                {loading ? (
                    <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-9 bg-muted/30 rounded animate-pulse" />
                        ))}
                    </div>
                ) : contacts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
                        <p>No contacts yet</p>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => router.push("/contacts")}>
                            Go to contacts
                        </Button>
                    </div>
                ) : (
                    <ul className="space-y-1.5">
                        {contacts.map((c) => (
                            <li key={c.id}>
                                <button
                                    onClick={() => router.push(`/contacts?contact=${c.id}`)}
                                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors text-left group"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate group-hover:text-foreground">
                                            {c.name}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                            {c.email || c.phone || "—"}
                                        </p>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                        {relTime(c.createdAt)}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

// ─── Helpers ────────────────────────────────────────────────────────────

const SOURCE_COLORS = ["#2563eb", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"]

function formatCurrency(value: number) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
}
