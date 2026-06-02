"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import NumberFlow from "@number-flow/react"
import {
    Zap,
    Loader2,
    RefreshCw,
    AlertTriangle,
    ChevronDown,
    ArrowUp,
    ArrowDown,
    Receipt,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { PLANS, type PlanTier } from "@/lib/billing/plans"
import { startTopup } from "@/app/settings/billing/actions"
import type { CreditLedgerReason } from "@/types"

/**
 * Unified credits card — balance + plan context + top-up selector +
 * recent activity, all in one focused surface.
 *
 * Replaces the previous three separate sections (balance card / buy
 * packs grid / activity history) which felt disconnected.
 */

interface LedgerRow {
    id: string
    delta: number
    balanceAfter: number
    reason: CreditLedgerReason
    note: string | null
    refId: string | null
    createdAt: string | null
}

interface Pack {
    sku: string
    label: string
    credits: number
    amountCents: number
    currency: string
}

interface CreditsCardProps {
    balance: number
    packs: Pack[]
    recent: LedgerRow[]
    currentTier: PlanTier
    stripeConfigured: boolean
    canManage: boolean
}

const REASON_LABELS: Record<CreditLedgerReason, string> = {
    send: "Email/SMS send",
    reserve: "Reserved",
    refund: "Refund",
    topup: "Top-up",
    grant: "Top-up",
    adjust: "Adjustment",
}

const TRANSITION = {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
    mass: 0.8,
}

export function CreditsCard({
    balance,
    packs,
    recent,
    currentTier,
    stripeConfigured,
    canManage,
}: CreditsCardProps) {
    const router = useRouter()
    const [selectedPack, setSelectedPack] = useState<string>(
        packs.find((p) => p.sku === "credits-10k")?.sku || packs[0]?.sku || "",
    )
    const [pendingBuy, setPendingBuy] = useState(false)
    const [showActivity, setShowActivity] = useState(false)
    const [, startTransition] = useTransition()

    const plan = PLANS[currentTier]
    const monthlyAllotment = plan.limits.monthlyCredits

    // This-month usage from the ledger — sum of negative-delta `send` rows
    // since the 1st of the current month.
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const thisMonthSpend = recent
        .filter((r) => r.reason === "send" && r.delta < 0)
        .filter((r) => r.createdAt && new Date(r.createdAt) >= monthStart)
        .reduce((sum, r) => sum + Math.abs(r.delta), 0)

    const usagePct =
        monthlyAllotment > 0
            ? Math.min(100, Math.round((thisMonthSpend / monthlyAllotment) * 100))
            : 0
    const overAllotment = thisMonthSpend > monthlyAllotment

    const isLow = balance < 500
    const isVeryLow = balance < 100

    const handleBuy = () => {
        if (!selectedPack) return
        if (!canManage) {
            toast.error("Only OWNER or ADMIN can buy credits")
            return
        }
        if (!stripeConfigured) {
            toast.error("Stripe isn't configured on this deployment.")
            return
        }
        setPendingBuy(true)
        startTransition(async () => {
            const res = await startTopup(selectedPack)
            if (res.error || !res.url) {
                toast.error(res.error || "Failed to start checkout")
                setPendingBuy(false)
                return
            }
            window.location.href = res.url
        })
    }

    return (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            {/* Top: balance + plan context */}
            <div className="p-5 sm:p-6 bg-gradient-to-br from-violet-500/5 via-card to-card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            <Zap className="h-3.5 w-3.5 text-violet-500" />
                            Credit balance
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
                                <NumberFlow value={balance} />
                            </div>
                            <div className="text-sm text-muted-foreground">credits</div>
                        </div>
                        {isLow && (
                            <div
                                className={`mt-2 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
                                    isVeryLow
                                        ? "bg-destructive/10 text-destructive"
                                        : "bg-amber-500/10 text-amber-600"
                                }`}
                            >
                                <AlertTriangle className="h-3 w-3" />
                                {isVeryLow ? "Critical — top up to keep sending" : "Running low"}
                            </div>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.refresh()}
                        className="h-8 text-xs"
                    >
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                        Refresh
                    </Button>
                </div>

                {/* This-month usage vs plan allotment */}
                {monthlyAllotment > 0 && (
                    <div className="mt-5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                                This month · {plan.name} plan
                            </span>
                            <span className="font-mono tabular-nums">
                                <span className={overAllotment ? "text-amber-600" : "text-foreground"}>
                                    {thisMonthSpend.toLocaleString()}
                                </span>
                                <span className="text-muted-foreground"> / {monthlyAllotment.toLocaleString()} included</span>
                            </span>
                        </div>
                        <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                            <motion.div
                                initial={false}
                                animate={{ width: `${usagePct}%` }}
                                transition={TRANSITION}
                                className={`h-full rounded-full ${
                                    overAllotment
                                        ? "bg-amber-500"
                                        : usagePct > 80
                                          ? "bg-amber-500"
                                          : "bg-violet-500"
                                }`}
                            />
                        </div>
                        {overAllotment && (
                            <p className="text-[10px] text-amber-600 mt-1">
                                You&apos;re over your monthly allotment. Credit packs cover the
                                difference and never expire.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Top-up selector */}
            <div className="border-t p-5 sm:p-6 space-y-4">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div>
                        <h3 className="text-sm font-semibold">Buy more credits</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            One-time purchase · credits never expire · stack with monthly allotment
                        </p>
                    </div>
                    {!stripeConfigured && (
                        <span className="text-[11px] text-amber-500">
                            Stripe not configured
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {packs.map((pack) => (
                        <PackOption
                            key={pack.sku}
                            pack={pack}
                            selected={selectedPack === pack.sku}
                            onSelect={() => setSelectedPack(pack.sku)}
                            highlight={pack.sku === "credits-10k"}
                        />
                    ))}
                </div>

                <Button
                    onClick={handleBuy}
                    disabled={
                        !selectedPack ||
                        pendingBuy ||
                        !canManage ||
                        !stripeConfigured
                    }
                    className="w-full"
                    size="sm"
                >
                    {pendingBuy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {pendingBuy
                        ? "Redirecting…"
                        : `Buy ${packs.find((p) => p.sku === selectedPack)?.credits.toLocaleString() || ""} credits — $${
                              ((packs.find((p) => p.sku === selectedPack)?.amountCents || 0) / 100).toFixed(0)
                          }`}
                </Button>

                {!canManage && (
                    <p className="text-[10px] text-muted-foreground text-center">
                        Only OWNER or ADMIN can buy credits.
                    </p>
                )}
            </div>

            {/* Activity (collapsible) */}
            <button
                type="button"
                onClick={() => setShowActivity(!showActivity)}
                className="w-full border-t flex items-center justify-between px-5 sm:px-6 py-3 hover:bg-muted/30 transition-colors"
                aria-expanded={showActivity}
            >
                <div className="flex items-center gap-2 text-left">
                    <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold">Recent activity</span>
                    <span className="text-[10px] text-muted-foreground">
                        {recent.length === 0
                            ? "no activity yet"
                            : `${recent.length} entr${recent.length === 1 ? "y" : "ies"}`}
                    </span>
                </div>
                <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        showActivity ? "rotate-180" : ""
                    }`}
                />
            </button>

            <AnimatePresence initial={false}>
                {showActivity && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t">
                            {recent.length === 0 ? (
                                <div className="px-5 sm:px-6 py-8 text-center">
                                    <Receipt className="h-5 w-5 mx-auto text-muted-foreground/30 mb-2" />
                                    <p className="text-xs text-muted-foreground">
                                        No credit activity yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y max-h-[400px] overflow-y-auto">
                                    {recent.map((row) => (
                                        <LedgerRowItem key={row.id} row={row} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function PackOption({
    pack,
    selected,
    onSelect,
    highlight,
}: {
    pack: Pack
    selected: boolean
    onSelect: () => void
    highlight?: boolean
}) {
    const pricePerThousand = (pack.amountCents / 100) / (pack.credits / 1000)
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`relative text-left rounded-xl border-2 p-4 transition-colors ${
                selected
                    ? "border-violet-500 bg-violet-500/5"
                    : "border-border hover:border-foreground/30 hover:bg-muted/30"
            }`}
        >
            {highlight && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-violet-500 text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap shadow-sm">
                    Best value
                </div>
            )}
            <div className="space-y-3">
                <div>
                    <div className="text-2xl font-bold tabular-nums leading-tight">
                        {pack.credits.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                        credits
                    </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                    <div className="text-xl font-bold tabular-nums">
                        ${(pack.amountCents / 100).toFixed(0)}
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                        ${pricePerThousand.toFixed(2)}/k
                    </div>
                </div>
            </div>
        </button>
    )
}

function LedgerRowItem({ row }: { row: LedgerRow }) {
    const positive = row.delta > 0
    const reasonLabel = REASON_LABELS[row.reason] || row.reason
    const date = row.createdAt
        ? new Date(row.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
          })
        : "—"
    return (
        <div className="flex items-center gap-3 px-5 sm:px-6 py-2.5 hover:bg-muted/30 transition-colors">
            <div
                className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${
                    positive
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-rose-500/10 text-rose-500"
                }`}
            >
                {positive ? (
                    <ArrowUp className="h-3 w-3" />
                ) : (
                    <ArrowDown className="h-3 w-3" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">
                    {row.note || reasonLabel}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                    {date} · {reasonLabel}
                </div>
            </div>
            <div className="text-right shrink-0">
                <div
                    className={`text-xs font-mono font-semibold ${
                        positive ? "text-emerald-600" : "text-rose-500"
                    }`}
                >
                    {positive ? "+" : ""}
                    {row.delta.toLocaleString()}
                </div>
                <div className="text-[9px] text-muted-foreground font-mono">
                    bal {row.balanceAfter.toLocaleString()}
                </div>
            </div>
        </div>
    )
}
