"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, DollarSign, CheckCircle2, Clock, Wallet, TrendingUp, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import {
    getCommissionsData,
    markCommissionPaid,
} from "./actions"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import type { CommissionsData, CommissionEntry } from "./types"

function formatCurrency(value: number) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function CommissionTracker({ dateFilter }: { dateFilter?: { start: string; end: string } | null }) {
    const [data, setData] = useState<CommissionsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<"all" | "earned" | "paid">("all")
    const [payingId, setPayingId] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [confirmPayId, setConfirmPayId] = useState<string | null>(null)
    const [confirmBulkPay, setConfirmBulkPay] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        const res = await getCommissionsData()
        if (res.success && res.data) setData(res.data)
        setLoading(false)
    }

    const filteredEntries = useMemo(() => {
        if (!data) return []
        let entries = data.entries
        if (filter !== "all") {
            entries = entries.filter(e => e.status === filter)
        }
        if (dateFilter) {
            const start = new Date(dateFilter.start).getTime()
            const end = new Date(dateFilter.end).getTime()
            entries = entries.filter(e => {
                if (!e.earnedAt) return false
                const t = new Date(e.earnedAt).getTime()
                return t >= start && t <= end
            })
        }
        return entries
    }, [data, filter, dateFilter])

    async function handleMarkPaid(id: string) {
        setPayingId(id)
        const res = await markCommissionPaid(id)
        if (res.success) {
            toast.success("Commission marked as paid")
            // Update local state
            setData(prev => {
                if (!prev) return prev
                const entries = prev.entries.map(e =>
                    e.id === id ? { ...e, status: "paid" as const, paidAt: new Date().toISOString() } : e
                )
                const totalPaid = entries.filter(e => e.status === "paid").reduce((s, e) => s + e.commissionAmount, 0)
                return {
                    ...prev,
                    entries,
                    totalPaid,
                    totalPending: prev.totalEarned - totalPaid,
                    summaries: prev.summaries.map(s => {
                        const agentEntries = entries.filter(e => e.agentId === s.agentId)
                        return {
                            ...s,
                            totalPaid: agentEntries.filter(e => e.status === "paid").reduce((sum, e) => sum + e.commissionAmount, 0),
                            totalPending: agentEntries.filter(e => e.status === "earned").reduce((sum, e) => sum + e.commissionAmount, 0),
                        }
                    })
                }
            })
        } else {
            toast.error(res.error || "Failed to mark as paid")
        }
        setPayingId(null)
    }

    const earnedIds = useMemo(() => {
        return new Set(filteredEntries.filter(e => e.status === "earned").map(e => e.id))
    }, [filteredEntries])

    const allEarnedSelected = earnedIds.size > 0 && Array.from(earnedIds).every(id => selectedIds.has(id))

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const toggleSelectAll = useCallback(() => {
        if (allEarnedSelected) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(earnedIds))
        }
    }, [allEarnedSelected, earnedIds])

    async function handleBulkMarkPaid() {
        const ids = Array.from(selectedIds)
        setPayingId("bulk")
        for (const id of ids) {
            await markCommissionPaid(id)
        }
        setSelectedIds(new Set())
        setPayingId(null)
        toast.success(`${ids.length} commissions marked as paid`)
        loadData()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!data) {
        return <div className="text-center py-20 text-muted-foreground">Failed to load commission data.</div>
    }

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Earned</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalEarned)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{data.entries.length} commissions</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paid Out</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(data.totalPaid)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Settled commissions</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{formatCurrency(data.totalPending)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting payment</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Default Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.defaultRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">Commission rate</p>
                    </CardContent>
                </Card>
            </div>

            {/* Per-Agent Summary */}
            {data.summaries.length > 0 && (
                <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-primary" />
                            Agent Commission Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 px-0">
                        {/* Mobile card view */}
                        <div className="sm:hidden space-y-3 px-4 pb-2">
                            {data.summaries.map(agent => (
                                <div key={`mobile-${agent.agentId}`} className="p-3 rounded-xl border border-border/50 bg-card space-y-2">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8 border border-background shadow-sm">
                                            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                                                {agent.agentName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <span className="font-medium text-sm">{agent.agentName}</span>
                                            <span className="text-xs text-muted-foreground ml-2">{agent.dealCount} deals</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
                                        <span>Earned: <span className="font-semibold">{formatCurrency(agent.totalEarned)}</span></span>
                                        <span className="text-emerald-600">Paid: {formatCurrency(agent.totalPaid)}</span>
                                        <span className="text-amber-600">Pend: {formatCurrency(agent.totalPending)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop table view */}
                        <div className="overflow-x-auto hidden sm:block">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-t border-b bg-muted/20 text-xs text-muted-foreground">
                                        <th className="text-left font-semibold px-4 sm:px-6 py-3">Agent</th>
                                        <th className="text-right font-semibold px-4 sm:px-6 py-3">Deals</th>
                                        <th className="text-right font-semibold px-4 sm:px-6 py-3">Earned</th>
                                        <th className="text-right font-semibold px-4 sm:px-6 py-3">Paid</th>
                                        <th className="text-right font-semibold px-4 sm:px-6 py-3">Pending</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.summaries.map(agent => (
                                        <tr key={agent.agentId} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                                            <td className="px-4 sm:px-6 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-7 w-7 border border-background shadow-sm">
                                                        <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                                                            {agent.agentName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium text-sm">{agent.agentName}</span>
                                                </div>
                                            </td>
                                            <td className="text-right px-4 sm:px-6 py-3.5">{agent.dealCount}</td>
                                            <td className="text-right px-4 sm:px-6 py-3.5 font-semibold">{formatCurrency(agent.totalEarned)}</td>
                                            <td className="text-right px-4 sm:px-6 py-3.5 text-emerald-600">{formatCurrency(agent.totalPaid)}</td>
                                            <td className="text-right px-4 sm:px-6 py-3.5 text-amber-600">{formatCurrency(agent.totalPending)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Commission Entries */}
            <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 p-4 sm:p-6 pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        Commission Log
                    </CardTitle>
                    <div className="flex gap-1">
                        {(["all", "earned", "paid"] as const).map(f => (
                            <Button
                                key={f}
                                variant={filter === f ? "secondary" : "ghost"}
                                size="sm"
                                className="h-7 text-xs font-semibold px-2.5 capitalize"
                                onClick={() => setFilter(f)}
                            >
                                {f}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="pt-0 px-0">
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-primary/10 border-b border-primary/20">
                            <span className="text-sm font-semibold text-primary">{selectedIds.size} selected</span>
                            <Button size="sm" className="h-7 text-xs" onClick={() => setConfirmBulkPay(true)} disabled={payingId !== null}>
                                {payingId === "bulk" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                Mark All Paid
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                                Clear
                            </Button>
                        </div>
                    )}
                    {filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <DollarSign className="h-12 w-12 text-muted-foreground/20 mb-4" />
                            <p className="text-lg font-medium text-foreground mb-1">No commissions yet</p>
                            <p className="text-sm text-muted-foreground mb-4 max-w-sm">Commissions are automatically created when deals are marked as booked.</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile card view */}
                            <div className="sm:hidden space-y-3 px-4 pb-4">
                                {filteredEntries.map(entry => (
                                    <div key={`mobile-${entry.id}`} className="p-3 rounded-xl border border-border/50 bg-card space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            {entry.status === "earned" && (
                                                <Checkbox
                                                    checked={selectedIds.has(entry.id)}
                                                    onCheckedChange={() => toggleSelect(entry.id)}
                                                    className="mt-0.5 shrink-0"
                                                    aria-label={`Select ${entry.contactName}`}
                                                />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-sm truncate">{entry.contactName}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {entry.agentName} · {entry.base || "No base"} · {entry.earnedAt?.split("T")[0] || ""}
                                                </div>
                                            </div>
                                            {entry.status === "paid" ? (
                                                <Badge variant="secondary" className="text-xs text-emerald-600 bg-emerald-500/10 shrink-0">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Paid
                                                </Badge>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs px-2.5 shrink-0 touch-manipulation"
                                                    onClick={() => setConfirmPayId(entry.id)}
                                                    disabled={payingId === entry.id}
                                                >
                                                    {payingId === entry.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark Paid"}
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
                                            <span className="text-muted-foreground">Deal: {formatCurrency(entry.dealValue)}</span>
                                            <span className="text-muted-foreground">{entry.commissionRate}%</span>
                                            <span className="font-semibold">{formatCurrency(entry.commissionAmount)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop table view */}
                            <div className="overflow-x-auto hidden sm:block">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-t border-b bg-muted/20 text-xs text-muted-foreground">
                                            <th className="px-4 sm:px-6 py-3 w-10">
                                                {earnedIds.size > 0 && (
                                                    <Checkbox
                                                        checked={allEarnedSelected}
                                                        onCheckedChange={toggleSelectAll}
                                                        aria-label="Select all earned commissions"
                                                    />
                                                )}
                                            </th>
                                            <th className="text-left font-semibold px-4 sm:px-6 py-3">Deal</th>
                                            <th className="text-left font-semibold px-4 sm:px-6 py-3">Agent</th>
                                            <th className="text-right font-semibold px-4 sm:px-6 py-3">Deal Value</th>
                                            <th className="text-right font-semibold px-4 sm:px-6 py-3">Rate</th>
                                            <th className="text-right font-semibold px-4 sm:px-6 py-3">Commission</th>
                                            <th className="text-right font-semibold px-4 sm:px-6 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEntries.map(entry => (
                                            <tr key={entry.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                                                <td className="px-4 sm:px-6 py-3.5 w-10">
                                                    {entry.status === "earned" && (
                                                        <Checkbox
                                                            checked={selectedIds.has(entry.id)}
                                                            onCheckedChange={() => toggleSelect(entry.id)}
                                                            aria-label={`Select ${entry.contactName}`}
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-4 sm:px-6 py-3.5">
                                                    <div className="font-medium text-sm">{entry.contactName}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {entry.base || "No base"} · {entry.earnedAt?.split("T")[0] || ""}
                                                    </div>
                                                </td>
                                                <td className="px-4 sm:px-6 py-3.5">
                                                    <span className="text-sm">{entry.agentName}</span>
                                                </td>
                                                <td className="text-right px-4 sm:px-6 py-3.5">{formatCurrency(entry.dealValue)}</td>
                                                <td className="text-right px-4 sm:px-6 py-3.5 text-muted-foreground">{entry.commissionRate}%</td>
                                                <td className="text-right px-4 sm:px-6 py-3.5 font-semibold">{formatCurrency(entry.commissionAmount)}</td>
                                                <td className="text-right px-4 sm:px-6 py-3.5">
                                                    {entry.status === "paid" ? (
                                                        <Badge variant="secondary" className="text-xs text-emerald-600 bg-emerald-500/10">
                                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                                            Paid
                                                        </Badge>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 text-xs px-2"
                                                            onClick={() => handleMarkPaid(entry.id)}
                                                            disabled={payingId === entry.id}
                                                        >
                                                            {payingId === entry.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                "Mark Paid"
                                                            )}
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Single Mark Paid Confirmation */}
            <AlertDialog open={!!confirmPayId} onOpenChange={(open) => { if (!open) setConfirmPayId(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
                        <AlertDialogDescription>
                            {(() => {
                                const entry = filteredEntries.find(e => e.id === confirmPayId)
                                return entry ? `Mark ${formatCurrency(entry.commissionAmount)} commission for ${entry.contactName} as paid? This action cannot be undone.` : "Mark this commission as paid?"
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { if (confirmPayId) { handleMarkPaid(confirmPayId); setConfirmPayId(null) } }}>
                            Mark Paid
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Mark Paid Confirmation */}
            <AlertDialog open={confirmBulkPay} onOpenChange={setConfirmBulkPay}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Bulk Payment</AlertDialogTitle>
                        <AlertDialogDescription>
                            Mark {selectedIds.size} commission{selectedIds.size !== 1 ? "s" : ""} as paid? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { handleBulkMarkPaid(); setConfirmBulkPay(false) }}>
                            Mark All Paid
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
