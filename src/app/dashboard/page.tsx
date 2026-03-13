"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Calendar,
    CheckCircle2,
    AlertCircle,
    ChevronDown,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Inbox,
    Home,
    Loader2,
    Users,
    Target,
    BarChart3,
    Download,
    Banknote,
    Plus,
    Pencil,
    Trash2,
    RefreshCw,
    Settings2,
    ArrowUp,
    ArrowDown,
    Eye,
    EyeOff,
} from "lucide-react"
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import dynamic from "next/dynamic"
import { getDashboardData } from "./actions"
import type { DashboardData } from "./types"
import { toggleTaskComplete, deleteTask } from "@/app/calendar/actions"
import { CreateTaskDialog } from "@/components/ui/CreateTaskDialog"
import { exportToPDF } from "@/lib/export"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh"
import { Skeleton } from "@/components/ui/skeleton"
import { DateRangePicker, type DateRange } from "./DateRangePicker"
import { GoalTracker } from "./GoalTracker"
import { MiniCalendar } from "@/components/MiniCalendar"
import { useIsMobile } from "@/hooks/useIsMobile"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"

const RevenueForecast = dynamic(
    () => import("./forecasting/RevenueForecast").then(mod => mod.RevenueForecast),
    { loading: () => <Skeleton className="h-[350px] w-full rounded-xl" />, ssr: false }
)
const LeaderboardTab = dynamic(
    () => import("./LeaderboardTab").then(mod => mod.LeaderboardTab),
    { loading: () => <Skeleton className="h-[400px] w-full rounded-xl" />, ssr: false }
)

function formatCurrency(value: number) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
}

// ─── Mobile Dashboard Component ─────────────────────────────────────
function MobileDashboard({
    kpi,
    pendingTasks,
    stageData,
    onToggleTask,
    onRefresh,
    loading,
    router,
}: {
    kpi: DashboardData['kpi']
    pendingTasks: DashboardData['tasks']
    stageData: { name: string; count: number; value: number; color: string }[]
    onToggleTask: (taskId: string, status: string) => void
    onRefresh: () => Promise<void>
    loading: boolean
    router: ReturnType<typeof useRouter>
}) {
    const { refreshing, pullDistance } = usePullToRefresh(onRefresh)

    const kpiCards = [
        { label: "Active Tenants", value: kpi.activeStayCount.toString(), icon: Home, color: "text-primary", href: "/contacts?status=Active+Stay" },
        { label: "Revenue", value: formatCurrency(kpi.monthlyRevenue), icon: DollarSign, color: "text-emerald-400", href: "/finance", trend: kpi.revenueTrend },
        { label: "Conversion", value: `${kpi.conversionRate}%`, icon: TrendingUp, color: "text-emerald-400", href: "/pipeline" },
        { label: "Pipeline", value: formatCurrency(kpi.totalPipelineValue), icon: Target, color: "text-primary", href: "/pipeline" },
    ]

    return (
        <div className="relative min-h-full bg-zinc-950 overflow-x-hidden">
            {/* Pull-to-refresh indicator */}
            {pullDistance > 0 && (
                <div className="pull-indicator flex items-center justify-center" style={{ height: pullDistance }}>
                    {refreshing ? (
                        <div className="pull-spinner" />
                    ) : (
                        <div
                            className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full"
                            style={{ transform: `rotate(${pullDistance * 3}deg)`, opacity: Math.min(pullDistance / 60, 1) }}
                        />
                    )}
                </div>
            )}

            <div className="px-4 pt-3 pb-24 space-y-5" style={{ transform: `translateY(${pullDistance}px)` }}>
                {/* 2x2 KPI Grid */}
                <div className="grid grid-cols-2 gap-3">
                    {kpiCards.map((card) => {
                        const Icon = card.icon
                        return (
                            <button
                                key={card.label}
                                className="mobile-card p-3.5 text-left touch-manipulation"
                                onClick={() => router.push(card.href)}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{card.label}</span>
                                    <Icon className={`h-3.5 w-3.5 ${card.color} opacity-60`} />
                                </div>
                                <div className="text-xl font-bold text-white">{card.value}</div>
                                {card.trend != null && (
                                    <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${card.trend >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        {card.trend >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                        {card.trend > 0 ? "+" : ""}{card.trend}%
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Quick Stats Row */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 max-w-[calc(100%+2rem)]">
                    {[
                        { label: "Profit", value: formatCurrency(kpi.totalClosedProfit), color: "bg-emerald-500/10 text-emerald-400" },
                        { label: "Forecast", value: formatCurrency(kpi.weightedForecast), color: "bg-primary/10 text-primary" },
                        { label: "Leads (30d)", value: kpi.leadVelocity.toString(), color: "bg-amber-500/10 text-amber-400" },
                        { label: "Open", value: kpi.openInquiries.toString(), color: "bg-rose-500/10 text-rose-400" },
                    ].map(stat => (
                        <div key={stat.label} className={`flex-shrink-0 rounded-xl px-3.5 py-2 ${stat.color}`}>
                            <span className="text-[10px] font-medium opacity-70">{stat.label}</span>
                            <span className="ml-1.5 text-xs font-bold">{stat.value}</span>
                        </div>
                    ))}
                </div>

                {/* Stage Distribution (compact) */}
                {stageData.length > 0 && (
                    <div>
                        <div className="mobile-section-header">Pipeline Stages</div>
                        <div className="mobile-card p-3">
                            <div className="space-y-2.5">
                                {stageData.slice(0, 5).map((stage, idx) => (
                                    <div key={idx} className="flex items-center gap-2.5">
                                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                                        <span className="text-xs font-medium text-zinc-300 flex-1 truncate">{stage.name}</span>
                                        <span className="text-xs font-bold text-white">{stage.count}</span>
                                        <span className="text-[10px] text-zinc-500 w-14 text-right">{formatCurrency(stage.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tasks */}
                <div>
                    <div className="mobile-section-header">Priority Tasks</div>
                    {pendingTasks.length > 0 ? (
                        <div className="space-y-2">
                            {pendingTasks.slice(0, 6).map((task) => (
                                <button
                                    key={task.id}
                                    className="mobile-card w-full p-3.5 flex items-center gap-3 touch-manipulation text-left"
                                    onClick={() => onToggleTask(task.id, task.status)}
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                        task.status === "Completed"
                                            ? "bg-emerald-500 border-emerald-500"
                                            : "border-zinc-600"
                                    }`}>
                                        {task.status === "Completed" && <CheckCircle2 className="h-3 w-3 text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-white block truncate">{task.title}</span>
                                        {task.dueDate && (
                                            <span className="text-[10px] text-zinc-500">{task.dueDate.split('-').slice(1).join('/')}</span>
                                        )}
                                    </div>
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                                        task.priority === "High" ? "bg-rose-500" : task.priority === "Medium" ? "bg-amber-500" : "bg-emerald-500"
                                    }`} />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="mobile-card p-6 text-center text-zinc-500 text-sm">
                            No pending tasks
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function DashboardPage() {
    const router = useRouter()
    const isMobile = useIsMobile()
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)

    const [globalPipelineId, setGlobalPipelineId] = useState("")
    const [timeframe, setTimeframe] = useState<"1m" | "6m" | "1y">("6m")
    const [chartView, setChartView] = useState<"forecast" | "pipeline">("forecast")
    const [tasks, setTasks] = useState<DashboardData['tasks']>([])
    const [dateRange, setDateRange] = useState<DateRange | null>(() => {
        if (typeof window === 'undefined') return null
        try {
            const saved = localStorage.getItem('dashboard-date-range')
            if (saved) return JSON.parse(saved)
        } catch {}
        return null
    })
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<any>(null)
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Widget layout customization
    type WidgetId = "chart" | "donut" | "stages" | "bases" | "tasks" | "goals"
    const defaultWidgetOrder: WidgetId[] = ["chart", "donut", "stages", "bases", "tasks", "goals"]
    const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(() => {
        if (typeof window === 'undefined') return defaultWidgetOrder
        try {
            const saved = localStorage.getItem('dashboard-widget-order')
            if (saved) return JSON.parse(saved)
        } catch {}
        return defaultWidgetOrder
    })
    const [hiddenWidgets, setHiddenWidgets] = useState<WidgetId[]>(() => {
        if (typeof window === 'undefined') return []
        try {
            const saved = localStorage.getItem('dashboard-hidden-widgets')
            if (saved) return JSON.parse(saved)
        } catch {}
        return []
    })
    const [showLayoutEditor, setShowLayoutEditor] = useState(false)

    const widgetLabels: Record<WidgetId, string> = {
        chart: "Revenue & Pipeline Chart",
        donut: "Opportunity Status",
        stages: "Stage Distribution",
        bases: "Inquiry Tracker",
        tasks: "Priority Tasks",
        goals: "Goals",
    }

    const moveWidget = (id: WidgetId, dir: -1 | 1) => {
        setWidgetOrder(prev => {
            const idx = prev.indexOf(id)
            if (idx < 0) return prev
            const newIdx = Math.max(0, Math.min(prev.length - 1, idx + dir))
            const copy = [...prev]
            copy.splice(idx, 1)
            copy.splice(newIdx, 0, id)
            localStorage.setItem('dashboard-widget-order', JSON.stringify(copy))
            return copy
        })
    }

    const toggleWidget = (id: WidgetId) => {
        setHiddenWidgets(prev => {
            const next = prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
            localStorage.setItem('dashboard-hidden-widgets', JSON.stringify(next))
            return next
        })
    }

    useEffect(() => {
        if (dateRange) {
            localStorage.setItem('dashboard-date-range', JSON.stringify(dateRange))
        } else {
            localStorage.removeItem('dashboard-date-range')
        }
    }, [dateRange])

    const fetchDashboard = useCallback(() => {
        setLoading(true)
        getDashboardData(dateRange?.startDate, dateRange?.endDate).then(result => {
            if (result.success && result.data) {
                setData(result.data)
                setTasks(result.data.tasks)
                const firstId = result.data.pipelines[0]?.id || ""
                setGlobalPipelineId(firstId)
                setLastRefreshed(new Date())
            }
            setLoading(false)
            setIsRefreshing(false)
        }).catch(err => {
            console.error("Dashboard fetch failed:", err)
            setLoading(false)
        })
    }, [dateRange])

    useEffect(() => { fetchDashboard() }, [fetchDashboard])

    // Auto-refresh when push notification arrives or tab regains focus
    useRealtimeRefresh(fetchDashboard)

    const handleToggleTask = useCallback(async (taskId: string, currentStatus: string) => {
        const newCompleted = currentStatus !== "Completed"
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: newCompleted ? "Completed" : "Pending" } : t
        ))
        await toggleTaskComplete(taskId, newCompleted)
    }, [])

    const handleDeleteTask = useCallback(async (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setTasks(prev => prev.filter(t => t.id !== taskId))
        await deleteTask(taskId)
    }, [])

    const handleEditTask = useCallback((task: any, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingTask({
            id: task.id,
            title: task.title,
            dueDate: task.dueDate,
            priority: task.priority === "High" ? "HIGH" : task.priority === "Medium" ? "MEDIUM" : "LOW",
        })
        setIsTaskDialogOpen(true)
    }, [])

    const pendingTasks = useMemo(() => {
        return tasks
            .filter(task => task.status !== "Completed")
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    }, [tasks])

    const getPipelineName = useCallback((id: string) => {
        return data?.pipelines.find(p => p.id === id)?.name || "Select Pipeline"
    }, [data])

    if (loading) {
        return (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Dashboard
                        </h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Loading analytics...</p>
                    </div>
                    <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4">
                        {[...Array(8)].map((_, i) => (
                            <Card key={i} className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                                <CardContent className="pt-6">
                                    <div className="h-4 w-24 bg-muted/30 rounded animate-pulse mb-3" />
                                    <div className="h-8 w-16 bg-muted/30 rounded animate-pulse" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="h-[320px] bg-muted/10 rounded-lg animate-pulse" />
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="h-[300px] bg-muted/10 rounded-lg animate-pulse" />
                        <div className="h-[300px] bg-muted/10 rounded-lg animate-pulse" />
                    </div>
                </div>
            </div>
        )
    }

    if (!data || data.pipelines.length === 0) {
        return (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Dashboard
                        </h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Operations overview & real-time analytics.</p>
                    </div>
                    <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">No pipeline data yet</p>
                            <p className="text-sm mt-1">Create a pipeline and add opportunities to see your dashboard analytics.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    const kpi = data.kpi
    const valueData = data.pipelineData[globalPipelineId]?.valueOverTime[timeframe] || []
    const stageData = data.pipelineData[globalPipelineId]?.stageDistribution || []
    const donutData = data.pipelineData[globalPipelineId]?.statusDistribution.map(s => ({ name: s.name, value: s.count, color: s.color })) || []
    const baseData = data.pipelineData[globalPipelineId]?.dealsByBase || []

    // ─── Mobile Dashboard ───────────────────────────────────────────
    if (isMobile) {
        return (
            <MobileDashboard
                kpi={kpi}
                pendingTasks={pendingTasks}
                stageData={stageData}
                onToggleTask={handleToggleTask}
                onRefresh={async () => { fetchDashboard() }}
                loading={loading}
                router={router}
            />
        )
    }

    const PipelineDropdown = ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 min-h-[44px] sm:min-h-0 text-xs sm:text-[11px] font-medium text-muted-foreground hover:text-foreground touch-manipulation">
                    {getPipelineName(value)}
                    <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
                {data.pipelines.map(p => (
                    <DropdownMenuItem key={p.id} className="text-xs" onClick={() => onChange(p.id)}>
                        {p.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )

    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Dashboard
                        </h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Operations overview & real-time analytics.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {lastRefreshed && (
                            <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setIsRefreshing(true); fetchDashboard() }}
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setShowLayoutEditor(!showLayoutEditor)}
                            title="Customize layout"
                        >
                            <Settings2 className={`h-3.5 w-3.5 ${showLayoutEditor ? "text-primary" : ""}`} />
                        </Button>
                        <PipelineDropdown value={globalPipelineId} onChange={setGlobalPipelineId} />
                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportToPDF("Dashboard Report")}
                            className="hidden sm:flex"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export PDF
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="bg-muted/30 border border-white/5 flex-wrap h-auto gap-0.5 p-1">
                        <TabsTrigger value="overview" className="text-xs font-semibold">Overview</TabsTrigger>
                        <TabsTrigger value="leaderboard" className="text-xs font-semibold">Leaderboard</TabsTrigger>
                    </TabsList>

                    <TabsContent value="leaderboard" className="m-0">
                        <LeaderboardTab />
                    </TabsContent>

                    <TabsContent value="overview" className="m-0 space-y-6 sm:space-y-8">

                {/* Layout editor panel */}
                {showLayoutEditor && (
                    <Card className="border-primary/20 bg-primary/5 shadow-sm">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customize Layout</p>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => {
                                    setWidgetOrder(defaultWidgetOrder)
                                    setHiddenWidgets([])
                                    localStorage.removeItem('dashboard-widget-order')
                                    localStorage.removeItem('dashboard-hidden-widgets')
                                }}>
                                    Reset
                                </Button>
                            </div>
                            <div className="space-y-1.5">
                                {widgetOrder.map((id, idx) => (
                                    <div key={id} className="flex items-center gap-2 p-2 rounded-md bg-background/50 border border-border/30">
                                        <button onClick={() => toggleWidget(id)} className="text-muted-foreground hover:text-foreground">
                                            {hiddenWidgets.includes(id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </button>
                                        <span className={`text-xs font-medium flex-1 ${hiddenWidgets.includes(id) ? "text-muted-foreground line-through" : ""}`}>
                                            {widgetLabels[id]}
                                        </span>
                                        <button onClick={() => moveWidget(id, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => moveWidget(id, 1)} disabled={idx === widgetOrder.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
                                            <ArrowDown className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* KPI Row */}
                <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4">
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => router.push('/contacts?status=Active+Stay')} role="link">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Tenants</CardTitle>
                            <Home className="h-4 w-4 text-primary opacity-70" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{kpi.activeStayCount}</div>
                            <p className="text-xs sm:text-[10px] text-muted-foreground mt-1 font-medium">
                                {kpi.totalContacts} total contacts
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => router.push('/pipeline')} role="link">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversion Rate</CardTitle>
                            <TrendingUp className="h-4 w-4 text-emerald-500 opacity-70" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{kpi.conversionRate}%</div>
                            <p className="text-xs sm:text-[10px] text-muted-foreground mt-1 font-medium">
                                Opportunities → Booked
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => router.push('/finance')} role="link">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Revenue</CardTitle>
                            <DollarSign className="h-4 w-4 text-emerald-500 opacity-70" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(kpi.monthlyRevenue)}</div>
                            <p className="text-xs sm:text-[10px] mt-1 font-medium flex items-center gap-1">
                                {kpi.revenueTrend != null ? (
                                    <>
                                        {kpi.revenueTrend >= 0 ? (
                                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                                        ) : (
                                            <TrendingDown className="h-3 w-3 text-rose-500" />
                                        )}
                                        <span className={kpi.revenueTrend >= 0 ? "text-emerald-500" : "text-rose-500"}>
                                            {kpi.revenueTrend > 0 ? "+" : ""}{kpi.revenueTrend}% vs last month
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">Booked this month</span>
                                )}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => router.push('/pipeline')} role="link">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pipeline Value</CardTitle>
                            <DollarSign className="h-4 w-4 text-primary opacity-70" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(kpi.totalPipelineValue)}</div>
                            {valueData.length > 1 && (
                                <div className="h-8 mt-1 -mx-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={valueData}>
                                            <defs>
                                                <linearGradient id="sparkPipeline" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#sparkPipeline)" isAnimationActive={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                            {valueData.length <= 1 && <p className="text-xs sm:text-[10px] text-muted-foreground mt-1 font-medium">Total opportunity value</p>}
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => router.push('/finance')} role="link">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Closed Profit</CardTitle>
                            <Banknote className="h-4 w-4 text-emerald-500 opacity-70" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(kpi.totalClosedProfit)}</div>
                            <p className="text-xs sm:text-[10px] text-muted-foreground mt-1 font-medium">
                                {kpi.avgProfitPerDeal > 0 ? `Avg ${formatCurrency(kpi.avgProfitPerDeal)}/deal` : "Across signed deals"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => router.push('/pipeline')} role="link">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weighted Forecast</CardTitle>
                            <Target className="h-4 w-4 text-primary opacity-70" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(kpi.weightedForecast)}</div>
                            <p className="text-xs sm:text-[10px] text-muted-foreground mt-1 font-medium">Probability-adjusted</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => router.push('/contacts')} role="link">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lead Velocity</CardTitle>
                            <Users className="h-4 w-4 text-primary opacity-70" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{kpi.leadVelocity}</div>
                            <p className="text-xs sm:text-[10px] mt-1 font-medium flex items-center gap-1">
                                {kpi.leadVelocityTrend != null ? (
                                    <>
                                        {kpi.leadVelocityTrend >= 0 ? (
                                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                                        ) : (
                                            <TrendingDown className="h-3 w-3 text-rose-500" />
                                        )}
                                        <span className={kpi.leadVelocityTrend >= 0 ? "text-emerald-500" : "text-rose-500"}>
                                            {kpi.leadVelocityTrend > 0 ? "+" : ""}{kpi.leadVelocityTrend}% vs prior 30d
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">New contacts (30d)</span>
                                )}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => router.push('/pipeline')} role="link">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Open Inquiries</CardTitle>
                            <Inbox className="h-4 w-4 text-rose-500 opacity-70" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{kpi.openInquiries}</div>
                            <p className="text-xs sm:text-[10px] text-muted-foreground mt-1 font-medium">
                                {kpi.avgDealValue > 0 ? `Avg ${formatCurrency(kpi.avgDealValue)}/deal` : "Active opportunities"}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Revenue & Pipeline Chart (combined with view switcher) */}
                {!hiddenWidgets.includes("chart") && <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 space-y-0 p-4 sm:p-6 pb-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            <div className="flex bg-muted/30 p-0.5 rounded-md">
                                {([
                                    { key: "forecast", label: "Revenue Forecast" },
                                    { key: "pipeline", label: "Pipeline Value" },
                                ] as const).map((tab) => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setChartView(tab.key)}
                                        className={`px-3 py-2 sm:px-2.5 sm:py-1 text-xs sm:text-[10px] font-bold rounded-sm transition-all min-h-[36px] sm:min-h-0 touch-manipulation ${chartView === tab.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {chartView === "pipeline" && (
                                <div className="flex bg-muted/30 p-0.5 rounded-md">
                                    {(["1m", "6m", "1y"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setTimeframe(t)}
                                            className={`px-3 py-2 sm:px-2 sm:py-1 text-xs sm:text-[10px] font-bold rounded-sm transition-all min-h-[36px] sm:min-h-0 touch-manipulation ${timeframe === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            {t.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0 px-4 sm:px-6">
                        {chartView === "forecast" && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-3">Probability-weighted revenue projections</p>
                                {globalPipelineId && <RevenueForecast pipelineId={globalPipelineId} />}
                            </div>
                        )}
                        {chartView === "pipeline" && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-3">
                                    {timeframe === "1m" ? "Daily value — last 30 days" : timeframe === "6m" ? "Weekly value — last 6 months" : "Monthly value — last 12 months"}
                                </p>
                                <div className="h-[240px] sm:h-[280px] w-full min-h-0">
                                    {valueData.some(d => d.value > 0) ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={valueData}>
                                                <defs>
                                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                                <XAxis
                                                    dataKey="name"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 10, fill: '#666' }}
                                                    dy={10}
                                                    interval={timeframe === "1m" ? 4 : timeframe === "6m" ? 3 : 1}
                                                />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#666' }} tickFormatter={(value) => value >= 1000000 ? `$${(value / 1000000).toFixed(1)}M` : `$${Math.round(value / 1000)}K`} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                                    itemStyle={{ color: '#10b981', padding: '0' }}
                                                    formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, 'Value']}
                                                />
                                                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" animationDuration={1500} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                            No opportunity data for this period
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>}

                {/* Row 1: Calendar (25%) + Goals (75%) */}
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-4 items-stretch">
                    <Card className="lg:col-span-1 border-none shadow-md bg-card/40 backdrop-blur-md flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-6 pb-4">
                            <div className="space-y-1">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    Calendar
                                </CardTitle>
                                <CardDescription className="text-xs">Quick date overview</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0 px-4 sm:px-6">
                            <MiniCalendar
                                selectedDate={new Date()}
                                eventDates={tasks.filter(t => t.dueDate).map(t => new Date(t.dueDate))}
                                onDayClick={() => router.push(`/calendar`)}
                            />
                        </CardContent>
                    </Card>

                    {!hiddenWidgets.includes("goals") && <div className="lg:col-span-3"><GoalTracker kpi={kpi} /></div>}
                </div>

                {/* Row 2: Stages + Bases (even split) */}
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                    {!hiddenWidgets.includes("stages") && <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-6 pb-4">
                            <div className="space-y-1">
                                <CardTitle className="text-base font-semibold">Stage Distribution</CardTitle>
                                <CardDescription className="text-xs">Deal volume & value by stage</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-2 px-4 sm:px-6">
                            <div className="space-y-3">
                                {stageData.length > 0 ? (() => {
                                    const totalCount = stageData.reduce((acc, curr) => acc + curr.count, 0)
                                    const maxCount = Math.max(...stageData.map(d => d.count))
                                    return stageData.map((stage, idx) => (
                                        <div key={idx} className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                                                    <span className="font-semibold text-foreground/90">{stage.name}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium">({stage.count})</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-foreground">${stage.value.toLocaleString()}</span>
                                                    <span className="ml-2 text-[10px] text-muted-foreground font-medium">
                                                        {totalCount > 0 ? ((stage.count / totalCount) * 100).toFixed(0) : 0}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                                    style={{
                                                        width: `${maxCount > 0 ? (stage.count / maxCount) * 100 : 0}%`,
                                                        backgroundColor: stage.color,
                                                        opacity: 0.8
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                })() : (
                                    <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
                                        No deals in this pipeline
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>}

                    {!hiddenWidgets.includes("bases") && <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-6 pb-4">
                            <div className="space-y-1">
                                <CardTitle className="text-base font-semibold">Inquiry Tracker</CardTitle>
                                <CardDescription className="text-xs">Deals per Military Base</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-2 px-4 sm:px-6">
                            <div className="space-y-3">
                                {baseData.length > 0 ? (() => {
                                    const totalDeals = baseData.reduce((acc, curr) => acc + curr.deals, 0)
                                    const maxDeals = Math.max(...baseData.map(d => d.deals))
                                    return baseData.map((base, idx) => (
                                        <div key={idx} className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: base.color }} />
                                                    <span className="font-semibold text-foreground/90">{base.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-foreground">{base.deals} {base.deals === 1 ? 'deal' : 'deals'}</span>
                                                    <span className="ml-2 text-[10px] text-muted-foreground font-medium">
                                                        {totalDeals > 0 ? ((base.deals / totalDeals) * 100).toFixed(0) : 0}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                                    style={{
                                                        width: `${maxDeals > 0 ? (base.deals / maxDeals) * 100 : 0}%`,
                                                        backgroundColor: base.color,
                                                        opacity: 0.8
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                })() : (
                                    <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
                                        No base data available
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>}
                </div>

                {/* Row 3: Donut (33%) + Tasks (66%) */}
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                    {!hiddenWidgets.includes("donut") && <Card className="lg:col-span-1 border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-6 pb-4">
                            <div className="space-y-1">
                                <CardTitle className="text-base font-semibold">Opportunity Status</CardTitle>
                                <CardDescription className="text-xs">Deals by status</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0 px-4 sm:px-6">
                            <div className="h-[220px] w-full min-h-0">
                                {donutData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={donutData}
                                                cx="50%"
                                                cy="45%"
                                                innerRadius={55}
                                                outerRadius={70}
                                                paddingAngle={4}
                                                dataKey="value"
                                                animationDuration={1500}
                                                stroke="none"
                                            >
                                                {donutData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#18181b', fontSize: '11px' }}
                                                itemStyle={{ color: '#18181b' }}
                                                formatter={(value: any, name: any) => [`${value} deals`, name]}
                                            />
                                            <Legend
                                                verticalAlign="bottom"
                                                height={36}
                                                iconSize={6}
                                                formatter={(value) => <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight">{value}</span>}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                        No deals in this pipeline
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>}

                    {!hiddenWidgets.includes("tasks") && <Card className="lg:col-span-2 border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-6 pb-4">
                            <div className="space-y-1">
                                <CardTitle className="text-base font-semibold">Priority Tasks</CardTitle>
                                <CardDescription className="text-xs">Immediate focus items</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingTask(null); setIsTaskDialogOpen(true); }}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6 pt-0">
                            <div className="space-y-2">
                                {pendingTasks.length > 0 ? pendingTasks.slice(0, 5).map((task) => (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between p-3 sm:p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors group cursor-pointer min-h-[44px] sm:min-h-0 touch-manipulation"
                                        onClick={() => handleToggleTask(task.id, task.status)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`h-2 w-2 rounded-full shrink-0 ${task.priority === "High" ? "bg-rose-500" : task.priority === "Medium" ? "bg-amber-500" : "bg-emerald-500"}`} />
                                            <span className="text-sm sm:text-xs font-medium truncate max-w-[200px]">{task.title}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {task.dueDate && <Badge variant="outline" className="text-xs sm:text-[9px] h-7 sm:h-5">{task.dueDate.split('-').slice(1).join('/')}</Badge>}
                                            <Button variant="ghost" size="icon" className="h-6 w-6 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => handleEditTask(task, e)}>
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-destructive" onClick={(e) => handleDeleteTask(task.id, e)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="py-8 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                                        <p>No pending tasks</p>
                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEditingTask(null); setIsTaskDialogOpen(true); }}>
                                            <Plus className="h-3 w-3 mr-1" /> Add Task
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>}
                </div>

                <CreateTaskDialog
                    isOpen={isTaskDialogOpen}
                    onClose={() => { setIsTaskDialogOpen(false); setEditingTask(null); }}
                    onSaved={() => fetchDashboard()}
                    initialData={editingTask}
                />

                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
