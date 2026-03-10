"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Loader2, Users, DollarSign, Plus, Share2, ArrowRight, Banknote, CheckCircle2, Send, CreditCard, Mail, Calendar,
} from "lucide-react"
import { toast } from "sonner"
import {
    getReferralsData,
    createReferral,
    updateReferralStatus,
    sendPayoutFormEmail,
} from "./actions"
import type { ReferralsData, ReferralStatus } from "./types"

function formatCurrency(value: number) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
}

function getInitials(name: string) {
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

const STATUS_CONFIG: Record<ReferralStatus, { label: string; color: string; accent: string }> = {
    pending: { label: "Pending", color: "bg-slate-500/10 text-slate-400 border-slate-500/20", accent: "bg-slate-400" },
    contacted: { label: "Contacted", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", accent: "bg-blue-500" },
    booked: { label: "Booked", color: "bg-violet-500/10 text-violet-500 border-violet-500/20", accent: "bg-violet-500" },
    active_tenant: { label: "Active Tenant", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", accent: "bg-emerald-500" },
    paid: { label: "Paid", color: "bg-emerald-500/10 text-emerald-600 border-emerald-600/30", accent: "bg-emerald-600" },
    lost: { label: "Lost", color: "bg-red-500/10 text-red-500 border-red-500/20", accent: "bg-red-500" },
}

const STATUS_ORDER: ReferralStatus[] = ["pending", "contacted", "booked", "active_tenant", "paid", "lost"]

const METHOD_LABELS: Record<string, string> = { zelle: "Zelle", venmo: "Venmo", paypal: "PayPal", check: "Check/Mail" }

export function ReferralTracker({ dateFilter }: { dateFilter?: { start: string; end: string } | null }) {
    const [data, setData] = useState<ReferralsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>("all")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [sendingPayoutId, setSendingPayoutId] = useState<string | null>(null)

    // Create form state
    const [referrerName, setReferrerName] = useState("")
    const [referrerEmail, setReferrerEmail] = useState("")
    const [referrerPhone, setReferrerPhone] = useState("")
    const [referredName, setReferredName] = useState("")
    const [referredEmail, setReferredEmail] = useState("")
    const [notes, setNotes] = useState("")

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        const res = await getReferralsData()
        if (res.success && res.data) setData(res.data)
        setLoading(false)
    }

    const filteredReferrals = useMemo(() => {
        if (!data) return []
        let referrals = data.referrals
        if (filter === "payout_due") {
            referrals = referrals.filter(r => r.status === "active_tenant")
        } else if (filter !== "all") {
            referrals = referrals.filter(r => r.status === filter)
        }
        if (dateFilter) {
            const start = new Date(dateFilter.start).getTime()
            const end = new Date(dateFilter.end).getTime()
            referrals = referrals.filter(r => {
                if (!r.createdAt) return false
                const t = new Date(r.createdAt).getTime()
                return t >= start && t <= end
            })
        }
        return referrals
    }, [data, filter, dateFilter])

    async function handleCreate() {
        if (!referrerName.trim() || !referredName.trim()) {
            toast.error("Referrer name and referred name are required")
            return
        }
        setCreating(true)
        const res = await createReferral({
            referrerName: referrerName.trim(),
            referrerEmail: referrerEmail.trim() || undefined,
            referrerPhone: referrerPhone.trim() || undefined,
            referredName: referredName.trim(),
            referredEmail: referredEmail.trim() || undefined,
            notes: notes.trim() || undefined,
        })
        if (res.success) {
            toast.success("Referral created!")
            setIsCreateOpen(false)
            resetForm()
            await loadData()
        } else {
            toast.error(res.error || "Failed to create referral")
        }
        setCreating(false)
    }

    async function handleStatusChange(referralId: string, newStatus: ReferralStatus) {
        setUpdatingId(referralId)
        const res = await updateReferralStatus(referralId, newStatus)
        if (res.success) {
            const statusLabel = STATUS_CONFIG[newStatus].label
            toast.success(`Status updated to ${statusLabel}`)
            await loadData()
        } else {
            toast.error("Failed to update status")
        }
        setUpdatingId(null)
    }

    async function handleSendPayoutForm(referralId: string, referrerName: string) {
        setSendingPayoutId(referralId)
        const res = await sendPayoutFormEmail(referralId)
        if (res.success) {
            toast.success(`Payout form sent to ${referrerName}`)
            await loadData()
        } else {
            toast.error(res.error || "Failed to send payout form")
        }
        setSendingPayoutId(null)
    }

    function resetForm() {
        setReferrerName("")
        setReferrerEmail("")
        setReferrerPhone("")
        setReferredName("")
        setReferredEmail("")
        setNotes("")
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!data) {
        return <div className="text-center py-20 text-muted-foreground">Failed to load referral data.</div>
    }

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Referrals</CardTitle>
                        <Share2 className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.totalReferrals}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">{data.conversionRate}% convert to active tenant</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Tenants</CardTitle>
                        <Users className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{data.activeTenantsCount}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Referred & moved in</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payouts Pending</CardTitle>
                        <Banknote className="h-4 w-4 text-amber-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{formatCurrency(data.totalPayoutsPending)}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {data.referrals.filter(r => r.status === "active_tenant").length} referrers owed
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Paid Out</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(data.totalPayoutsPaid)}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">{data.paidCount} payouts completed</p>
                    </CardContent>
                </Card>
            </div>

            {/* Workflow Explainer */}
            <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-semibold">
                        {STATUS_ORDER.filter(s => s !== "lost").map((status, i) => (
                            <div key={status} className="flex items-center gap-1.5">
                                {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${STATUS_CONFIG[status].color}`}>
                                    {STATUS_CONFIG[status].label}
                                </Badge>
                            </div>
                        ))}
                        <span className="text-muted-foreground ml-1">· Payout unlocks at Active Tenant</span>
                    </div>
                </CardContent>
            </Card>

            {/* Top Referrers */}
            {data.topReferrers.length > 0 && (
                <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            Top Referrers
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 px-0">
                        {/* Mobile card view */}
                        <div className="sm:hidden space-y-3 px-4 pb-2">
                            {data.topReferrers.map((referrer, i) => (
                                <div key={`mobile-${i}`} className="p-3 rounded-xl border border-border/50 bg-card space-y-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 border border-background shadow-sm">
                                            {getInitials(referrer.name)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-sm truncate">{referrer.name}</div>
                                            {referrer.email && <div className="text-[10px] text-muted-foreground truncate">{referrer.email}</div>}
                                        </div>
                                        <span className="text-xs font-semibold shrink-0">{referrer.count} referrals</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
                                        <span className="text-emerald-600">Active: {referrer.activeCount}</span>
                                        <span>Rev: {formatCurrency(referrer.revenue)}</span>
                                        <span className="font-semibold text-emerald-600">Paid: {formatCurrency(referrer.payoutsEarned)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop table view */}
                        <div className="overflow-x-auto hidden sm:block">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-t border-b bg-muted/20 text-xs text-muted-foreground">
                                        <th className="text-left font-semibold px-4 sm:px-6 py-3">Referrer</th>
                                        <th className="text-right font-semibold px-4 sm:px-6 py-3">Referrals</th>
                                        <th className="text-right font-semibold px-4 sm:px-6 py-3">Active</th>
                                        <th className="text-right font-semibold px-4 sm:px-6 py-3">Revenue</th>
                                        <th className="text-right font-semibold px-4 sm:px-6 py-3">Payouts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.topReferrers.map((referrer, i) => (
                                        <tr key={i} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                                            <td className="px-4 sm:px-6 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 border border-background shadow-sm">
                                                        {getInitials(referrer.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-sm truncate">{referrer.name}</div>
                                                        {referrer.email && <div className="text-[10px] text-muted-foreground truncate">{referrer.email}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-right px-4 sm:px-6 py-3.5 font-semibold">{referrer.count}</td>
                                            <td className="text-right px-4 sm:px-6 py-3.5 text-emerald-600">{referrer.activeCount}</td>
                                            <td className="text-right px-4 sm:px-6 py-3.5 font-semibold">{formatCurrency(referrer.revenue)}</td>
                                            <td className="text-right px-4 sm:px-6 py-3.5 font-semibold text-emerald-600">{formatCurrency(referrer.payoutsEarned)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Referrals List */}
            <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 p-4 sm:p-6 pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-primary" />
                        Referral Log
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex gap-1 flex-wrap">
                            {[
                                { key: "all", label: "All" },
                                { key: "pending", label: "Pending" },
                                { key: "contacted", label: "Contacted" },
                                { key: "booked", label: "Booked" },
                                { key: "payout_due", label: "Payout Due" },
                                { key: "paid", label: "Paid" },
                            ].map(f => (
                                <Button
                                    key={f.key}
                                    variant={filter === f.key ? "secondary" : "ghost"}
                                    size="sm"
                                    className="h-7 text-[10px] font-semibold px-2.5"
                                    onClick={() => setFilter(f.key)}
                                >
                                    {f.label}
                                </Button>
                            ))}
                        </div>
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="h-7 text-[10px] font-semibold">
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Referral
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Record a Referral</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Referrer (past traveler)</p>
                                        <div>
                                            <Label className="text-xs">Name *</Label>
                                            <Input value={referrerName} onChange={e => setReferrerName(e.target.value)} placeholder="John Smith" className="mt-1" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <Label className="text-xs">Email *</Label>
                                                <Input value={referrerEmail} onChange={e => setReferrerEmail(e.target.value)} placeholder="john@email.com" className="mt-1" />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Phone</Label>
                                                <Input value={referrerPhone} onChange={e => setReferrerPhone(e.target.value)} placeholder="555-0123" className="mt-1" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-center">
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    </div>

                                    <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Referred friend (new traveler)</p>
                                        <div>
                                            <Label className="text-xs">Name *</Label>
                                            <Input value={referredName} onChange={e => setReferredName(e.target.value)} placeholder="Jane Doe" className="mt-1" />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Email *</Label>
                                            <Input value={referredEmail} onChange={e => setReferredEmail(e.target.value)} placeholder="jane@email.com" className="mt-1" />
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="text-xs">Notes</Label>
                                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any context about this referral..." className="mt-1 min-h-[60px]" />
                                    </div>

                                    <Button onClick={handleCreate} disabled={creating} className="w-full">
                                        {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create Referral
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 sm:px-6 pb-4">
                    {filteredReferrals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Share2 className="h-12 w-12 text-muted-foreground/20 mb-4" />
                            <p className="text-lg font-medium text-foreground mb-1">No referrals yet</p>
                            <p className="text-sm text-muted-foreground mb-4 max-w-sm">Record referrals when past travelers recommend friends.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredReferrals.map(referral => {
                                const statusCfg = STATUS_CONFIG[referral.status]
                                const isPayoutReady = referral.status === "active_tenant"
                                const isPaid = referral.status === "paid"

                                return (
                                    <div
                                        key={referral.id}
                                        className={`relative bg-card border rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md
                                            ${isPayoutReady ? "border-emerald-500/30 ring-1 ring-emerald-500/10" : "border-border/60"}`}
                                    >
                                        {/* Left accent bar */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusCfg.accent}`} />

                                        <div className="p-4 pl-5 flex flex-col gap-3">
                                            {/* Top row: avatars, names, status, date */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    {/* Referrer avatar */}
                                                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs font-medium shrink-0 border-2 border-background shadow-sm">
                                                        {getInitials(referral.referrerName)}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-semibold text-sm">{referral.referrerName}</span>
                                                            <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                                            <span className="font-medium text-sm text-muted-foreground">{referral.referredName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-bold ${statusCfg.color}`}>
                                                                {statusCfg.label}
                                                            </Badge>
                                                            {referral.referredEmail && (
                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                    <Mail className="h-2.5 w-2.5 opacity-50" />
                                                                    {referral.referredEmail}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                <Calendar className="h-2.5 w-2.5 opacity-50" />
                                                                {referral.createdAt.split("T")[0]}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Deal value badge */}
                                                {referral.dealValue > 0 && (
                                                    <div className="text-right shrink-0">
                                                        <div className="flex items-center gap-1 text-sm font-semibold">
                                                            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                                                            {formatCurrency(referral.dealValue)}
                                                        </div>
                                                        <div className="text-[9px] text-muted-foreground">deal value</div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Notes */}
                                            {referral.notes && (
                                                <p className="text-xs text-muted-foreground pl-12 -mt-1 truncate">{referral.notes}</p>
                                            )}

                                            {/* Payout section for active_tenant */}
                                            {isPayoutReady && (
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/50 pl-12">
                                                    <div className="space-y-0.5">
                                                        <p className="text-xs text-emerald-500 font-semibold flex items-center gap-1.5">
                                                            <Banknote className="h-3.5 w-3.5" />
                                                            Payout earned: {formatCurrency(referral.payoutAmount)}
                                                        </p>
                                                        {referral.payoutFormSubmittedAt && referral.payoutMethod && (
                                                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                                                <CreditCard className="h-3 w-3 shrink-0" />
                                                                {METHOD_LABELS[referral.payoutMethod] || referral.payoutMethod}: <span className="font-mono text-foreground/80">{referral.payoutDetails}</span>
                                                            </p>
                                                        )}
                                                        {referral.payoutFormSentAt && !referral.payoutFormSubmittedAt && (
                                                            <p className="text-[11px] text-amber-500 flex items-center gap-1.5">
                                                                <Send className="h-3 w-3 shrink-0" />
                                                                Payout form sent — awaiting response
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {!referral.payoutFormSubmittedAt && referral.referrerEmail && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 text-xs font-semibold border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                                                                onClick={() => handleSendPayoutForm(referral.id, referral.referrerName)}
                                                                disabled={sendingPayoutId === referral.id}
                                                            >
                                                                {sendingPayoutId === referral.id ? (
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <Send className="h-3.5 w-3.5 mr-1.5" />
                                                                        {referral.payoutFormSentAt ? "Resend" : "Send Payout Form"}
                                                                    </>
                                                                )}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            className={`h-8 text-xs font-semibold ${referral.payoutFormSubmittedAt ? "bg-emerald-600 hover:bg-emerald-700" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
                                                            onClick={() => handleStatusChange(referral.id, "paid")}
                                                            disabled={updatingId === referral.id}
                                                        >
                                                            {updatingId === referral.id ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                                    Mark Paid
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Paid confirmation */}
                                            {isPaid && (
                                                <div className="flex items-center gap-2 pt-2 border-t border-border/50 pl-12">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                                    <p className="text-xs text-emerald-600">
                                                        Paid {formatCurrency(referral.payoutAmount)}
                                                        {referral.payoutMethod && ` via ${METHOD_LABELS[referral.payoutMethod] || referral.payoutMethod}`}
                                                        {" on "}
                                                        {referral.payoutPaidAt?.split("T")[0] || "—"}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Status selector for non-terminal statuses */}
                                            {!isPaid && !isPayoutReady && referral.status !== "lost" && (
                                                <div className="flex items-center gap-2 pt-2 border-t border-border/50 pl-12">
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Status</span>
                                                    <Select
                                                        value={referral.status}
                                                        onValueChange={(v) => handleStatusChange(referral.id, v as ReferralStatus)}
                                                        disabled={updatingId === referral.id}
                                                    >
                                                        <SelectTrigger className="h-7 w-[140px] text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="pending">Pending</SelectItem>
                                                            <SelectItem value="contacted">Contacted</SelectItem>
                                                            <SelectItem value="booked">Booked</SelectItem>
                                                            <SelectItem value="active_tenant">Active Tenant</SelectItem>
                                                            <SelectItem value="lost">Lost</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {updatingId === referral.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
