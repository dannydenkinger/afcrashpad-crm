"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Trophy, Medal, TrendingUp, DollarSign, Target, Users, ArrowUpDown, Loader2 } from "lucide-react"
import { getLeaderboardData } from "./actions"
import type { LeaderboardAgent } from "./types"

type SortKey = "totalRevenue" | "totalProfit" | "bookedDeals" | "conversionRate" | "avgDealValue" | "claimedDeals"

function formatCurrency(value: number) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
}

export function LeaderboardTab() {
    const [agents, setAgents] = useState<LeaderboardAgent[]>([])
    const [loading, setLoading] = useState(true)
    const [sortBy, setSortBy] = useState<SortKey>("totalRevenue")

    useEffect(() => {
        getLeaderboardData().then(res => {
            if (res.success && res.data) {
                setAgents(res.data.agents)
            }
            setLoading(false)
        })
    }, [])

    const sorted = useMemo(() => {
        return [...agents]
            .sort((a, b) => {
                const aVal = a[sortBy]
                const bVal = b[sortBy]
                return (bVal as number) - (aVal as number)
            })
            .map((agent, idx) => ({ ...agent, rank: idx + 1 }))
    }, [agents, sortBy])

    // Team totals
    const teamRevenue = agents.reduce((s, a) => s + a.totalRevenue, 0)
    const teamProfit = agents.reduce((s, a) => s + a.totalProfit, 0)
    const teamBooked = agents.reduce((s, a) => s + a.bookedDeals, 0)
    const teamTotal = agents.reduce((s, a) => s + a.totalDeals, 0)

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (agents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No agents found</p>
                <p className="text-sm mt-1">Add team members in Settings to see leaderboard data.</p>
            </div>
        )
    }

    const sortOptions: { key: SortKey; label: string }[] = [
        { key: "totalRevenue", label: "Revenue" },
        { key: "totalProfit", label: "Profit" },
        { key: "bookedDeals", label: "Closed Deals" },
        { key: "conversionRate", label: "Conversion %" },
        { key: "avgDealValue", label: "Avg Deal" },
        { key: "claimedDeals", label: "Claimed" },
    ]

    const rankColors = ["text-primary", "text-slate-400", "text-amber-700"]

    return (
        <div className="space-y-6">
            {/* Team Summary KPIs */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(teamRevenue)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{teamBooked} deals closed</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Profit</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(teamProfit)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total margin earned</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Deals</CardTitle>
                        <Target className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{teamTotal}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across all agents</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Conversion</CardTitle>
                        <Trophy className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{teamTotal > 0 ? Math.round((teamBooked / teamTotal) * 1000) / 10 : 0}%</div>
                        <p className="text-xs text-muted-foreground mt-1">Deals → Booked</p>
                    </CardContent>
                </Card>
            </div>

            {/* Leaderboard Table */}
            <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 space-y-0 p-4 sm:p-6 pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        Agent Leaderboard
                    </CardTitle>
                    <div className="flex flex-wrap gap-1">
                        {sortOptions.map(opt => (
                            <Button
                                key={opt.key}
                                variant={sortBy === opt.key ? "secondary" : "ghost"}
                                size="sm"
                                className="h-7 text-xs font-semibold px-2.5"
                                onClick={() => setSortBy(opt.key)}
                            >
                                {opt.label}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="pt-0 px-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-t border-b bg-muted/20 text-xs text-muted-foreground">
                                    <th className="text-left font-semibold px-4 sm:px-6 py-3 w-10">#</th>
                                    <th className="text-left font-semibold px-4 sm:px-6 py-3">Agent</th>
                                    <th className="text-right font-semibold px-4 sm:px-6 py-3">Revenue</th>
                                    <th className="text-right font-semibold px-4 sm:px-6 py-3">Profit</th>
                                    <th className="text-right font-semibold px-4 sm:px-6 py-3 hidden sm:table-cell">Closed</th>
                                    <th className="text-right font-semibold px-4 sm:px-6 py-3 hidden md:table-cell">Total</th>
                                    <th className="text-right font-semibold px-4 sm:px-6 py-3 hidden md:table-cell">Conv %</th>
                                    <th className="text-right font-semibold px-4 sm:px-6 py-3 hidden lg:table-cell">Avg Deal</th>
                                    <th className="text-right font-semibold px-4 sm:px-6 py-3 hidden lg:table-cell">Claimed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(agent => (
                                    <tr key={agent.userId} className={`border-b border-border/30 hover:bg-muted/10 transition-colors ${agent.rank <= 3 ? "bg-muted/5" : ""}`}>
                                        <td className="px-4 sm:px-6 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                {agent.rank === 1 && <Trophy className="h-3.5 w-3.5 text-primary" />}
                                                {agent.rank === 2 && <Medal className="h-3.5 w-3.5 text-slate-400" />}
                                                {agent.rank === 3 && <Medal className="h-3.5 w-3.5 text-amber-700" />}
                                                <span className={`font-bold text-sm ${agent.rank <= 3 ? rankColors[agent.rank - 1] : "text-muted-foreground"}`}>
                                                    {agent.rank}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8 border border-background shadow-sm">
                                                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                                                        {agent.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium text-sm">{agent.name}</p>
                                                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-right px-4 sm:px-6 py-3.5 font-semibold">{formatCurrency(agent.totalRevenue)}</td>
                                        <td className="text-right px-4 sm:px-6 py-3.5 font-semibold text-emerald-600">{formatCurrency(agent.totalProfit)}</td>
                                        <td className="text-right px-4 sm:px-6 py-3.5 hidden sm:table-cell">{agent.bookedDeals}</td>
                                        <td className="text-right px-4 sm:px-6 py-3.5 hidden md:table-cell text-muted-foreground">{agent.totalDeals}</td>
                                        <td className="text-right px-4 sm:px-6 py-3.5 hidden md:table-cell">
                                            <Badge variant="outline" className={`text-xs ${agent.conversionRate >= 50 ? "text-emerald-600 border-emerald-500/20" : agent.conversionRate >= 25 ? "text-amber-600 border-amber-500/20" : "text-muted-foreground"}`}>
                                                {agent.conversionRate}%
                                            </Badge>
                                        </td>
                                        <td className="text-right px-4 sm:px-6 py-3.5 hidden lg:table-cell">{formatCurrency(agent.avgDealValue)}</td>
                                        <td className="text-right px-4 sm:px-6 py-3.5 hidden lg:table-cell text-muted-foreground">{agent.claimedDeals}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
