import Link from "next/link"
import { Lock, ArrowRight, Sparkles } from "lucide-react"
import { PLANS, type PlanTier } from "@/lib/billing/plans"
import { Button } from "@/components/ui/button"

/**
 * Inline lock screen shown when a workspace's plan doesn't include a
 * feature. Drop it anywhere a paid-only surface would otherwise render.
 *
 *     <PlanLocked feature="Automations" requiredTier="pro" />
 *
 * For the cases where you want to render something *partial* (e.g. show
 * a teaser screenshot under the lock card), pass children — they appear
 * below the upgrade card.
 */
export function PlanLocked({
    feature,
    requiredTier,
    currentTier,
    children,
}: {
    feature: string
    requiredTier: Exclude<PlanTier, "free">
    /** Pass the current workspace plan tier if you have it; default is "free" treatment. */
    currentTier?: PlanTier
    children?: React.ReactNode
}) {
    const plan = PLANS[requiredTier]
    const accent =
        requiredTier === "pro"
            ? "from-violet-500/10 to-violet-500/5 border-violet-500/30"
            : "from-indigo-500/10 to-indigo-500/5 border-indigo-500/30"

    const showPro = requiredTier === "pro" && currentTier === "free"
    const showMax =
        requiredTier === "max" && (currentTier === "free" || currentTier === "pro")

    return (
        <div className={`rounded-2xl border bg-gradient-to-br p-6 sm:p-8 ${accent}`}>
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-background border flex items-center justify-center shrink-0">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold">{feature}</h3>
                        <span
                            className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                requiredTier === "pro"
                                    ? "bg-violet-500/15 text-violet-500"
                                    : "bg-indigo-500/15 text-indigo-500"
                            }`}
                        >
                            {plan.name}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {feature} is included in the{" "}
                        <span className="font-medium text-foreground">{plan.name}</span> plan
                        {showPro || showMax ? (
                            <>
                                . Upgrade to unlock it — starts at{" "}
                                <span className="font-medium text-foreground">
                                    ${plan.monthlyCents / 100}/month
                                </span>
                                .
                            </>
                        ) : (
                            "."
                        )}
                    </p>
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                        <Link href="/settings/billing">
                            <Button size="sm">
                                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                                Upgrade to {plan.name}
                            </Button>
                        </Link>
                        <Link href="/pricing">
                            <Button variant="outline" size="sm">
                                Compare plans
                                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
            {children && (
                <div className="mt-6 pt-6 border-t opacity-60 pointer-events-none select-none">
                    {children}
                </div>
            )}
        </div>
    )
}
