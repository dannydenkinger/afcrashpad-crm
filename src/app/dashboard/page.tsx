"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Calendar,
    Clock,
    CheckCircle2,
    AlertCircle,
    ChevronDown,
    MoreHorizontal,
    Search,
    TrendingUp,
    DollarSign,
    Inbox,
    Home
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
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// --- Mock Data ---

const opportunityValueData = {
    "AF Crashpad Tenant": {
        "1m": [
            { name: 'Week 1', value: 45000 },
            { name: 'Week 2', value: 52000 },
            { name: 'Week 3', value: 48000 },
            { name: 'Week 4', value: 61000 },
        ],
        "6m": [
            { name: 'Sep', value: 120000 },
            { name: 'Oct', value: 145000 },
            { name: 'Nov', value: 132000 },
            { name: 'Dec', value: 168000 },
            { name: 'Jan', value: 155000 },
            { name: 'Feb', value: 185000 },
        ],
        "1y": [
            { name: 'Q1', value: 320000 },
            { name: 'Q2', value: 380000 },
            { name: 'Q3', value: 350000 },
            { name: 'Q4', value: 420000 },
        ]
    },
    "Marketing Flow": {
        "1m": [
            { name: 'Week 1', value: 12000 },
            { name: 'Week 2', value: 15000 },
            { name: 'Week 3', value: 18000 },
            { name: 'Week 4', value: 14000 },
        ],
        "6m": [
            { name: 'Sep', value: 45000 },
            { name: 'Oct', value: 52000 },
            { name: 'Nov', value: 58000 },
            { name: 'Dec', value: 61000 },
            { name: 'Jan', value: 55000 },
            { name: 'Feb', value: 72000 },
        ],
        "1y": [
            { name: 'Q1', value: 110000 },
            { name: 'Q2', value: 140000 },
            { name: 'Q3', value: 125000 },
            { name: 'Q4', value: 160000 },
        ]
    }
}

const opportunityStatusData = {
    "AF Crashpad Tenant": [
        { name: 'Open', value: 24, color: '#3b82f6' },
        { name: 'In-Progress', value: 18, color: '#6366f1' },
        { name: 'Closed', value: 52, color: '#10b981' },
        { name: 'Abandoned', value: 12, color: '#f43f5e' },
    ],
    "Marketing Flow": [
        { name: 'Open', value: 12, color: '#3b82f6' },
        { name: 'In-Progress', value: 10, color: '#6366f1' },
        { name: 'Closed', value: 30, color: '#10b981' },
        { name: 'Abandoned', value: 5, color: '#f43f5e' },
    ]
}

interface StageData {
    name: string;
    count: number;
    value: number;
    color: string;
}

interface BaseData {
    name: string;
    deals: number;
    color: string;
}

const stageDistributionData = {
    "AF Crashpad Tenant": [
        { name: 'New Lead', count: 24, value: 432000, color: '#3b82f6' },
        { name: 'Contacted', count: 18, value: 324000, color: '#6366f1' },
        { name: 'Lease Sent', count: 12, value: 216000, color: '#8b5cf6' },
        { name: 'Pending Review', count: 8, value: 144000, color: '#d946ef' },
        { name: 'Closed Won', count: 52, value: 936000, color: '#10b981' },
    ],
    "Marketing Flow": [
        { name: 'Inquiry', count: 45, value: 810000, color: '#3b82f6' },
        { name: 'Nurture', count: 32, value: 576000, color: '#6366f1' },
        { name: 'Proposal', count: 15, value: 270000, color: '#8b5cf6' },
        { name: 'Lost', count: 20, value: 360000, color: '#f43f5e' },
    ]
}

const inquiryBaseData = {
    "AF Crashpad Tenant": [
        { name: 'Altus AFB', deals: 42, color: '#3b82f6' },
        { name: 'Lackland AFB', deals: 35, color: '#6366f1' },
        { name: 'Kelly Field', deals: 28, color: '#8b5cf6' },
        { name: 'Vance AFB', deals: 22, color: '#d946ef' },
        { name: 'Sheppard AFB', deals: 15, color: '#f43f5e' },
    ],
    "Marketing Flow": [
        { name: 'Facebook', deals: 65, color: '#3b82f6' },
        { name: 'Google Search', deals: 48, color: '#6366f1' },
        { name: 'Word of Mouth', deals: 32, color: '#8b5cf6' },
        { name: 'Instagram', deals: 25, color: '#d946ef' },
    ]
}

const kpiMetrics = {
    "AF Crashpad Tenant": {
        activeTenants: "28/35",
        occupancyRate: 80,
        conversionRate: 12.5,
        totalPipeValue: 2450000,
        openInquiries: 14,
        baseName: "Units Occupied"
    },
    "Marketing Flow": {
        activeTenants: "N/A",
        occupancyRate: 0,
        conversionRate: 8.2,
        totalPipeValue: 840000,
        openInquiries: 42,
        baseName: "Leads Generated"
    }
}

const initialTasks = [
    { id: 1, title: "Follow up with Capt. Miller", assignee: "Danny", dueDate: "2026-02-27", priority: "High", status: "Pending" },
    { id: 2, title: "Review lease agreement for J. Smith", assignee: "Sarah", dueDate: "2026-02-26", priority: "Medium", status: "Pending" },
    { id: 3, title: "Update property photos - Altus Base", assignee: "Danny", dueDate: "2026-03-01", priority: "Low", status: "Pending" },
    { id: 4, title: "Send welcome email to Lt. Ross", assignee: "Sarah", dueDate: "2026-02-25", priority: "High", status: "Completed" },
    { id: 5, title: "Schedule cleaning - Unit 4B", assignee: "Danny", dueDate: "2026-02-28", priority: "Medium", status: "Pending" },
    { id: 6, title: "Call PandaDoc support", assignee: "Danny", dueDate: "2026-02-24", priority: "Low", status: "Completed" },
]

// --- Additional Recharts Imports (Bar) ---
import { BarChart, Bar } from 'recharts'

export default function DashboardPage() {
    const [valuePipeline, setValuePipeline] = useState<keyof typeof opportunityValueData>("AF Crashpad Tenant")
    const [statusPipeline, setStatusPipeline] = useState<keyof typeof opportunityStatusData>("AF Crashpad Tenant")
    const [stagePipeline, setStagePipeline] = useState<keyof typeof stageDistributionData>("AF Crashpad Tenant")
    const [basePipeline, setBasePipeline] = useState<keyof typeof inquiryBaseData>("AF Crashpad Tenant")
    const [timeframe, setTimeframe] = useState<"1m" | "6m" | "1y">("6m")
    const [taskSearch, setTaskSearch] = useState("")
    const [taskSort, setTaskSort] = useState<"dueDate" | "assignee">("dueDate")
    const [taskFilter, setTaskFilter] = useState<"All" | "Pending" | "Completed">("Pending")

    const filteredAndSortedTasks = useMemo(() => {
        return initialTasks
            .filter(task => {
                const matchesSearch = task.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
                    task.assignee.toLowerCase().includes(taskSearch.toLowerCase());
                const matchesStatus = taskFilter === "All" || task.status === taskFilter;
                return matchesSearch && matchesStatus;
            })
            .sort((a, b) => {
                if (taskSort === "dueDate") return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                return a.assignee.localeCompare(b.assignee);
            });
    }, [taskSearch, taskSort, taskFilter]);

    return (
        <div className="space-y-4 p-4 sm:p-8 pt-4 sm:pt-6 overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Dashboard
                    </h2>
                    <p className="text-muted-foreground font-medium text-sm">Operations overview & real-time analytics.</p>
                </div>
            </div>

            {/* KPI Row (Row 1) */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Tenants</CardTitle>
                        <Home className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpiMetrics[valuePipeline].activeTenants}</div>
                        <div className="mt-2 h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-1000"
                                style={{ width: `${kpiMetrics[valuePipeline].occupancyRate}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 font-medium">Occupancy: {kpiMetrics[valuePipeline].occupancyRate}%</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversion Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpiMetrics[valuePipeline].conversionRate}%</div>
                        <p className="text-[10px] text-emerald-500 mt-1 font-medium flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            +2.4% from last month
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pipeline Value</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${(kpiMetrics[valuePipeline].totalPipeValue / 1000000).toFixed(1)}M</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Weighted forecast value</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Open Inquiries</CardTitle>
                        <Inbox className="h-4 w-4 text-rose-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpiMetrics[valuePipeline].openInquiries}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Requires follow-up</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Pipeline Value Line Chart - Full Width Row 1 */}
                <Card className="col-span-7 border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div className="space-y-1">
                            <CardTitle className="text-base font-semibold">Pipeline Value</CardTitle>
                            <CardDescription className="text-xs">Estimated revenue trends</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                                        {valuePipeline}
                                        <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="text-xs">
                                    <DropdownMenuItem className="text-xs" onClick={() => setValuePipeline("AF Crashpad Tenant")}>AF Crashpad Tenant</DropdownMenuItem>
                                    <DropdownMenuItem className="text-xs" onClick={() => setValuePipeline("Marketing Flow")}>Marketing Flow</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <div className="h-4 w-[1px] bg-muted/50 mx-1" />
                            <div className="flex bg-muted/30 p-0.5 rounded-md">
                                {(["1m", "6m", "1y"] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTimeframe(t)}
                                        className={`px-2 py-1 text-[10px] font-bold rounded-sm transition-all ${timeframe === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        {t.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={opportunityValueData[valuePipeline][timeframe]}>
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
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#666' }}
                                        tickFormatter={(value) => `$${value / 1000}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                        itemStyle={{ color: '#10b981', padding: '0' }}
                                        formatter={(value: unknown) => {
                                            const val = typeof value === 'number' ? value : Number(value) || 0;
                                            return [`$${val.toLocaleString()}`, 'Value'];
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorValue)"
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Opportunity Status Card (col-3) */}
                <Card className="col-span-3 border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div className="space-y-1">
                            <CardTitle className="text-base font-semibold">Opportunity Status</CardTitle>
                            <CardDescription className="text-xs">Deal status distribution</CardDescription>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                                    {statusPipeline}
                                    <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem className="text-xs" onClick={() => setStatusPipeline("AF Crashpad Tenant")}>AF Crashpad Tenant</DropdownMenuItem>
                                <DropdownMenuItem className="text-xs" onClick={() => setStatusPipeline("Marketing Flow")}>Marketing Flow</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={opportunityStatusData[statusPipeline]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={75}
                                        paddingAngle={4}
                                        dataKey="value"
                                        animationDuration={1500}
                                        stroke="none"
                                    >
                                        {opportunityStatusData[statusPipeline].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconSize={6}
                                        formatter={(value) => <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Stage Distribution Card (col-4) - Detailed Funnel View */}
                <Card className="col-span-4 border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div className="space-y-1">
                            <CardTitle className="text-base font-semibold">Stage Distribution</CardTitle>
                            <CardDescription className="text-xs">Deal volume & value by stage</CardDescription>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                                    {stagePipeline}
                                    <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem className="text-xs" onClick={() => setStagePipeline("AF Crashpad Tenant")}>AF Crashpad Tenant</DropdownMenuItem>
                                <DropdownMenuItem className="text-xs" onClick={() => setStagePipeline("Marketing Flow")}>Marketing Flow</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="space-y-4 h-[180px] overflow-y-auto pr-2 scrollbar-hide">
                            {(() => {
                                const data = stageDistributionData[stagePipeline];
                                if (!data) return null;
                                const totalCount = data.reduce((acc: number, curr: StageData) => acc + curr.count, 0);
                                const maxValue = Math.max(...data.map((d: StageData) => d.count));

                                return data.map((stage: StageData, idx: number) => (
                                    <div key={idx} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: stage.color }}
                                                />
                                                <span className="font-semibold text-foreground/90">{stage.name}</span>
                                                <span className="text-[10px] text-muted-foreground font-medium">({stage.count} deals)</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-foreground">${stage.value.toLocaleString()}</span>
                                                <span className="ml-2 text-[10px] text-muted-foreground font-medium">
                                                    {((stage.count / totalCount) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                                style={{
                                                    width: `${(stage.count / maxValue) * 100}%`,
                                                    backgroundColor: stage.color,
                                                    opacity: 0.8
                                                }}
                                            />
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </CardContent>
                </Card>

                {/* Inquiry Tracker (Row 4 - col-4) */}
                <Card className="col-span-4 border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-base font-semibold">Inquiry Tracker</CardTitle>
                            <CardDescription className="text-xs">Deals per Military Base</CardDescription>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                                    {basePipeline}
                                    <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem className="text-xs" onClick={() => setBasePipeline("AF Crashpad Tenant")}>AF Crashpad Tenant</DropdownMenuItem>
                                <DropdownMenuItem className="text-xs" onClick={() => setBasePipeline("Marketing Flow")}>Marketing Flow</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={inquiryBaseData[basePipeline]} margin={{ left: -20, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#666' }}
                                        width={100}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    />
                                    <Bar
                                        dataKey="deals"
                                        radius={[0, 4, 4, 0]}
                                        barSize={12}
                                        animationDuration={1500}
                                    >
                                        {inquiryBaseData[basePipeline].map((entry: BaseData, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Task Manager Section - Integrated into Board (col-3) */}
                <Card className="col-span-3 border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div className="space-y-1">
                            <CardTitle className="text-base font-semibold">Priority Tasks</CardTitle>
                            <CardDescription className="text-xs">Immediate focus items</CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="px-3 pt-0">
                        <div className="space-y-3 h-[200px] overflow-y-auto scrollbar-hide">
                            {filteredAndSortedTasks.slice(0, 5).map((task) => (
                                <div key={task.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-2 w-2 rounded-full ${task.priority === "High" ? "bg-rose-500" : task.priority === "Medium" ? "bg-amber-500" : "bg-emerald-500"}`} />
                                        <span className="text-xs font-medium truncate max-w-[120px]">{task.title}</span>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] h-5">{task.dueDate.split('-').slice(1).join('/')}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Comprehensive Task Manager Section (Full Width) */}
            <Card className="border-none shadow-lg bg-card/30 backdrop-blur-xl">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 space-y-0">
                    <div>
                        <CardTitle className="text-xl sm:text-2xl">Task Manager</CardTitle>
                        <p className="text-sm text-muted-foreground">Manage daily lead follow-ups and operations</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative w-full sm:w-auto">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search tasks..."
                                className="h-9 pl-9 w-full sm:w-64 bg-background/50 border-none shadow-inner min-h-[44px] sm:min-h-[36px]"
                                value={taskSearch}
                                onChange={(e) => setTaskSearch(e.target.value)}
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 gap-2 touch-manipulation">
                                    <Clock className="h-4 w-4" />
                                    Sort: {taskSort === "dueDate" ? "Due Date" : "Assignee"}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setTaskSort("dueDate")}>Due Date</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTaskSort("assignee")}>Assignee</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="flex bg-muted/20 p-1 rounded-lg overflow-x-auto w-full sm:w-auto">
                            {(["All", "Pending", "Completed"] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setTaskFilter(f)}
                                    className={`flex-1 sm:flex-none px-3 py-1.5 sm:py-1 text-xs font-medium rounded-md transition-all touch-manipulation ${taskFilter === f ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <table className="w-full text-sm min-w-[600px]">
                            <thead>
                                <tr className="border-b bg-muted/30">
                                    <th className="text-left py-3 px-6 font-semibold text-muted-foreground">Task</th>
                                    <th className="text-left py-3 px-6 font-semibold text-muted-foreground">Assignee</th>
                                    <th className="text-left py-3 px-6 font-semibold text-muted-foreground">Due Date</th>
                                    <th className="text-left py-3 px-6 font-semibold text-muted-foreground">Priority</th>
                                    <th className="text-left py-3 px-6 font-semibold text-muted-foreground">Status</th>
                                    <th className="py-3 px-6"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedTasks.map((task) => (
                                    <tr key={task.id} className="border-b hover:bg-muted/10 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                {task.status === "Completed" ? (
                                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                ) : (
                                                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 group-hover:border-primary transition-colors cursor-pointer" />
                                                )}
                                                <span className={task.status === "Completed" ? "line-through text-muted-foreground" : "font-medium"}>
                                                    {task.title}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                    {task.assignee.charAt(0)}
                                                </div>
                                                <span>{task.assignee}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3 w-3" />
                                                {task.dueDate}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <Badge
                                                variant="outline"
                                                className={`font-normal ${task.priority === "High" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                                                    task.priority === "Medium" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                                        "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                                    }`}
                                            >
                                                {task.priority}
                                            </Badge>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`text-xs font-medium ${task.status === "Completed" ? "text-emerald-500" : "text-amber-500"}`}>
                                                {task.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredAndSortedTasks.length === 0 && (
                        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                            <p>No tasks found matching your criteria.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
