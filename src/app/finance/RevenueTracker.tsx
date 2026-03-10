"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, DollarSign, CheckCircle2, Clock, TrendingUp, ArrowUpRight, Search } from "lucide-react"
import { toast } from "sonner"
import { getRevenueData, updateRevenueStatus } from "@/app/pipeline/actions"

function formatCurrency(value: number) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface RevenueDeal {
    id: string
    name: string
    value: number
    revenueStatus: "booked" | "collected" | "partial"
    collectedAmount: number
    collectedDate: string
    paymentStatus: string
    stage: string | null
}

export function RevenueTracker({ dateFilter }: { dateFilter?: { start: string; end: string } | null }) {
    const [deals, setDeals] = useState<RevenueDeal[]>([])
    const [loading, setLoading] = useState(true)
    const [totals, setTotals] = useState({ totalBooked: 0, totalCollected: 0, outstanding: 0 })
    const [filter, setFilter] = useState<"all" | "booked" | "collected" | "partial">("all")
    const [searchTerm, setSearchTerm] = useState("")
    const [markingId, setMarkingId] = useState<string | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        const res = await getRevenueData()
        if (res.success && res.data) {
            setDeals(res.data.deals as RevenueDeal[])
            setTotals({
                totalBooked: res.data.totalBooked,
                totalCollected: res.data.totalCollected,
                outstanding: res.data.outstanding,
            })
        }
        setLoading(false)
    }

    const filteredDeals = useMemo(() => {
        let result = deals
        if (filter !== "all") {
            result = result.filter(d => d.revenueStatus === filter)
        }
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase()
            result = result.filter(d => d.name.toLowerCase().includes(term))
        }
        if (dateFilter) {
            const start = new Date(dateFilter.start).getTime()
            const end = new Date(dateFilter.end).getTime()
            result = result.filter(d => {
                const dateStr = d.collectedDate || d.paymentStatus
                if (!dateStr) return false
                const t = new Date(dateStr).getTime()
                return !isNaN(t) && t >= start && t <= end
            })
        }
        // Only show deals with value > 0
        result = result.filter(d => d.value > 0)
        return result
    }, [deals, filter, searchTerm, dateFilter])

    async function handleMarkCollected(deal: RevenueDeal) {
        setMarkingId(deal.id)
        const res = await updateRevenueStatus(deal.id, "collected", deal.value)
        if (res.success) {
            toast.success(`${deal.name} marked as collected`)
            // Update local state
            setDeals(prev => prev.map(d =>
                d.id === deal.id
                    ? { ...d, revenueStatus: "collected" as const, collectedAmount: d.value, collectedDate: new Date().toISOString().split("T")[0] }
                    : d
            ))
            setTotals(prev => ({
                ...prev,
                totalCollected: prev.totalCollected + (deal.value - deal.collectedAmount),
                outstanding: prev.outstanding - (deal.value - deal.collectedAmount),
            }))
        } else {
            toast.error(res.error || "Failed to update revenue status")
        }
        setMarkingId(null)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-border/50 bg-card/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Booked Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totals.totalBooked)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across {deals.filter(d => d.value > 0).length} deals</p>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.totalCollected)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {totals.totalBooked > 0 ? `${((totals.totalCollected / totals.totalBooked) * 100).toFixed(0)}% of booked` : "0%"}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{formatCurrency(Math.max(totals.outstanding, 0))}</div>
                        <p className="text-xs text-muted-foreground mt-1">Uncollected amount</p>
                    </CardContent>
                </Card>
            </div>

            {/* Collection Progress Bar */}
            <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Collection Progress</span>
                        <span className="text-sm text-muted-foreground">
                            {formatCurrency(totals.totalCollected)} / {formatCurrency(totals.totalBooked)}
                        </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                            style={{ width: `${totals.totalBooked > 0 ? Math.min((totals.totalCollected / totals.totalBooked) * 100, 100) : 0}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 text-right">
                        {totals.totalBooked > 0 ? ((totals.totalCollected / totals.totalBooked) * 100).toFixed(1) : "0"}% collected
                    </p>
                </CardContent>
            </Card>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-1.5">
                    {(["all", "booked", "partial", "collected"] as const).map((f) => (
                        <Button
                            key={f}
                            size="sm"
                            variant={filter === f ? "default" : "outline"}
                            onClick={() => setFilter(f)}
                            className="text-xs capitalize"
                        >
                            {f === "all" ? "All Deals" : f}
                        </Button>
                    ))}
                </div>
                <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search deals..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8 pl-8 text-sm"
                    />
                </div>
            </div>

            {/* Deals Table */}
            <Card className="border-border/50 bg-card/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b bg-muted/30">
                                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deal</th>
                                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booked</th>
                                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collected</th>
                                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Outstanding</th>
                                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredDeals.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                                            {filter === "all" && !searchTerm ? "No deals with revenue data yet" : "No matching deals found"}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDeals.map((deal) => {
                                        const outstanding = Math.max(deal.value - deal.collectedAmount, 0)
                                        return (
                                            <tr key={deal.id} className="hover:bg-muted/20 transition-colors">
                                                <td className="p-3">
                                                    <p className="text-sm font-medium truncate max-w-[200px]">{deal.name}</p>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <span className="text-sm font-medium">{formatCurrency(deal.value)}</span>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <span className="text-sm font-medium text-emerald-600">
                                                        {formatCurrency(deal.collectedAmount)}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right hidden sm:table-cell">
                                                    <span className={`text-sm font-medium ${outstanding > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                                        {formatCurrency(outstanding)}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <Badge variant="outline" className={
                                                        deal.revenueStatus === "collected"
                                                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                                            : deal.revenueStatus === "partial"
                                                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                                                : "text-muted-foreground"
                                                    }>
                                                        {deal.revenueStatus === "collected" ? "Collected" :
                                                         deal.revenueStatus === "partial" ? "Partial" : "Booked"}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-right">
                                                    {deal.revenueStatus !== "collected" && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                                            onClick={() => handleMarkCollected(deal)}
                                                            disabled={markingId === deal.id}
                                                        >
                                                            {markingId === deal.id ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                                    Mark Collected
                                                                </>
                                                            )}
                                                        </Button>
                                                    )}
                                                    {deal.revenueStatus === "collected" && deal.collectedDate && (
                                                        <span className="text-xs text-muted-foreground">{deal.collectedDate}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
                Revenue tracking is for CRM-level visibility. Actual accounting is managed through QuickBooks.
            </p>
        </div>
    )
}
