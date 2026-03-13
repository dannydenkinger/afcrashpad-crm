"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    MousePointer2,
    Eye,
    Target,
    TrendingUp,
    Gauge,
    Shield,
    Search,
    Zap,
    RefreshCw,
    Loader2,
} from "lucide-react"
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from "recharts"
import type { GSCSiteMetrics, PageSpeedMetrics } from "./types"

interface SiteOverviewProps {
    gscData: GSCSiteMetrics | null
    pageSpeed: PageSpeedMetrics | null
    isLoadingGSC: boolean
    isLoadingPageSpeed: boolean
    onRefreshPageSpeed: () => void
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
    const circumference = 2 * Math.PI * 36
    const offset = circumference - (score / 100) * circumference

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                    <circle
                        cx="40"
                        cy="40"
                        r="36"
                        fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-black">{score}</span>
                </div>
            </div>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</span>
        </div>
    )
}

function getScoreColor(score: number): string {
    if (score >= 90) return "#10b981"
    if (score >= 50) return "#f59e0b"
    return "#ef4444"
}

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
}

export default function SiteOverview({
    gscData,
    pageSpeed,
    isLoadingGSC,
    isLoadingPageSpeed,
    onRefreshPageSpeed,
}: SiteOverviewProps) {
    const chartData = gscData?.dailyData.map((d) => ({
        date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        clicks: d.clicks,
        impressions: d.impressions,
    })) || []

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Clicks</CardTitle>
                        <MousePointer2 className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoadingGSC ? "..." : gscData ? formatNumber(gscData.totalClicks) : "---"}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Google Search clicks (28d)</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Impressions</CardTitle>
                        <Eye className="h-4 w-4 text-blue-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoadingGSC ? "..." : gscData ? formatNumber(gscData.totalImpressions) : "---"}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Search result appearances</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg CTR</CardTitle>
                        <Target className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoadingGSC ? "..." : gscData ? `${(gscData.avgCTR * 100).toFixed(1)}%` : "---"}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Click-through rate</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Position</CardTitle>
                        <TrendingUp className="h-4 w-4 text-amber-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoadingGSC ? "..." : gscData ? gscData.avgPosition.toFixed(1) : "---"}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Average search position</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-7">
                {/* Search Performance Chart */}
                <Card className="lg:col-span-4 border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold">Search Performance</CardTitle>
                                <CardDescription className="text-xs">Clicks & impressions from Google Search Console</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">GSC</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {isLoadingGSC ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: "#666" }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        yAxisId="clicks"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: "#666" }}
                                    />
                                    <YAxis
                                        yAxisId="impressions"
                                        orientation="right"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: "#666" }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#18181b",
                                            border: "none",
                                            borderRadius: "8px",
                                            color: "#fff",
                                            fontSize: "11px",
                                        }}
                                    />
                                    <Area
                                        yAxisId="clicks"
                                        type="monotone"
                                        dataKey="clicks"
                                        stroke="#3b82f6"
                                        fillOpacity={1}
                                        fill="url(#colorClicks)"
                                        strokeWidth={2}
                                    />
                                    <Area
                                        yAxisId="impressions"
                                        type="monotone"
                                        dataKey="impressions"
                                        stroke="#8b5cf6"
                                        fillOpacity={1}
                                        fill="url(#colorImpressions)"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                <Search className="h-8 w-8 mb-2 opacity-30" />
                                <p className="text-xs">Connect Google Search Console to see data</p>
                                <p className="text-[10px] mt-1">Add GSC_SITE_URL to your environment</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* PageSpeed Scores */}
                <Card className="lg:col-span-3 border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold">Core Web Vitals</CardTitle>
                                <CardDescription className="text-xs">PageSpeed Insights for your site</CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px]"
                                onClick={onRefreshPageSpeed}
                                disabled={isLoadingPageSpeed}
                            >
                                {isLoadingPageSpeed ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-3 w-3" />
                                )}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingPageSpeed ? (
                            <div className="h-[200px] flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : pageSpeed ? (
                            <div className="space-y-6">
                                {/* Score Rings */}
                                <div className="flex justify-around">
                                    <ScoreRing score={pageSpeed.performanceScore} label="Performance" color={getScoreColor(pageSpeed.performanceScore)} />
                                    <ScoreRing score={pageSpeed.seoScore} label="SEO" color={getScoreColor(pageSpeed.seoScore)} />
                                    <ScoreRing score={pageSpeed.accessibilityScore} label="A11y" color={getScoreColor(pageSpeed.accessibilityScore)} />
                                </div>

                                {/* Core Web Vitals */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-background/30 border border-white/5">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Zap className="h-3 w-3 text-emerald-500" />
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase">LCP</span>
                                        </div>
                                        <span className="text-sm font-bold">{(pageSpeed.lcp / 1000).toFixed(1)}s</span>
                                    </div>
                                    <div className="p-3 rounded-lg bg-background/30 border border-white/5">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Gauge className="h-3 w-3 text-blue-500" />
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase">FCP</span>
                                        </div>
                                        <span className="text-sm font-bold">{(pageSpeed.fcp / 1000).toFixed(1)}s</span>
                                    </div>
                                    <div className="p-3 rounded-lg bg-background/30 border border-white/5">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Shield className="h-3 w-3 text-amber-500" />
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase">CLS</span>
                                        </div>
                                        <span className="text-sm font-bold">{pageSpeed.cls.toFixed(3)}</span>
                                    </div>
                                    <div className="p-3 rounded-lg bg-background/30 border border-white/5">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Zap className="h-3 w-3 text-purple-500" />
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase">TBT</span>
                                        </div>
                                        <span className="text-sm font-bold">{Math.round(pageSpeed.tbt)}ms</span>
                                    </div>
                                </div>

                                {pageSpeed.fetchedAt && (
                                    <p className="text-[9px] text-muted-foreground text-center">
                                        Last checked: {new Date(pageSpeed.fetchedAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                                <Gauge className="h-8 w-8 mb-2 opacity-30" />
                                <p className="text-xs">Click refresh to run PageSpeed audit</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Top GSC Queries */}
            {gscData && gscData.topQueries.length > 0 && (
                <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold">Top Search Queries</CardTitle>
                                <CardDescription className="text-xs">Your best-performing keywords from Google Search Console</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">GSC</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                        <div className="min-w-[600px] space-y-1">
                            {/* Header */}
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                <div className="col-span-5">Query</div>
                                <div className="col-span-2 text-right">Clicks</div>
                                <div className="col-span-2 text-right">Impressions</div>
                                <div className="col-span-1 text-right">CTR</div>
                                <div className="col-span-2 text-right">Avg Position</div>
                            </div>
                            {gscData.topQueries.slice(0, 15).map((q, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/10 transition-colors items-center"
                                >
                                    <div className="col-span-5 flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                                        <span className="text-xs font-medium truncate">{q.query}</span>
                                    </div>
                                    <div className="col-span-2 text-right text-xs font-bold">{q.clicks.toLocaleString()}</div>
                                    <div className="col-span-2 text-right text-xs text-muted-foreground">{q.impressions.toLocaleString()}</div>
                                    <div className="col-span-1 text-right text-xs text-muted-foreground">{(q.ctr * 100).toFixed(1)}%</div>
                                    <div className="col-span-2 text-right">
                                        <Badge
                                            variant="secondary"
                                            className={`text-[10px] font-bold h-5 px-1.5 ${
                                                q.position <= 3
                                                    ? "bg-emerald-500/10 text-emerald-500"
                                                    : q.position <= 10
                                                    ? "bg-blue-500/10 text-blue-500"
                                                    : q.position <= 20
                                                    ? "bg-amber-500/10 text-amber-500"
                                                    : "bg-muted"
                                            }`}
                                        >
                                            {q.position.toFixed(1)}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
