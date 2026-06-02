"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import NumberFlow from "@number-flow/react"
import { Plus, Minus, Check, Users, Loader2, Sparkles, Rocket, Crown } from "lucide-react"
import { toast } from "sonner"
import { PLANS, type PlanTier } from "@/lib/billing/plans"
import { startPlanChange } from "@/app/settings/billing/actions"
import type { Cadence } from "@/lib/billing/subscriptions"
import { trackClient } from "@/lib/posthog/client"

/**
 * In-app upgrade card — single card with 3 stacked plan options. Click
 * a plan to select; the selected plan expands to show its features and
 * a team-size selector. Click "Upgrade to <plan>" to open Stripe
 * Checkout.
 *
 * Drop-in replacement for the old 3-up PlanSection in BillingClient.
 * Mirrors the same data shape — reads PLANS, calls startPlanChange.
 *
 * Note on seat selector: it's display-only when the
 * STRIPE_PRICE_*_SEAT_* env vars aren't configured (seat overage). The
 * checkout falls back to base-price-only in that case. When you do
 * configure seat overage prices, the count gets passed to Checkout as
 * a line-item quantity automatically.
 */

const TRANSITION = {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
    mass: 0.8,
}

interface PricingCardProps {
    currentTier: PlanTier
    canManage: boolean
    subscriptionPricesConfigured: Record<
        "pro_monthly" | "pro_yearly" | "max_monthly" | "max_yearly",
        boolean
    >
    stripeConfigured: boolean
    autoUpgrade?: "pro" | "max" | null
}

const PLAN_ORDER: PlanTier[] = ["free", "pro", "max"]
const PLAN_ICONS = { free: Sparkles, pro: Rocket, max: Crown } as const

export function PricingCard({
    currentTier,
    canManage,
    subscriptionPricesConfigured,
    stripeConfigured,
    autoUpgrade,
}: PricingCardProps) {
    const [billingCycle, setBillingCycle] = useState<Cadence>("monthly")
    // Default the selection to one tier above the user's current plan
    // so the most relevant upgrade is pre-expanded.
    const defaultSelected: PlanTier =
        currentTier === "free" ? "pro" : currentTier === "pro" ? "max" : "max"
    const [selectedPlan, setSelectedPlan] = useState<PlanTier>(defaultSelected)

    // Seat count slider state — keyed by plan so switching tabs preserves
    // each plan's chosen size.
    const [seatCounts, setSeatCounts] = useState<Record<PlanTier, number>>({
        free: 1,
        pro: PLANS.pro.limits.seatsIncluded,
        max: PLANS.max.limits.seatsIncluded,
    })

    const [pendingPlan, setPendingPlan] = useState<PlanTier | null>(null)
    const [, startTransition] = useTransition()

    const autoUpgradeFiredRef = useRef(false)
    useEffect(() => {
        if (autoUpgradeFiredRef.current) return
        if (!autoUpgrade || autoUpgrade === currentTier) return
        autoUpgradeFiredRef.current = true
        setSelectedPlan(autoUpgrade)
        handleUpgrade(autoUpgrade)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoUpgrade])

    const handleUpgrade = (tier: PlanTier) => {
        if (tier === "free" || tier === currentTier) return
        if (!canManage) {
            toast.error("Only OWNER or ADMIN can change the plan")
            return
        }
        if (!stripeConfigured) {
            toast.error("Billing isn't configured on this deployment yet.")
            return
        }
        const key = `${tier}_${billingCycle}` as const
        if (!subscriptionPricesConfigured[key]) {
            toast.error(
                `${PLANS[tier].name} (${billingCycle}) price isn't configured. The workspace owner needs to set STRIPE_PRICE_${tier.toUpperCase()}_${billingCycle.toUpperCase()}.`,
            )
            return
        }
        trackClient({
            name: "upgrade_clicked",
            props: { from_tier: currentTier, to_tier: tier, cadence: billingCycle },
        })
        setPendingPlan(tier)
        startTransition(async () => {
            const res = await startPlanChange(tier, billingCycle)
            if (res.error || !res.url) {
                toast.error(res.error || "Failed to start checkout")
                setPendingPlan(null)
                return
            }
            trackClient({
                name: "checkout_started",
                props: { tier, cadence: billingCycle },
            })
            window.location.href = res.url
        })
    }

    return (
        <div className="w-full flex flex-col gap-6 p-5 sm:p-6 rounded-2xl border bg-card shadow-sm">
            {/* Header + billing cycle toggle */}
            <div className="flex flex-col gap-4">
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                    {currentTier === "free" ? "Choose a plan" : "Change plan"}
                </h2>

                <div className="bg-muted p-1 h-10 rounded-xl ring-1 ring-border flex">
                    <CycleButton
                        active={billingCycle === "monthly"}
                        onClick={() => setBillingCycle("monthly")}
                    >
                        Monthly
                    </CycleButton>
                    <CycleButton
                        active={billingCycle === "yearly"}
                        onClick={() => setBillingCycle("yearly")}
                    >
                        Yearly
                        <span className="bg-emerald-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase text-white tracking-tight whitespace-nowrap">
                            2 mo free
                        </span>
                    </CycleButton>
                </div>
            </div>

            {/* Plan rows */}
            <div className="flex flex-col gap-3">
                {PLAN_ORDER.map((tier) => {
                    const plan = PLANS[tier]
                    const isSelected = selectedPlan === tier
                    const isCurrent = currentTier === tier
                    const Icon = PLAN_ICONS[tier]

                    const monthlyPrice =
                        billingCycle === "monthly"
                            ? plan.monthlyCents / 100
                            : plan.yearlyCents / 100 / 12
                    const billedAmount =
                        billingCycle === "monthly"
                            ? plan.monthlyCents / 100
                            : plan.yearlyCents / 100

                    const seatCount = seatCounts[tier]
                    const includedSeats = plan.limits.seatsIncluded
                    const extraSeats = Math.max(0, seatCount - includedSeats)
                    const seatChargeMonthly = (extraSeats * plan.extraSeatCents) / 100
                    const totalDisplay =
                        billingCycle === "monthly"
                            ? monthlyPrice + seatChargeMonthly
                            : monthlyPrice + seatChargeMonthly

                    return (
                        <div
                            key={tier}
                            onClick={() => setSelectedPlan(tier)}
                            className="relative cursor-pointer"
                        >
                            <div
                                className={`relative rounded-xl bg-card border transition-colors ${
                                    isSelected
                                        ? "border-primary border-2 z-10"
                                        : "border-border hover:border-foreground/20"
                                }`}
                            >
                                <div className="p-4 sm:p-5">
                                    {/* Row: radio + label / price */}
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex gap-3 min-w-0">
                                            <div className="mt-0.5 shrink-0">
                                                <div
                                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                        isSelected
                                                            ? "border-primary"
                                                            : "border-muted-foreground/30"
                                                    }`}
                                                >
                                                    <AnimatePresence mode="wait" initial={false}>
                                                        {isSelected && (
                                                            <motion.div
                                                                initial={{ scale: 0 }}
                                                                animate={{ scale: 1 }}
                                                                exit={{ scale: 0 }}
                                                                transition={{
                                                                    type: "spring",
                                                                    stiffness: 300,
                                                                    damping: 25,
                                                                }}
                                                                className="w-3 h-3 rounded-full bg-primary"
                                                            />
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-base font-semibold leading-tight">
                                                            {plan.name}
                                                        </h3>
                                                        {isCurrent && (
                                                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600">
                                                                Current
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                                                        {plan.tagline}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xl font-semibold tabular-nums">
                                                <NumberFlow
                                                    value={isSelected ? totalDisplay : monthlyPrice}
                                                    format={{
                                                        style: "currency",
                                                        currency: "USD",
                                                        maximumFractionDigits: 0,
                                                    }}
                                                />
                                            </div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                                                {tier === "free"
                                                    ? "forever"
                                                    : billingCycle === "monthly"
                                                      ? "per month"
                                                      : "per month, billed yearly"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded body when selected */}
                                    <AnimatePresence initial={false}>
                                        {isSelected && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={TRANSITION}
                                                className="overflow-hidden"
                                            >
                                                <div className="pt-5 flex flex-col gap-5">
                                                    {/* Feature highlights */}
                                                    <div className="flex flex-col gap-2.5">
                                                        {planHighlights(tier).map((feature, i) => (
                                                            <motion.div
                                                                key={feature}
                                                                initial={{ opacity: 0, y: 4 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: i * 0.04 }}
                                                                className="flex items-center gap-2.5 text-sm"
                                                            >
                                                                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                                                <span className="text-foreground/85">{feature}</span>
                                                            </motion.div>
                                                        ))}
                                                    </div>

                                                    {/* Seat selector — only for paid plans */}
                                                    {tier !== "free" && (
                                                        <>
                                                            <div className="h-px bg-muted" />
                                                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className="w-11 h-11 rounded-full bg-muted shrink-0 flex items-center justify-center">
                                                                        <Users className="h-5 w-5 text-muted-foreground" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="text-sm font-medium leading-tight">
                                                                            Team size
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                                                                            {includedSeats} included
                                                                            {extraSeats > 0 && (
                                                                                <>
                                                                                    {" "}+ {extraSeats} ×{" "}
                                                                                    ${plan.extraSeatCents / 100}/mo
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3 bg-muted p-1 rounded-xl border border-border">
                                                                    <SeatButton
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            setSeatCounts((s) => ({
                                                                                ...s,
                                                                                [tier]: Math.max(1, s[tier] - 1),
                                                                            }))
                                                                        }}
                                                                        disabled={seatCount <= 1}
                                                                    >
                                                                        <Minus className="h-3.5 w-3.5" />
                                                                    </SeatButton>
                                                                    <span className="text-sm w-6 text-center tabular-nums font-medium">
                                                                        <NumberFlow value={seatCount} />
                                                                    </span>
                                                                    <SeatButton
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            setSeatCounts((s) => ({
                                                                                ...s,
                                                                                [tier]: s[tier] + 1,
                                                                            }))
                                                                        }}
                                                                    >
                                                                        <Plus className="h-3.5 w-3.5" />
                                                                    </SeatButton>
                                                                </div>
                                                            </div>

                                                            {/* Total summary + CTA */}
                                                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                                                <div className="text-sm">
                                                                    <span className="text-muted-foreground">Total:</span>{" "}
                                                                    <span className="font-semibold tabular-nums">
                                                                        <NumberFlow
                                                                            value={
                                                                                billingCycle === "yearly"
                                                                                    ? (billedAmount + extraSeats * (plan.extraSeatCents / 100) * 12)
                                                                                    : totalDisplay
                                                                            }
                                                                            format={{
                                                                                style: "currency",
                                                                                currency: "USD",
                                                                                maximumFractionDigits: 0,
                                                                            }}
                                                                        />
                                                                    </span>
                                                                    <span className="text-muted-foreground">
                                                                        {billingCycle === "yearly"
                                                                            ? "/year"
                                                                            : "/month"}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleUpgrade(tier)
                                                                    }}
                                                                    disabled={
                                                                        isCurrent ||
                                                                        pendingPlan === tier ||
                                                                        !canManage
                                                                    }
                                                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    {pendingPlan === tier && (
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    )}
                                                                    {isCurrent
                                                                        ? "Current plan"
                                                                        : `Upgrade to ${plan.name}`}
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {!canManage && (
                <p className="text-[11px] text-muted-foreground text-center">
                    Only the workspace OWNER or ADMIN can change the plan.
                </p>
            )}
        </div>
    )
}

function CycleButton({
    active,
    onClick,
    children,
}: {
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 h-full rounded-lg text-sm font-medium relative transition-colors duration-300 flex items-center justify-center gap-2 ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
        >
            {active && (
                <motion.div
                    layoutId="pricing-cycle-bg"
                    className="absolute inset-0 bg-background rounded-lg shadow-sm ring-1 ring-border"
                    transition={TRANSITION}
                />
            )}
            <span className="relative z-10 flex items-center gap-2">{children}</span>
        </button>
    )
}

function SeatButton({
    onClick,
    disabled,
    children,
}: {
    onClick: (e: React.MouseEvent) => void
    disabled?: boolean
    children: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="p-1.5 rounded-lg hover:bg-background hover:shadow-sm transition-all text-muted-foreground hover:text-foreground active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none"
        >
            {children}
        </button>
    )
}

/**
 * The 3-4 most compelling bullet points per plan to show in the expanded
 * row. Keep it tight — the full feature comparison lives in the
 * FeatureComparisonTable beneath.
 */
function planHighlights(tier: PlanTier): string[] {
    switch (tier) {
        case "free":
            return [
                "1 seat, no time limit",
                "Up to 1,000 contacts",
                "Pipeline, tasks, calendar, comms",
                "100 credits/month",
            ]
        case "pro":
            return [
                "3 seats included · $12/extra",
                "Unlimited contacts",
                "Automations + AI Write-with-AI",
                "Email marketing + e-signature",
                "2,500 credits/month + top-ups",
                "REST API + webhooks",
            ]
        case "max":
            return [
                "10 seats included · $19/extra",
                "Everything in Pro, plus:",
                "AI blog generation + SEO module",
                "White-label + sub-workspaces",
                "Granular permissions",
                "25,000 credits/month",
                "Priority support",
            ]
    }
}
