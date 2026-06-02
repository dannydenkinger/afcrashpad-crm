"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import dynamic from "next/dynamic"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    BarChart3, ChevronDown, Download, Pencil, RefreshCw, Sparkles, X,
    CheckCircle2, DollarSign, Home, Target, TrendingDown, TrendingUp,
} from "lucide-react"
import { toast } from "sonner"
import { FirstVisitHint } from "@/components/FirstVisitHint"
import { EmptyState } from "@/components/ui/EmptyState"
import { CreateTaskDialog } from "@/components/ui/CreateTaskDialog"
import { exportToPDF } from "@/lib/export"
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh"
import { useIsMobile } from "@/hooks/useIsMobile"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"

import { getDashboardData } from "./actions"
import { toggleTaskComplete, deleteTask } from "@/app/calendar/actions"
import { DateRangePicker, type DateRange } from "./DateRangePicker"
import {
    getDashboardLayouts, saveDashboardLayouts,
    type DashboardLayout, type SavedLayoutsDoc,
} from "./layout-actions"
import {
    DASHBOARD_TEMPLATES, TEMPLATES_BY_ID, WIDGETS_BY_ID,
    type DashboardTemplate, type GridLayoutItem, type WidgetMeta,
} from "./widget-registry"
import { GridDashboard } from "./GridDashboard"
import { AddWidgetDialog } from "./AddWidgetDialog"
import { ApplyTemplateDialog } from "./ApplyTemplateDialog"
import { LayoutSwitcher } from "./LayoutSwitcher"
import type { DashboardData } from "./types"

const LeaderboardTab = dynamic(
    () => import("./LeaderboardTab").then((mod) => mod.LeaderboardTab),
    { loading: () => <Skeleton className="h-[400px] w-full rounded-xl" />, ssr: false },
)

// ─── Helpers ──────────────────────────────────────────────────────────

function formatCurrency(value: number) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
}

function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 5) return "Good evening"
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
}

function getTodayLabel(): string {
    return new Date().toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
    })
}

function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "layout"
}

// ─── Mobile Dashboard ─────────────────────────────────────────────────

function MobileDashboard({
    kpi, pendingTasks, onToggleTask, onRefresh, router,
}: {
    kpi: DashboardData["kpi"]
    pendingTasks: DashboardData["tasks"]
    onToggleTask: (taskId: string, status: string) => void
    onRefresh: () => Promise<void>
    router: ReturnType<typeof useRouter>
}) {
    const { refreshing, pullDistance } = usePullToRefresh(onRefresh)
    const kpiCards = [
        { label: "Active Customers", value: kpi.activeStayCount.toString(), icon: Home, color: "text-primary", href: "/contacts?status=Customer" },
        { label: "Revenue", value: formatCurrency(kpi.monthlyRevenue), icon: DollarSign, color: "text-emerald-400", href: "/finance", trend: kpi.revenueTrend },
        { label: "Conversion", value: `${kpi.conversionRate}%`, icon: TrendingUp, color: "text-emerald-400", href: "/pipeline" },
        { label: "Pipeline", value: formatCurrency(kpi.totalPipelineValue), icon: Target, color: "text-primary", href: "/pipeline" },
    ]
    return (
        <div className="relative min-h-full bg-background overflow-x-hidden">
            {pullDistance > 0 && (
                <div className="pull-indicator flex items-center justify-center" style={{ height: pullDistance }}>
                    {refreshing ? (
                        <div className="pull-spinner" />
                    ) : (
                        <div
                            className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground/80 rounded-full"
                            style={{ transform: `rotate(${pullDistance * 3}deg)`, opacity: Math.min(pullDistance / 60, 1) }}
                        />
                    )}
                </div>
            )}
            <div className="px-4 pt-3 pb-28 space-y-5" style={{ transform: `translateY(${pullDistance}px)` }}>
                <FirstVisitHint
                    pageKey="dashboard"
                    text="Welcome to your dashboard. Track revenue, watch the activity feed, and find your setup checklist in the sidebar."
                />
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
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</span>
                                    <Icon className={`h-3.5 w-3.5 ${card.color} opacity-60`} />
                                </div>
                                <div className="text-xl font-bold text-foreground">{card.value}</div>
                                {card.trend != null && (
                                    <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${card.trend >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        {card.trend >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                        {card.trend > 0 ? "+" : ""}{card.trend}%
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
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
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${task.status === "Completed" ? "bg-emerald-500 border-emerald-500" : "border-input"}`}>
                                        {task.status === "Completed" && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-foreground block truncate">{task.title}</span>
                                        {task.dueDate && (
                                            <span className="text-xs text-muted-foreground">{task.dueDate.split('-').slice(1).join('/')}</span>
                                        )}
                                    </div>
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${task.priority === "High" ? "bg-rose-500" : task.priority === "Medium" ? "bg-amber-500" : "bg-emerald-500"}`} />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="mobile-card p-6 text-center text-muted-foreground text-sm">
                            No pending tasks
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Main Dashboard Page ─────────────────────────────────────────────

export default function DashboardPage() {
    const router = useRouter()
    const isMobile = useIsMobile()
    const { data: session } = useSession()
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)

    const [globalPipelineId, setGlobalPipelineId] = useState("")
    const [timeframe, setTimeframe] = useState<"1m" | "6m" | "1y">("6m")
    const [tasks, setTasks] = useState<DashboardData["tasks"]>([])
    const [dateRange, setDateRange] = useState<DateRange | null>(() => {
        if (typeof window === "undefined") return null
        try {
            const saved = localStorage.getItem("dashboard-date-range")
            if (saved) return JSON.parse(saved)
        } catch { /* ignore */ }
        return null
    })
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<any>(null)
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // ── Layout state ──
    const [layouts, setLayouts] = useState<DashboardLayout[]>([])
    const [activeLayoutId, setActiveLayoutId] = useState<string>("default")
    const [defaultLayoutId, setDefaultLayoutId] = useState<string | null>(null)
    const [layoutsLoaded, setLayoutsLoaded] = useState(false)

    const [editMode, setEditMode] = useState(false)
    const [showAddWidget, setShowAddWidget] = useState(false)
    const [showApplyTemplate, setShowApplyTemplate] = useState(false)

    // Active layout pulled from state
    const activeLayout = useMemo(
        () => layouts.find((l) => l.id === activeLayoutId) || layouts[0] || null,
        [layouts, activeLayoutId],
    )

    useEffect(() => {
        if (dateRange) localStorage.setItem("dashboard-date-range", JSON.stringify(dateRange))
        else localStorage.removeItem("dashboard-date-range")
    }, [dateRange])

    // ── Load layouts on mount; seed with default template if empty ──
    useEffect(() => {
        let cancelled = false
        getDashboardLayouts().then((doc) => {
            if (cancelled) return
            if (doc.layouts.length > 0) {
                setLayouts(doc.layouts)
                setActiveLayoutId(doc.defaultLayoutId || doc.layouts[0].id)
                setDefaultLayoutId(doc.defaultLayoutId)
            } else {
                // Seed with the default template — only in memory until first
                // user edit triggers a save.
                const seed: DashboardLayout = {
                    id: "default",
                    name: "My dashboard",
                    items: TEMPLATES_BY_ID["default"]?.layout ?? [],
                }
                setLayouts([seed])
                setActiveLayoutId("default")
                setDefaultLayoutId("default")
            }
            setLayoutsLoaded(true)
        })
        return () => { cancelled = true }
    }, [])

    // ── Debounced save of layouts on change ──
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const persistLayouts = useCallback(
        (next: DashboardLayout[], nextDefault: string | null) => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
            saveTimerRef.current = setTimeout(() => {
                const payload: SavedLayoutsDoc = {
                    layouts: next,
                    defaultLayoutId: nextDefault,
                }
                saveDashboardLayouts(payload).catch(() => {
                    /* silent — try again on next change */
                })
            }, 800)
        },
        [],
    )

    // ── Layout management ──
    const updateActiveLayoutItems = (items: GridLayoutItem[]) => {
        if (!activeLayout) return
        const next = layouts.map((l) =>
            l.id === activeLayout.id ? { ...l, items, updatedAt: new Date().toISOString() } : l,
        )
        setLayouts(next)
        if (layoutsLoaded) persistLayouts(next, defaultLayoutId)
    }

    const addWidget = (widget: WidgetMeta) => {
        if (!activeLayout) return
        // Find the next free spot — append at the bottom-left.
        const maxY = activeLayout.items.reduce((max, it) => Math.max(max, it.y + it.h), 0)
        const newItem: GridLayoutItem = {
            i: widget.id,
            x: 0,
            y: maxY,
            w: widget.defaultSize.w,
            h: widget.defaultSize.h,
        }
        // Avoid duplicates — if already present, just bring it back into place.
        const exists = activeLayout.items.find((it) => it.i === widget.id)
        const nextItems = exists
            ? activeLayout.items
            : [...activeLayout.items, newItem]
        updateActiveLayoutItems(nextItems)
        toast.success(`Added "${widget.title}"`)
    }

    const switchLayout = (id: string) => {
        setActiveLayoutId(id)
    }

    const createLayout = (name: string) => {
        const id = `${slugify(name)}-${Date.now().toString(36).slice(-4)}`
        const newLayout: DashboardLayout = {
            id, name, items: [], createdAt: new Date().toISOString(),
        }
        const next = [...layouts, newLayout]
        setLayouts(next)
        setActiveLayoutId(id)
        persistLayouts(next, defaultLayoutId || id)
        if (!defaultLayoutId) setDefaultLayoutId(id)
        toast.success(`Created "${name}"`)
        setEditMode(true)
    }

    const renameLayout = (id: string, name: string) => {
        const next = layouts.map((l) => (l.id === id ? { ...l, name } : l))
        setLayouts(next)
        persistLayouts(next, defaultLayoutId)
    }

    const duplicateLayout = (id: string) => {
        const source = layouts.find((l) => l.id === id)
        if (!source) return
        const newId = `${source.id}-copy-${Date.now().toString(36).slice(-4)}`
        const dup: DashboardLayout = {
            id: newId,
            name: `${source.name} (copy)`,
            items: [...source.items],
            createdAt: new Date().toISOString(),
        }
        const next = [...layouts, dup]
        setLayouts(next)
        setActiveLayoutId(newId)
        persistLayouts(next, defaultLayoutId)
        toast.success(`Duplicated "${source.name}"`)
    }

    const deleteLayout = (id: string) => {
        if (layouts.length <= 1) {
            toast.error("Can't delete your only layout")
            return
        }
        const next = layouts.filter((l) => l.id !== id)
        const newActive = activeLayoutId === id ? next[0].id : activeLayoutId
        const newDefault = defaultLayoutId === id ? next[0].id : defaultLayoutId
        setLayouts(next)
        setActiveLayoutId(newActive)
        setDefaultLayoutId(newDefault)
        persistLayouts(next, newDefault)
        toast.success("Layout deleted")
    }

    const setLayoutAsDefault = (id: string) => {
        setDefaultLayoutId(id)
        persistLayouts(layouts, id)
        toast.success("Default layout updated")
    }

    const applyTemplate = (template: DashboardTemplate, options: { mode: "replace" | "new" }) => {
        if (options.mode === "new") {
            const id = `${slugify(template.name)}-${Date.now().toString(36).slice(-4)}`
            const newLayout: DashboardLayout = {
                id, name: template.name, items: [...template.layout],
                createdAt: new Date().toISOString(),
            }
            const next = [...layouts, newLayout]
            setLayouts(next)
            setActiveLayoutId(id)
            persistLayouts(next, defaultLayoutId || id)
            toast.success(`Created "${template.name}" from template`)
        } else {
            if (!activeLayout) return
            const next = layouts.map((l) =>
                l.id === activeLayout.id ? { ...l, items: [...template.layout] } : l,
            )
            setLayouts(next)
            persistLayouts(next, defaultLayoutId)
            toast.success(`Applied "${template.name}" template`)
        }
    }

    // ── Data fetching ──
    const fetchDashboard = useCallback(() => {
        setLoading(true)
        getDashboardData(dateRange?.startDate, dateRange?.endDate).then((result) => {
            if (result.success && result.data) {
                setData(result.data)
                setTasks(result.data.tasks)
                const firstId = result.data.pipelines[0]?.id || ""
                setGlobalPipelineId(firstId)
                setLastRefreshed(new Date())
            }
            setLoading(false)
            setIsRefreshing(false)
        }).catch((err) => {
            console.error("Dashboard fetch failed:", err)
            setLoading(false)
        })
    }, [dateRange])

    useEffect(() => { fetchDashboard() }, [fetchDashboard])
    useRealtimeRefresh(fetchDashboard)

    const handleToggleTask = useCallback(async (taskId: string, currentStatus: string) => {
        const newCompleted = currentStatus !== "Completed"
        const previousTasks = tasks
        setTasks((prev) => prev.map((t) =>
            t.id === taskId ? { ...t, status: newCompleted ? "Completed" : "Pending" } : t,
        ))
        try {
            await toggleTaskComplete(taskId, newCompleted)
        } catch {
            setTasks(previousTasks)
            toast.error("Failed to update task")
        }
    }, [tasks])

    const handleDeleteTask = useCallback(async (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const previousTasks = tasks
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
        try {
            await deleteTask(taskId)
        } catch {
            setTasks(previousTasks)
            toast.error("Failed to delete task")
        }
    }, [tasks])

    const handleEditTask = useCallback((task: any, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingTask({
            id: task.id, title: task.title, dueDate: task.dueDate,
            priority: task.priority === "High" ? "HIGH" : task.priority === "Medium" ? "MEDIUM" : "LOW",
        })
        setIsTaskDialogOpen(true)
    }, [])

    const pendingTasks = useMemo(() =>
        tasks.filter((t) => t.status !== "Completed")
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
        [tasks],
    )

    const getPipelineName = useCallback((id: string) =>
        data?.pipelines.find((p) => p.id === id)?.name || "Select Pipeline",
        [data],
    )

    // ── Loading / empty ──
    if (loading) {
        return (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                    <Skeleton className="h-12 w-64" />
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                    </div>
                    <Skeleton className="h-[400px] w-full rounded-xl" />
                </div>
            </div>
        )
    }

    if (!data || data.pipelines.length === 0) {
        return (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Dashboard
                        </h2>
                    </div>
                    <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardContent className="p-0">
                            <EmptyState
                                Icon={BarChart3}
                                accent="primary"
                                title="No pipeline data yet"
                                description="Create a pipeline and add opportunities to see your dashboard analytics."
                                action={{ label: "Go to pipeline", onClick: () => router.push("/pipeline") }}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    if (isMobile) {
        return (
            <MobileDashboard
                kpi={data.kpi}
                pendingTasks={pendingTasks}
                onToggleTask={handleToggleTask}
                onRefresh={async () => { fetchDashboard() }}
                router={router}
            />
        )
    }

    // ── Desktop ──
    const PipelineDropdown = () => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground">
                    {getPipelineName(globalPipelineId)}
                    <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
                {data.pipelines.map((p) => (
                    <DropdownMenuItem key={p.id} className="text-xs" onClick={() => setGlobalPipelineId(p.id)}>
                        {p.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )

    const visibleIds = activeLayout?.items.map((it) => it.i) ?? []

    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="space-y-5 p-4 sm:p-6 lg:p-8 pb-12">
                {/* Greeting hero */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                            {getTodayLabel()}
                        </p>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent leading-tight">
                            {getGreeting()}{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {pendingTasks.length > 0
                                ? `You have ${pendingTasks.length} ${pendingTasks.length === 1 ? "task" : "tasks"} pending${data.kpi.openInquiries > 0 ? ` and ${data.kpi.openInquiries} open ${data.kpi.openInquiries === 1 ? "inquiry" : "inquiries"}` : ""}.`
                                : data.kpi.openInquiries > 0
                                    ? `${data.kpi.openInquiries} open ${data.kpi.openInquiries === 1 ? "inquiry" : "inquiries"} to review.`
                                    : "All caught up — here's how the business looks."}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {lastRefreshed && (
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                Updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        )}
                        <LayoutSwitcher
                            layouts={layouts}
                            activeLayoutId={activeLayoutId}
                            defaultLayoutId={defaultLayoutId}
                            onSwitch={switchLayout}
                            onCreate={createLayout}
                            onRename={renameLayout}
                            onDuplicate={duplicateLayout}
                            onDelete={deleteLayout}
                            onSetDefault={setLayoutAsDefault}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => setShowApplyTemplate(true)}
                            title="Apply a template"
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            Templates
                        </Button>
                        <Button
                            variant={editMode ? "default" : "outline"}
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => setEditMode((v) => !v)}
                            title={editMode ? "Exit edit mode" : "Edit dashboard"}
                        >
                            {editMode ? (<><X className="h-3.5 w-3.5" />Done</>) : (<><Pencil className="h-3.5 w-3.5" />Edit</>)}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setIsRefreshing(true); fetchDashboard() }}
                            disabled={isRefreshing}
                            title="Refresh"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        </Button>
                        <PipelineDropdown />
                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportToPDF("Dashboard Report")}
                            className="hidden lg:flex"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export PDF
                        </Button>
                    </div>
                </div>

                <FirstVisitHint
                    pageKey="dashboard"
                    text="Welcome to your dashboard. Track revenue, watch the activity feed, and find your setup checklist in the sidebar."
                />

                <Tabs defaultValue="overview" className="space-y-5">
                    <TabsList className="bg-muted/30 border border-border flex-wrap h-auto gap-0.5 p-1">
                        <TabsTrigger value="overview" className="text-xs font-semibold">Overview</TabsTrigger>
                        <TabsTrigger value="leaderboard" className="text-xs font-semibold">Leaderboard</TabsTrigger>
                    </TabsList>

                    <TabsContent value="leaderboard" className="m-0">
                        <LeaderboardTab />
                    </TabsContent>

                    <TabsContent value="overview" className="m-0 space-y-4">
                        {/* Edit-mode banner */}
                        {editMode && (
                            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                                    <span className="text-primary font-medium truncate">
                                        Edit mode — drag widgets by their handle, resize from the bottom-right corner, or use the kebab menu.
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setShowAddWidget(true)}
                                    >
                                        Add widget
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setEditMode(false)}
                                    >
                                        Done
                                    </Button>
                                </div>
                            </div>
                        )}

                        {activeLayout ? (
                            activeLayout.items.length === 0 ? (
                                <div className="rounded-xl border-2 border-dashed border-border py-16 px-6 text-center space-y-3">
                                    <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">This layout is empty</p>
                                        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                            Add widgets one at a time, or apply a template to get a curated starting layout.
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-2">
                                        <Button size="sm" onClick={() => { setEditMode(true); setShowAddWidget(true) }}>
                                            Add widget
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => setShowApplyTemplate(true)}>
                                            Pick a template
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <GridDashboard
                                    items={activeLayout.items}
                                    onChange={updateActiveLayoutItems}
                                    editMode={editMode}
                                    onAddWidget={() => setShowAddWidget(true)}
                                    data={data}
                                    pipelineId={globalPipelineId}
                                    timeframe={timeframe}
                                    setTimeframe={setTimeframe}
                                    pendingTasks={pendingTasks}
                                    onToggleTask={handleToggleTask}
                                    onEditTask={handleEditTask}
                                    onDeleteTask={handleDeleteTask}
                                    onAddTask={() => { setEditingTask(null); setIsTaskDialogOpen(true) }}
                                />
                            )
                        ) : null}
                    </TabsContent>
                </Tabs>

                <CreateTaskDialog
                    isOpen={isTaskDialogOpen}
                    onClose={() => { setIsTaskDialogOpen(false); setEditingTask(null) }}
                    onSaved={() => fetchDashboard()}
                    initialData={editingTask}
                />

                <AddWidgetDialog
                    open={showAddWidget}
                    onClose={() => setShowAddWidget(false)}
                    visibleIds={visibleIds}
                    onAdd={addWidget}
                />

                <ApplyTemplateDialog
                    open={showApplyTemplate}
                    onClose={() => setShowApplyTemplate(false)}
                    onApply={applyTemplate}
                />
            </div>
        </div>
    )
}
