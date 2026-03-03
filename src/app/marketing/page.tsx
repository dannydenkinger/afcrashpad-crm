"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Users,
    MousePointer2,
    Globe,
    Link2,
    Search,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    BarChart3,
    Calendar,
    ChevronDown
} from "lucide-react"
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    Cell
} from 'recharts'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEffect } from "react"
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

// Fallback Mock Data
const mockTrafficData = [
    { name: 'Mon', active: 120, conversions: 12 },
    { name: 'Tue', active: 150, conversions: 18 },
    { name: 'Wed', active: 180, conversions: 15 },
    { name: 'Thu', active: 220, conversions: 25 },
    { name: 'Fri', active: 200, conversions: 22 },
    { name: 'Sat', active: 140, conversions: 10 },
    { name: 'Sun', active: 110, conversions: 8 },
]

const mockKeywordData = [
    { keyword: 'Air Force Crashpad', volume: '12.4K', position: 1, change: 0 },
    { keyword: 'Altus AFB Housing', volume: '8.2K', position: 2, change: 1 },
    { keyword: 'Vance AFB PIT Pad', volume: '5.1K', position: 3, change: -1 },
    { keyword: 'Military PIT Pad', volume: '4.5K', position: 5, change: 2 },
    { keyword: 'Lackland AFB rentals', volume: '3.8K', position: 4, change: 0 },
]

const mockDomainRatingData = [
    { month: 'Sep', dr: 32 },
    { month: 'Oct', dr: 34 },
    { month: 'Nov', dr: 35 },
    { month: 'Dec', dr: 38 },
    { month: 'Jan', dr: 40 },
    { month: 'Feb', dr: 42 },
]

export default function MarketingPage() {
    const [timeframe, setTimeframe] = useState("Last 7 Days")
    const [traffic, setTraffic] = useState<{ name: string; active: number; conversions: number }[]>(mockTrafficData)
    const [sources, setSources] = useState<GATrafficSource[]>([])
    const [kpis, setKpis] = useState<{
        totalUsers: number;
        avgSessionDuration: number;
        totalSessions: number;
        totalConversions: number;
        organicPercentage: number;
    } | null>(null)
    const [isLoading, setIsLoading] = useState(false)

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
                            name: date.toLocaleDateString('en-US', { weekday: 'short' }),
                            active: row.users,
                            conversions: row.conversions
                        }
                    })
                setTraffic(formattedTraffic)
            }

            if (result.sources) {
                // Sort by value descending and take top 5 for the chart
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

    return (
        <div className="flex-1 min-h-0 overflow-y-auto relative">
            <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8">
            {isLoading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-xs font-semibold text-muted-foreground">Updating analytics...</p>
                    </div>
                </div>
            )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Marketing & Analytics
                        </h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Monitor traffic, SEO performance, and lead sources.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
                    <Button size="sm" className="h-9 gap-2">
                        <Activity className="h-4 w-4" />
                        Run SEO Audit
                    </Button>
                </div>
            </div>

            {/* Quick Metrics Row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Visitors</CardTitle>
                        <Users className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis ? kpis.totalUsers.toLocaleString() : "---"}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Real-time unique users</p>
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
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organic Search Traffic</CardTitle>
                        <Globe className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis ? `${kpis.organicPercentage.toFixed(1)}%` : "---"}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Search visibility score</p>
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

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Traffic Trend (Google Analytics) */}
                <Card className="col-span-4 border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold">Traffic Analytics</CardTitle>
                                <CardDescription className="text-xs">Daily active visitors and conversions</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">Google Analytics 4</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={traffic}>
                                <defs>
                                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#666' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#666' }}
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
                                    strokeWidth={3}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="conversions"
                                    stroke="#10b981"
                                    fill="transparent"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Ahrefs SEO Overview */}
                <Card className="col-span-3 border-none shadow-md bg-card/40 backdrop-blur-md overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4">
                        <Badge className="bg-[#fd6e34] hover:bg-[#fd6e34]/80 text-white font-bold border-none">ahrefs v3</Badge>
                    </div>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">SEO Health</CardTitle>
                        <CardDescription className="text-xs">Search engine performance tracking</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-4 rounded-xl bg-background/30 border border-white/5">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Domain Rating</p>
                                <div className="flex items-end gap-2 mt-1">
                                    <span className="text-3xl font-black">42</span>
                                    <span className="text-[10px] text-emerald-500 font-bold mb-1">+2</span>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-background/30 border border-white/5">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Backlinks</p>
                                <div className="flex items-end gap-2 mt-1">
                                    <span className="text-3xl font-black">2.4K</span>
                                    <span className="text-[10px] text-emerald-500 font-bold mb-1">+123</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-[120px] mb-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={mockDomainRatingData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="month"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fill: '#666' }}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }}
                                    />
                                    <Bar dataKey="dr" radius={[4, 4, 0, 0]} barSize={15}>
                                        {mockDomainRatingData.map((entry: { dr: number; month: string }, index: number) => (
                                            <Cell key={`cell-${index}`} fill={index === mockDomainRatingData.length - 1 ? '#fd6e34' : '#fd6e3480'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">Top Keywords</span>
                                <Button variant="link" className="h-auto p-0 text-[10px] text-primary">View all Ahrefs data</Button>
                            </div>
                            <div className="space-y-2">
                                {mockKeywordData.map((kw: { keyword: string; volume: string; position: number; change: number }, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-medium">{kw.keyword}</span>
                                            <span className="text-[9px] text-muted-foreground">Vol: {kw.volume}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[10px] font-bold h-5 px-1.5">#{kw.position}</Badge>
                                            {kw.change > 0 ? (
                                                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                                            ) : kw.change < 0 ? (
                                                <ArrowDownRight className="h-3 w-3 text-rose-500" />
                                            ) : (
                                                <div className="w-3 h-0.5 bg-muted-foreground/30" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Traffic Sources (Google Analytics) */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1 mb-6">
                <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium">Traffic Sources</CardTitle>
                            <CardDescription className="text-[10px]">Top channels by session (Live GA4 Data)</CardDescription>
                        </div>
                        <Globe className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={sources.length > 0 ? sources.slice(0, 5) : [
                                        { source: 'Direct', value: 45 },
                                        { source: 'Organic Search', value: 30 },
                                        { source: 'Referral', value: 15 },
                                        { source: 'Organic Social', value: 10 },
                                    ]}
                                    layout="vertical"
                                    margin={{ left: 20, right: 20 }}
                                >
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="source"
                                        type="category"
                                        stroke="#888888"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        width={120}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#18181b',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '10px'
                                        }}
                                        cursor={{ fill: 'transparent' }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                        {(sources.length > 0 ? sources.slice(0, 5) : ([1, 2, 3, 4, 5] as any[])).map((entry: GATrafficSource, index: number) => (
                                            <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - index * 0.15})`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Referral Sources Section */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-none shadow-md bg-card/40 backdrop-blur-md overflow-hidden">
                    <CardHeader className="p-6 pb-2">
                        <CardTitle className="text-base font-semibold">Lead Sources</CardTitle>
                        <CardDescription className="text-xs">Quality of traffic by source</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-white/5 max-h-[300px] overflow-auto">
                            {sources.length > 0 ? (
                                sources.map((source, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center">
                                                <Globe className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold">{source.source === '(direct)' ? 'Direct' : source.source}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Source</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold">{source.value.toLocaleString()}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Sessions</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                [
                                    { name: 'Google Organic', visitors: '4.2K', rate: '12.4%', icon: Globe, color: 'text-blue-500' },
                                    { name: 'Facebook Ads', visitors: '2.1K', rate: '8.2%', icon: Users, color: 'text-indigo-500' },
                                    { name: 'Direct Traffic', visitors: '1.8K', rate: '6.4%', icon: MousePointer2, color: 'text-emerald-500' },
                                    { name: 'Backlinks', visitors: '842', rate: '14.2%', icon: Link2, color: 'text-amber-500' },
                                ].map((source, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center">
                                                <source.icon className={`h-4 w-4 ${source.color}`} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold">{source.name}</p>
                                                <p className="text-[10px] text-emerald-500 font-bold">{source.rate}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold">{source.visitors}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Visitors</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Integration Status */}
                <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Active Integrations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-background/20 border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-[#fbbc05]/10 flex items-center justify-center">
                                    <Globe className="h-5 w-5 text-[#fbbc05]" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold">Google Analytics 4</span>
                                    <span className="text-[10px] text-emerald-500 font-medium">Connected</span>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 text-[10px]">Configure</Button>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-background/20 border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-[#fd6e34]/10 flex items-center justify-center">
                                    <Search className="h-5 w-5 text-[#fd6e34]" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold">Ahrefs API</span>
                                    <span className="text-[10px] text-amber-500 font-medium">Ready to Link</span>
                                </div>
                            </div>
                            <Button size="sm" className="h-8 text-[10px] bg-[#fd6e34] hover:bg-[#fd6e34]/80">Connect</Button>
                        </div>
                        <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
                            <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                            <p className="text-[10px] text-muted-foreground mb-3 px-4">Connect more tools to see a complete marketing overview.</p>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] w-full">View App Store</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* SEO Tips / Insights */}
                <Card className="border-none shadow-md bg-card/40 backdrop-blur-md overflow-hidden relative border-t-4 border-emerald-500">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">SEO Opportunities</CardTitle>
                        <CardDescription className="text-xs">AI-generated growth recommendations</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-emerald-500 text-white text-[8px] h-4">High Impact</Badge>
                                <span className="text-[10px] font-bold uppercase tracking-tight">Technical SEO</span>
                            </div>
                            <p className="text-xs font-semibold mb-1">Optimize images for Altus landing page</p>
                            <p className="text-[10px] text-muted-foreground">Reducing image sizes could improve page load speed by 1.2s, potentially increasing mobile rank.</p>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-blue-500 text-white text-[8px] h-4">Content</Badge>
                                <span className="text-[10px] font-bold uppercase tracking-tight">Keyword Gap</span>
                            </div>
                            <p className="text-xs font-semibold mb-1">Create &quot;PCS Survival Guide&quot; content</p>
                            <p className="text-[10px] text-muted-foreground">High volume (2.4K searches) for keywords you currently don&apos;t rank for.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
            </div>
        </div>
    )
}
