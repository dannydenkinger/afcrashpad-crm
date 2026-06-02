"use client"

import { useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { BillingState } from "./actions"
import { openCustomerPortal } from "./actions"
import { PLANS } from "@/lib/billing/plans"
import { PricingCard } from "@/components/billing/PricingCard"
import { FeatureComparisonTable } from "@/components/billing/FeatureComparisonTable"
import { CreditsCard } from "@/components/billing/CreditsCard"
import { trackClient } from "@/lib/posthog/client"

export function BillingClient({
    initial,
    canManage,
}: {
    initial: BillingState
    canManage: boolean
}) {
    const searchParams = useSearchParams()
    const upgradeParam = searchParams.get("upgrade")
    const autoUpgrade = upgradeParam === "pro" || upgradeParam === "max" ? upgradeParam : null
    const [isPending, startTransition] = useTransition()
    const [pendingPortal, setPendingPortal] = useState(false)

    const handlePortal = () => {
        if (!canManage) {
            toast.error("Only OWNER or ADMIN can manage billing")
            return
        }
        setPendingPortal(true)
        startTransition(async () => {
            const res = await openCustomerPortal()
            setPendingPortal(false)
            if (res.error || !res.url) {
                toast.error(res.error || "Couldn't open billing portal")
                return
            }
            trackClient({ name: "customer_portal_opened" })
            window.location.href = res.url
        })
    }

    const currentPlan = PLANS[initial.plan.tier]
    const isPaid = initial.plan.tier !== "free"

    return (
        <div className="space-y-8">
            {/* Current plan banner */}
            <div className="rounded-2xl border bg-gradient-to-br from-violet-500/5 to-violet-500/10 p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Current plan
                            </div>
                            {initial.plan.status === "past_due" && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">
                                    Past due
                                </span>
                            )}
                            {initial.plan.status === "canceled" && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                                    Canceled
                                </span>
                            )}
                            {initial.plan.status === "trialing" && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600">
                                    Trial
                                </span>
                            )}
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div className="text-3xl sm:text-4xl font-bold tracking-tight">
                                {currentPlan.name}
                            </div>
                            {isPaid && (
                                <div className="text-sm text-muted-foreground">
                                    ${currentPlan.monthlyCents / 100}/mo base
                                </div>
                            )}
                        </div>
                        {initial.plan.expiresAt && (
                            <p className="text-[11px] text-muted-foreground mt-2">
                                Current period {initial.plan.status === "canceled" ? "ends" : "renews"}{" "}
                                {new Date(initial.plan.expiresAt).toLocaleDateString(undefined, {
                                    dateStyle: "long",
                                })}
                            </p>
                        )}
                    </div>
                    {isPaid && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePortal}
                            disabled={!canManage || !initial.hasCustomer || isPending || pendingPortal}
                        >
                            {pendingPortal ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Manage subscription
                        </Button>
                    )}
                </div>
            </div>

            {/* Plan selector */}
            <PricingCard
                currentTier={initial.plan.tier}
                canManage={canManage}
                subscriptionPricesConfigured={initial.subscriptionPricesConfigured}
                stripeConfigured={initial.stripeConfigured}
                autoUpgrade={autoUpgrade}
            />

            {/* Feature comparison (collapsible) */}
            <FeatureComparisonTable currentTier={initial.plan.tier} />

            {/* Credits — unified balance + buy + activity */}
            <CreditsCard
                balance={initial.balance}
                packs={initial.packs}
                recent={initial.recent}
                currentTier={initial.plan.tier}
                stripeConfigured={initial.stripeConfigured}
                canManage={canManage}
            />
        </div>
    )
}
