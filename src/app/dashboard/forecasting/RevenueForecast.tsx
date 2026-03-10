"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, DollarSign } from "lucide-react"
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    Legend,
} from "recharts"
import { getRevenueForecast } from "./actions"

interface RevenueForecastProps {
    pipelineId: string
}

function formatCurrency(value: number) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
}

const SCOPES = [
    { key: "3", label: "3M" },
    { key: "6", label: "6M" },
    { key: "12", label: "12M" },
] as const

export function RevenueForecast({ pipelineId }: RevenueForecastProps) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [transitioning, setTransitioning] = useState(false)
    const [months, setMonths] = useState(6)

    useEffect(() => {
        // Only show full spinner on initial load
        if (!data) setLoading(true)
        else setTransitioning(true)

        getRevenueForecast(pipelineId, months).then(result => {
            if (result.success) setData(result.data)
            setLoading(false)
            setTransitioning(false)
        })
    }, [pipelineId, months]) // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!data) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No forecast data available.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Weighted Pipeline Value */}
            <Card className="border-none bg-gradient-to-r from-emerald-500/10 to-emerald-500/5">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-medium">Weighted Pipeline Value</div>
                        <div className="text-2xl font-bold text-emerald-500">{formatCurrency(data.weightedPipelineValue)}</div>
                    </div>
                </CardContent>
            </Card>

            {/* Forecast Chart */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold">Revenue Forecast</h4>
                    <div className="flex bg-muted/30 p-0.5 rounded-md">
                        {SCOPES.map(s => (
                            <button
                                key={s.key}
                                onClick={() => setMonths(Number(s.key))}
                                className={`px-2.5 py-1 text-[10px] font-medium rounded-sm transition-colors ${
                                    months === Number(s.key)
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className={`h-[240px] w-full transition-opacity duration-300 ${transitioning ? "opacity-50" : "opacity-100"}`}>
                    {data.forecastByMonth.some((m: any) => m.bestCase > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.forecastByMonth}>
                                <defs>
                                    <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorBest" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "#666" }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "#666" }}
                                    tickFormatter={(v) => `$${v / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#18181b", border: "none", borderRadius: "8px", color: "#fff", fontSize: "11px" }}
                                    formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, ""]}
                                />
                                <Legend
                                    verticalAlign="top"
                                    height={30}
                                    iconSize={8}
                                    formatter={(value) => <span className="text-[10px] text-muted-foreground font-medium">{value}</span>}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="bestCase"
                                    name="Best Case"
                                    stroke="#3b82f6"
                                    strokeWidth={1.5}
                                    strokeDasharray="4 2"
                                    fillOpacity={1}
                                    fill="url(#colorBest)"
                                    animationDuration={600}
                                    animationEasing="ease-in-out"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="expected"
                                    name="Expected"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorExpected)"
                                    animationDuration={600}
                                    animationEasing="ease-in-out"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="worstCase"
                                    name="Worst Case"
                                    stroke="#f59e0b"
                                    strokeWidth={1.5}
                                    strokeDasharray="4 2"
                                    fillOpacity={0}
                                    fill="transparent"
                                    animationDuration={600}
                                    animationEasing="ease-in-out"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                            No upcoming deals to forecast
                        </div>
                    )}
                </div>
            </div>

            {/* Stage Breakdown */}
            <div>
                <h4 className="text-sm font-semibold mb-3">Stage Breakdown</h4>
                <div className="space-y-2">
                    {data.byStage.filter((s: any) => s.dealCount > 0).map((stage: any) => (
                        <div key={stage.stageName} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium">{stage.stageName}</span>
                                <Badge variant="outline" className="text-[9px] h-4">
                                    {stage.probability}%
                                </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                                <span className="text-muted-foreground">{stage.dealCount} deal{stage.dealCount !== 1 ? "s" : ""}</span>
                                <span className="text-muted-foreground">{formatCurrency(stage.rawValue)} raw</span>
                                <span className="font-bold text-emerald-500">{formatCurrency(stage.weightedValue)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
