"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Users,
    MousePointer2,
    Globe,
    Activity,
    Calendar,
    ChevronDown,
    BarChart3,
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
} from 'recharts'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchMarketingData } from "./actions"

interface GATrafficRow {
    date: string;
    users: number;
    conversions: number;
}

interface GATrafficSource {
    source: string;
    value: number;
}

const SOURCE_COLORS: Record<string, string> = {
    "google": "#3b82f6",
    "Organic Search": "#3b82f6",
    "(direct)": "#10b981",
    "Direct": "#10b981",
    "direct": "#10b981",
    "facebook": "#8b5cf6",
    "Organic Social": "#8b5cf6",
    "instagram": "#8b5cf6",
    "bing": "#f97316",
    "Referral": "#f59e0b",
    "referral": "#f59e0b",
    "Paid Search": "#ef4444",
    "Email": "#06b6d4",
}

function getSourceColor(source: string, index: number): string {
    if (SOURCE_COLORS[source]) return SOURCE_COLORS[source]
    const fallbacks = ["#6366f1", "#ec4899", "#14b8a6", "#a855f7", "#f43f5e"]
    return fallbacks[index % fallbacks.length]
}

function formatSourceName(source: string): string {
    if (source === "(direct)") return "Direct"
    if (source === "(not set)") return "Other"
    return source.charAt(0).toUpperCase() + source.slice(1)
}

export default function AnalyticsDashboard() {
    const [timeframe, setTimeframe] = useState("Last 7 Days")
    const [traffic, setTraffic] = useState<{ name: string; active: number; conversions: number }[]>([])
    const [sources, setSources] = useState<GATrafficSource[]>([])
    const [kpis, setKpis] = useState<{
        totalUsers: number;
        avgSessionDuration: number;
        totalSessions: number;
        totalConversions: number;
        organicPercentage: number;
    } | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const loadGA4Data = async () => {
            setIsLoading(true)
            const days = timeframe === "Last 30 Days" ? 30 : timeframe === "Last 7 Days" ? 7 : 1
            const result = await fetchMarketingData(days)

            if (result.traffic && result.traffic.length > 0) {
                const formattedTraffic = (result.traffic as GATrafficRow[])
                    .filter((row: GATrafficRow) => row.date)
                    .map((row: GATrafficRow) => {
                        const dateStr = row.date;
                        const year = parseInt(dateStr.substring(0, 4));
                        const month = parseInt(dateStr.substring(4, 6)) - 1;
                        const day = parseInt(dateStr.substring(6, 8));
                        const date = new Date(year, month, day);

                        return {
                            name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            active: row.users,
                            conversions: row.conversions
                        }
                    })
                setTraffic(formattedTraffic)
            }

            if (result.sources) {
                const sortedSources = (result.sources as GATrafficSource[])
                    .sort((a, b) => b.value - a.value);
                setSources(sortedSources)
            }

            if (result.kpis) {
                setKpis(result.kpis)
            }
            setIsLoading(false)
        }

        loadGA4Data()
    }, [timeframe])

    const totalSessions = sources.reduce((sum, s) => sum + s.value, 0)
    const maxSourceValue = sources.length > 0 ? sources[0].value : 1

    const pieData = sources.slice(0, 6).map((s, i) => ({
        name: formatSourceName(s.source),
        value: s.value,
        color: getSourceColor(s.source, i),
    }))

    return (
        <div className="relative">
            {isLoading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-xs font-semibold text-muted-foreground">Loading traffic data...</p>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 gap-2">
                            <Calendar className="h-4 w-4" />
                            {timeframe}
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setTimeframe("Last 24 Hours")}>Last 24 Hours</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTimeframe("Last 7 Days")}>Last 7 Days</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTimeframe("Last 30 Days")}>Last 30 Days</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Badge variant="outline" className="text-[10px] h-7 px-2">
                    afcrashpad.com
                </Badge>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Visitors</CardTitle>
                        <Users className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis ? kpis.totalUsers.toLocaleString() : "---"}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Unique users</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Sessions</CardTitle>
                        <BarChart3 className="h-4 w-4 text-blue-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis ? kpis.totalSessions.toLocaleString() : "---"}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">All page visits</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg. Session Duration</CardTitle>
                        <Activity className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {kpis ? `${Math.floor(kpis.avgSessionDuration / 60)}m ${Math.floor(kpis.avgSessionDuration % 60)}s` : "---"}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Engagement quality</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversions</CardTitle>
                        <MousePointer2 className="h-4 w-4 text-rose-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis ? kpis.totalConversions.toLocaleString() : "---"}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Goal completions</p>
                    </CardContent>
                </Card>
            </div>

            {/* Traffic Trend Chart */}
            <Card className="border-none shadow-md bg-card/40 backdrop-blur-md mb-6">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold">Traffic Analytics</CardTitle>
                            <CardDescription className="text-xs">Daily active visitors and conversions</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                <span className="text-[10px] text-muted-foreground font-medium">Visitors</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] text-muted-foreground font-medium">Conversions</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">GA4</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="h-[250px] sm:h-[300px] px-2 sm:px-6">
                    {traffic.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={traffic} margin={{ left: -15, right: 5 }}>
                                <defs>
                                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.08} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#666' }}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#666' }}
                                    width={35}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="active"
                                    stroke="#3b82f6"
                                    fillOpacity={1}
                                    fill="url(#colorActive)"
                                    strokeWidth={2}
                                    name="Visitors"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="conversions"
                                    stroke="#10b981"
                                    fillOpacity={1}
                                    fill="url(#colorConversions)"
                                    strokeWidth={2}
                                    name="Conversions"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                            <Activity className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-xs">Loading traffic data...</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Traffic Sources — Donut + Breakdown */}
            <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold">Traffic Sources</CardTitle>
                            <CardDescription className="text-xs">
                                {totalSessions > 0
                                    ? `${totalSessions.toLocaleString()} total sessions · ${kpis ? `${kpis.organicPercentage.toFixed(0)}% organic` : ""}`
                                    : "Session breakdown by source"
                                }
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">GA4</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {sources.length > 0 ? (
                        <div className="flex flex-col lg:flex-row gap-8 items-center">
                            {/* Donut Chart */}
                            <div className="w-[200px] h-[200px] shrink-0 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={85}
                                            paddingAngle={3}
                                            dataKey="value"
                                            stroke="none"
                                            animationDuration={1200}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={index} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                                            formatter={(value: number | undefined) => [`${(value ?? 0).toLocaleString()} sessions`, ""]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-2xl font-black">{totalSessions.toLocaleString()}</span>
                                    <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Sessions</span>
                                </div>
                            </div>

                            {/* Source Breakdown Bars */}
                            <div className="flex-1 w-full space-y-3">
                                {sources.slice(0, 6).map((source, i) => {
                                    const color = getSourceColor(source.source, i)
                                    const pct = totalSessions > 0 ? (source.value / totalSessions) * 100 : 0
                                    const barWidth = (source.value / maxSourceValue) * 100

                                    return (
                                        <div key={i} className="group">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                    <span className="text-xs font-semibold">
                                                        {formatSourceName(source.source)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold">{source.value.toLocaleString()}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium w-10 text-right">
                                                        {pct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 flex flex-col items-center justify-center text-muted-foreground">
                            <Globe className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-xs">Loading traffic sources...</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
