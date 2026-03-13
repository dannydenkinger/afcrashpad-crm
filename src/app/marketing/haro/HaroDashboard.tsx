"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
    Mail,
    Settings2,
    Send,
    CheckCircle2,
    XCircle,
    Clock,
    Link2,
    TrendingUp,
    Loader2,
    Eye,
    Globe,
    Award,
    Target,
    BarChart3,
    FileText,
    MoreVertical,
    ExternalLink,
    Trash2,
    RefreshCw,
    ChevronDown,
    AlertTriangle,
} from "lucide-react"
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts"
import type { HaroSettings, HaroBatch, HaroQuery, HaroMetrics, HaroQueryStatus } from "./types"
import {
    getHaroSettings,
    getHaroBatches,
    getHaroQueries,
    getHaroMetrics,
    triggerHaroFetch,
    triggerProcessSingleEmail,
    updateHaroQuery,
    sendHaroResponse,
    markPlacement,
    deleteHaroBatch,
} from "./actions"
import { HaroSettings as HaroSettingsPanel } from "./HaroSettings"

type View = "dashboard" | "settings" | "batch"

const STATUS_CONFIG: Record<HaroQueryStatus, { label: string; color: string; icon: typeof Clock }> = {
    pending: { label: "Pending", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock },
    reviewing: { label: "Reviewing", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Eye },
    approved: { label: "Approved", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
    sent: { label: "Sent", color: "bg-primary/10 text-primary border-primary/20", icon: Send },
    placed: { label: "Placed", color: "bg-green-500/10 text-green-700 border-green-500/20", icon: Award },
    declined: { label: "Skipped", color: "bg-muted text-muted-foreground border-muted", icon: XCircle },
    expired: { label: "Expired", color: "bg-rose-500/10 text-rose-600 border-rose-500/20", icon: Clock },
}

function getDeadlineUrgency(query: HaroQuery): { label: string; color: string; hoursLeft: number } | null {
    const deadline = query.deadlineParsed
    if (!deadline) return null
    const now = Date.now()
    const ms = new Date(deadline).getTime() - now
    if (ms < 0) return { label: "EXPIRED", color: "bg-rose-600 text-white", hoursLeft: 0 }
    const hours = ms / (1000 * 60 * 60)
    if (hours <= 2) return { label: "URGENT", color: "bg-rose-600 text-white", hoursLeft: hours }
    if (hours <= 6) return { label: "EXPIRING", color: "bg-amber-500 text-white", hoursLeft: hours }
    return null
}

export function HaroDashboard() {
    const [view, setView] = useState<View>("dashboard")
    const [loading, setLoading] = useState(true)
    const [settings, setSettings] = useState<HaroSettings | null>(null)
    const [metrics, setMetrics] = useState<HaroMetrics | null>(null)
    const [batches, setBatches] = useState<HaroBatch[]>([])
    const [queries, setQueries] = useState<HaroQuery[]>([])
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)

    // Gmail fetch + processing progress
    const [fetching, setFetching] = useState(false)
    const [fetchResult, setFetchResult] = useState<any>(null)
    const [processing, setProcessing] = useState(false)
    const [processProgress, setProcessProgress] = useState({ current: 0, total: 0, currentSubject: "" })

    // Query detail dialog
    const [selectedQuery, setSelectedQuery] = useState<HaroQuery | null>(null)
    const [editedResponse, setEditedResponse] = useState("")
    const [sendingResponse, setSendingResponse] = useState(false)

    // Placement dialog
    const [showPlacementDialog, setShowPlacementDialog] = useState(false)
    const [placementQueryId, setPlacementQueryId] = useState("")
    const [placementUrl, setPlacementUrl] = useState("")
    const [placementDA, setPlacementDA] = useState("")

    // Delete confirmation
    const [deleteBatchId, setDeleteBatchId] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        try {
            const [s, m, b, q] = await Promise.all([
                getHaroSettings(),
                getHaroMetrics(),
                getHaroBatches(),
                getHaroQueries({ isRelevant: true, limit: 100 }),
            ])
            setSettings(s)
            setMetrics(m)
            setBatches(b)
            setQueries(q)
        } catch (err) {
            console.error("Failed to fetch HARO data:", err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const handleFetchEmails = async () => {
        setFetching(true)
        setFetchResult(null)
        setProcessing(false)
        try {
            // Step 1: Quick fetch — just get email list from Gmail
            const result = await triggerHaroFetch()

            if (!result.emails || result.emails.length === 0) {
                setFetchResult({ success: true, message: result.message })
                setFetching(false)
                return
            }

            // Step 2: Process each email one by one with progress
            setFetching(false)
            setProcessing(true)
            const emails = result.emails
            setProcessProgress({ current: 0, total: emails.length, currentSubject: "" })

            for (let i = 0; i < emails.length; i++) {
                setProcessProgress({ current: i + 1, total: emails.length, currentSubject: emails[i].subject })
                await triggerProcessSingleEmail(emails[i].id)
            }

            setFetchResult({ success: true, message: `Processed ${emails.length} HARO email(s)` })
            setProcessing(false)
            fetchData()
        } catch (err: any) {
            setFetchResult({ success: false, message: err.message })
            setFetching(false)
            setProcessing(false)
        }
    }

    const handleSendResponse = async (queryId: string) => {
        setSendingResponse(true)
        try {
            const q = queries.find(q => q.id === queryId)
            if (editedResponse && q) {
                await updateHaroQuery(queryId, { editedResponse })
            }
            const result = await sendHaroResponse(queryId)
            if (result.success) {
                fetchData()
                setSelectedQuery(null)
            }
        } catch (err) {
            console.error("Failed to send:", err)
        } finally {
            setSendingResponse(false)
        }
    }

    const handleMarkPlacement = async () => {
        if (!placementQueryId || !placementUrl) return
        await markPlacement(placementQueryId, placementUrl, parseInt(placementDA) || 0)
        setShowPlacementDialog(false)
        setPlacementUrl("")
        setPlacementDA("")
        fetchData()
    }

    const handleDeleteBatch = async () => {
        if (!deleteBatchId) return
        await deleteHaroBatch(deleteBatchId)
        setDeleteBatchId(null)
        fetchData()
    }

    const filteredQueries = queries
        .filter(q => {
            if (selectedBatchId && q.batchId !== selectedBatchId) return false
            if (statusFilter === "all") return true
            return q.status === statusFilter
        })
        .sort((a, b) => {
            // Sort by deadline urgency (soonest first), then relevance score
            const aDeadline = a.deadlineParsed ? new Date(a.deadlineParsed).getTime() : Infinity
            const bDeadline = b.deadlineParsed ? new Date(b.deadlineParsed).getTime() : Infinity
            if (aDeadline !== bDeadline) return aDeadline - bDeadline
            return b.relevanceScore - a.relevanceScore
        })

    if (view === "settings") {
        return (
            <HaroSettingsPanel
                settings={settings}
                onBack={() => { setView("dashboard"); fetchData() }}
                onSaved={() => { setView("dashboard"); fetchData() }}
            />
        )
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
                <Skeleton className="h-64 rounded-xl" />
            </div>
        )
    }

    const formatCurrency = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Mail className="h-5 w-5 text-primary" />
                        HARO Automation
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Automated journalist outreach for backlinks & authority building
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {fetchResult && !processing && (
                        <span className={`text-xs ${fetchResult.success ? "text-emerald-600" : "text-rose-600"}`}>
                            {fetchResult.message || "Fetch failed"}
                        </span>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setView("settings")}>
                        <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                        Settings
                    </Button>
                    <Button size="sm" onClick={handleFetchEmails} disabled={fetching || processing}>
                        {fetching ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                Checking Gmail...
                            </>
                        ) : processing ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                Processing {processProgress.current}/{processProgress.total}
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                Fetch Emails
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Processing Progress Banner */}
            {processing && (
                <Card className="border-none shadow-md bg-primary/5 backdrop-blur-md">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">
                                    Processing email {processProgress.current} of {processProgress.total}
                                </p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {processProgress.currentSubject || "Parsing queries & generating responses..."}
                                </p>
                                <div className="w-full bg-muted/30 rounded-full h-1.5 mt-2">
                                    <div
                                        className="bg-primary h-1.5 rounded-full transition-all duration-500"
                                        style={{ width: `${processProgress.total > 0 ? (processProgress.current / processProgress.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Metrics Cards */}
            {metrics && (
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Queries Received</span>
                                <FileText className="h-3.5 w-3.5 text-muted-foreground/50" />
                            </div>
                            <div className="text-2xl font-bold">{metrics.totalQueriesReceived}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{metrics.totalBatches} batches processed</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Relevant Matches</span>
                                <Target className="h-3.5 w-3.5 text-amber-500/50" />
                            </div>
                            <div className="text-2xl font-bold">{metrics.totalRelevantMatches}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {metrics.totalQueriesReceived > 0
                                    ? `${Math.round((metrics.totalRelevantMatches / metrics.totalQueriesReceived) * 100)}% match rate`
                                    : "No data yet"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responses Sent</span>
                                <Send className="h-3.5 w-3.5 text-primary/50" />
                            </div>
                            <div className="text-2xl font-bold">{metrics.totalResponsesSent}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{metrics.avgResponseRate}% response rate</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Placements</span>
                                <Award className="h-3.5 w-3.5 text-emerald-500/50" />
                            </div>
                            <div className="text-2xl font-bold">{metrics.totalPlacementsConfirmed}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {metrics.totalResponsesSent > 0
                                    ? `${Math.round((metrics.totalPlacementsConfirmed / metrics.totalResponsesSent) * 100)}% placement rate`
                                    : "No data yet"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Backlinks</span>
                                <Link2 className="h-3.5 w-3.5 text-blue-500/50" />
                            </div>
                            <div className="text-2xl font-bold">{metrics.totalBacklinksEarned}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Confirmed links</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Avg Domain Authority</span>
                                <Globe className="h-3.5 w-3.5 text-purple-500/50" />
                            </div>
                            <div className="text-2xl font-bold">{metrics.avgDomainAuthority || "—"}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Of linking domains</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Est. SEO Value</span>
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-500/50" />
                            </div>
                            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(metrics.estimatedTotalSeoValue)}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Based on DA of placements</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Response Rate</span>
                                <BarChart3 className="h-3.5 w-3.5 text-primary/50" />
                            </div>
                            <div className="text-2xl font-bold">{metrics.avgResponseRate}%</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Of relevant queries</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Weekly Activity Chart */}
            {metrics && metrics.weeklyData.some(w => w.queries > 0) && (
                <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-semibold">Weekly Activity</CardTitle>
                        <CardDescription className="text-xs">Query volume & response funnel</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={metrics.weeklyData}>
                                    <defs>
                                        <linearGradient id="haroQueries" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="haroSent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#666' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#666' }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                                    <Area type="monotone" dataKey="queries" name="Queries" stroke="#8b5cf6" strokeWidth={2} fill="url(#haroQueries)" />
                                    <Area type="monotone" dataKey="sent" name="Sent" stroke="#10b981" strokeWidth={2} fill="url(#haroSent)" />
                                    <Area type="monotone" dataKey="placed" name="Placed" stroke="#f59e0b" strokeWidth={2} fillOpacity={0} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Recent Batches */}
                <Card className="lg:col-span-1 border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="p-4 pb-3">
                        <CardTitle className="text-sm font-semibold">Recent Batches</CardTitle>
                        <CardDescription className="text-xs">Processed HARO emails</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-hide">
                            {batches.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-8">No batches yet. Process your first HARO email to get started.</p>
                            ) : batches.map(batch => (
                                <div
                                    key={batch.id}
                                    className={`p-3 rounded-lg transition-colors cursor-pointer group ${selectedBatchId === batch.id ? "bg-primary/10 ring-1 ring-primary/20" : "bg-muted/20 hover:bg-muted/30"}`}
                                    onClick={() => setSelectedBatchId(selectedBatchId === batch.id ? null : batch.id)}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold truncate">{batch.emailSubject}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {new Date(batch.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                            </p>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                                                    <MoreVertical className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem className="text-xs text-destructive" onClick={() => setDeleteBatchId(batch.id)}>
                                                    <Trash2 className="h-3 w-3 mr-2" />Delete Batch
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="flex items-center gap-3 mt-2">
                                        <Badge variant="outline" className="text-[9px] h-5">{batch.totalQueries} queries</Badge>
                                        <Badge variant="outline" className="text-[9px] h-5 text-amber-600">{batch.relevantQueries} relevant</Badge>
                                        <Badge variant="outline" className="text-[9px] h-5 text-emerald-600">{batch.responsesSent} sent</Badge>
                                    </div>
                                    {batch.status === "error" && (
                                        <p className="text-[10px] text-rose-500 mt-1">{batch.errorMessage}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Query Queue */}
                <Card className="lg:col-span-2 border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="p-4 pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-semibold">
                                    {selectedBatchId ? "Batch Queries" : "All Relevant Queries"}
                                </CardTitle>
                                <CardDescription className="text-xs">{filteredQueries.length} queries</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedBatchId && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedBatchId(null)}>
                                        Clear Filter
                                    </Button>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-7 text-xs">
                                            {statusFilter === "all" ? "All Status" : STATUS_CONFIG[statusFilter as HaroQueryStatus]?.label || statusFilter}
                                            <ChevronDown className="h-3 w-3 ml-1" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem className="text-xs" onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {(Object.entries(STATUS_CONFIG) as [HaroQueryStatus, typeof STATUS_CONFIG[HaroQueryStatus]][]).map(([key, config]) => (
                                            <DropdownMenuItem key={key} className="text-xs" onClick={() => setStatusFilter(key)}>
                                                {config.label}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-hide">
                            {filteredQueries.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-8">No queries match the current filter.</p>
                            ) : filteredQueries.map(query => {
                                const statusCfg = STATUS_CONFIG[query.status]
                                const StatusIcon = statusCfg.icon
                                const urgency = getDeadlineUrgency(query)
                                return (
                                    <div
                                        key={query.id}
                                        className={`p-3 rounded-lg transition-colors cursor-pointer group ${urgency && urgency.hoursLeft <= 2 && urgency.hoursLeft > 0 ? "bg-rose-500/5 hover:bg-rose-500/10 ring-1 ring-rose-500/20" : "bg-muted/20 hover:bg-muted/30"}`}
                                        onClick={() => {
                                            setSelectedQuery(query)
                                            setEditedResponse(query.editedResponse || query.aiResponse)
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-semibold leading-tight">{query.title}</p>
                                                    {urgency && (
                                                        <Badge className={`text-[8px] h-4 px-1.5 ${urgency.color} border-none`}>
                                                            <AlertTriangle className="h-2 w-2 mr-0.5" />
                                                            {urgency.label}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    {query.mediaOutlet && (
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            <Globe className="h-2.5 w-2.5" />{query.mediaOutlet}
                                                        </span>
                                                    )}
                                                    {query.reporterName && (
                                                        <span className="text-[10px] text-muted-foreground">{query.reporterName}</span>
                                                    )}
                                                    {query.deadline && (
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            <Clock className="h-2.5 w-2.5" />{query.deadline}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Badge variant="outline" className={`text-[9px] h-5 ${statusCfg.color}`}>
                                                    <StatusIcon className="h-2.5 w-2.5 mr-1" />
                                                    {statusCfg.label}
                                                </Badge>
                                                <Badge variant="outline" className="text-[9px] h-5">
                                                    {query.relevanceScore}%
                                                </Badge>
                                            </div>
                                        </div>
                                        {query.relevanceReason && (
                                            <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-1">{query.relevanceReason}</p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Query Detail Dialog */}
            <Dialog open={!!selectedQuery} onOpenChange={open => !open && setSelectedQuery(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    {selectedQuery && (() => {
                        const statusCfg = STATUS_CONFIG[selectedQuery.status]
                        const dialogUrgency = getDeadlineUrgency(selectedQuery)
                        return (
                            <>
                                <DialogHeader>
                                    <div className="flex items-start justify-between gap-3">
                                        <DialogTitle className="text-base leading-tight pr-4">{selectedQuery.title}</DialogTitle>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {dialogUrgency && (
                                                <Badge className={`text-[9px] h-5 ${dialogUrgency.color} border-none`}>
                                                    <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                                                    {dialogUrgency.hoursLeft > 0 ? `${Math.round(dialogUrgency.hoursLeft * 60)}m left` : "EXPIRED"}
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className={`text-[10px] h-5 ${statusCfg.color}`}>{statusCfg.label}</Badge>
                                        </div>
                                    </div>
                                    <DialogDescription className="text-xs">
                                        {[selectedQuery.mediaOutlet, selectedQuery.reporterName, selectedQuery.deadline && `Deadline: ${selectedQuery.deadline}`].filter(Boolean).join(" · ")}
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4">
                                    {/* Query Details */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Query Details</label>
                                        <div className="p-3 rounded-lg bg-muted/20 text-xs whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                                            {selectedQuery.description}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs">
                                        <div>
                                            <span className="text-muted-foreground">Relevance: </span>
                                            <span className="font-bold">{selectedQuery.relevanceScore}%</span>
                                        </div>
                                        {selectedQuery.reporterEmail && (
                                            <div>
                                                <span className="text-muted-foreground">Email: </span>
                                                <span className="font-medium">{selectedQuery.reporterEmail}</span>
                                            </div>
                                        )}
                                        {selectedQuery.relevanceReason && (
                                            <div className="flex-1">
                                                <span className="text-muted-foreground">Reason: </span>
                                                <span>{selectedQuery.relevanceReason}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* AI Response (editable) */}
                                    {(selectedQuery.aiResponse || selectedQuery.editedResponse) && (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response</label>
                                            <Textarea
                                                value={editedResponse}
                                                onChange={e => setEditedResponse(e.target.value)}
                                                className="min-h-[250px] text-sm"
                                            />
                                        </div>
                                    )}

                                    {/* Placement info */}
                                    {selectedQuery.placementConfirmed && (
                                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                            <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                                                <Award className="h-3.5 w-3.5" /> Placement Confirmed
                                            </p>
                                            {selectedQuery.placementUrl && (
                                                <a href={selectedQuery.placementUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-1">
                                                    {selectedQuery.placementUrl} <ExternalLink className="h-3 w-3" />
                                                </a>
                                            )}
                                            {selectedQuery.placementDomainAuthority > 0 && (
                                                <p className="text-[10px] text-muted-foreground mt-1">DA: {selectedQuery.placementDomainAuthority} · Est. Value: ${selectedQuery.estimatedSeoValue}</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <DialogFooter className="flex-wrap gap-2">
                                    {selectedQuery.status !== "placed" && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setPlacementQueryId(selectedQuery.id)
                                                setShowPlacementDialog(true)
                                            }}
                                        >
                                            <Award className="h-3.5 w-3.5 mr-1.5" />
                                            Mark Placement
                                        </Button>
                                    )}
                                    {selectedQuery.status === "reviewing" && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={async () => {
                                                await updateHaroQuery(selectedQuery.id, { status: "declined" })
                                                setSelectedQuery(null)
                                                fetchData()
                                            }}
                                        >
                                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                            Skip
                                        </Button>
                                    )}
                                    {(selectedQuery.status === "reviewing" || selectedQuery.status === "approved" || selectedQuery.status === "pending") && selectedQuery.reporterEmail && (
                                        <Button
                                            size="sm"
                                            onClick={() => handleSendResponse(selectedQuery.id)}
                                            disabled={sendingResponse}
                                        >
                                            {sendingResponse ? (
                                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                            ) : (
                                                <Send className="h-3.5 w-3.5 mr-1.5" />
                                            )}
                                            {editedResponse !== (selectedQuery.editedResponse || selectedQuery.aiResponse) ? "Save & Send" : "Send Response"}
                                        </Button>
                                    )}
                                    {!selectedQuery.reporterEmail && (selectedQuery.status === "reviewing" || selectedQuery.status === "approved") && (
                                        <p className="text-[10px] text-rose-500">No reporter email found — cannot send automatically</p>
                                    )}
                                </DialogFooter>
                            </>
                        )
                    })()}
                </DialogContent>
            </Dialog>

            {/* Placement Dialog */}
            <Dialog open={showPlacementDialog} onOpenChange={setShowPlacementDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">Confirm Placement</DialogTitle>
                        <DialogDescription className="text-xs">Record the article URL and domain authority for this placement.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium">Article URL</label>
                            <Input
                                value={placementUrl}
                                onChange={e => setPlacementUrl(e.target.value)}
                                placeholder="https://example.com/article-with-your-quote"
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium">Domain Authority (0-100)</label>
                            <Input
                                type="number"
                                value={placementDA}
                                onChange={e => setPlacementDA(e.target.value)}
                                placeholder="e.g. 72"
                                className="h-9 text-sm"
                                min={0}
                                max={100}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPlacementDialog(false)}>Cancel</Button>
                        <Button onClick={handleMarkPlacement} disabled={!placementUrl}>
                            <Award className="h-3.5 w-3.5 mr-1.5" />
                            Confirm Placement
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Batch Confirmation */}
            <AlertDialog open={!!deleteBatchId} onOpenChange={open => !open && setDeleteBatchId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete this batch and all its queries. This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteBatch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
