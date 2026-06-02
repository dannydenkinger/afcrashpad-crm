"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    Sparkles,
    CheckSquare,
    Lightbulb,
    RotateCcw,
    Loader2,
    ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    resetChecklist,
    resetPageHints,
    resetWelcomeScreen,
    restartAllOnboarding,
} from "./actions"

/**
 * Onboarding reset surface. The original "Re-run setup wizard" link was
 * a no-op for existing users (the /setup page redirects to /dashboard
 * once setupCompleted is true). This replaces it with real reset
 * actions for each of the three onboarding pieces.
 */
export function OnboardingClient() {
    const router = useRouter()
    const [pending, setPending] = useState<string | null>(null)
    const [, startTransition] = useTransition()

    const run = (
        key: string,
        fn: () => Promise<{ success: boolean; error?: string }>,
        successMessage: string,
        after?: () => void,
    ) => {
        setPending(key)
        startTransition(async () => {
            const res = await fn()
            setPending(null)
            if (!res.success) {
                toast.error(res.error || "Something went wrong")
                return
            }
            toast.success(successMessage)
            after?.()
        })
    }

    return (
        <div className="space-y-3">
            <ResetCard
                icon={<Sparkles className="h-4 w-4" />}
                accent="violet"
                title="Re-run welcome screen"
                description="Resets setup state so the demo-data vs empty-workspace picker shows on your next visit to /setup."
                actionLabel="Reset & open"
                loading={pending === "welcome"}
                disabled={!!pending}
                onClick={() =>
                    run(
                        "welcome",
                        resetWelcomeScreen,
                        "Welcome screen reset — taking you there now",
                        () => router.push("/setup"),
                    )
                }
            />

            <ResetCard
                icon={<CheckSquare className="h-4 w-4" />}
                accent="blue"
                title="Reset sidebar checklist"
                description="Un-hides the setup checklist in the sidebar and clears any tasks you've skipped. Already-completed tasks stay checked."
                actionLabel="Reset checklist"
                loading={pending === "checklist"}
                disabled={!!pending}
                onClick={() =>
                    run(
                        "checklist",
                        resetChecklist,
                        "Sidebar checklist is back",
                        () => router.refresh(),
                    )
                }
            />

            <ResetCard
                icon={<Lightbulb className="h-4 w-4" />}
                accent="amber"
                title="Reset page hints"
                description="The one-line tips on Pipeline, Contacts, Automations, and Dashboard will appear again on your next visit to each page."
                actionLabel="Reset hints"
                loading={pending === "hints"}
                disabled={!!pending}
                onClick={() =>
                    run("hints", resetPageHints, "Page hints will re-appear on next visit")
                }
            />

            <div className="pt-4 border-t mt-6">
                <ResetCard
                    icon={<RotateCcw className="h-4 w-4" />}
                    accent="emerald"
                    title="Restart everything"
                    description="Runs all three resets above in one shot, then opens the welcome screen."
                    actionLabel="Reset all & restart"
                    loading={pending === "all"}
                    disabled={!!pending}
                    onClick={() =>
                        run(
                            "all",
                            restartAllOnboarding,
                            "Onboarding reset — here we go again",
                            () => router.push("/setup"),
                        )
                    }
                />
            </div>
        </div>
    )
}

function ResetCard({
    icon,
    accent,
    title,
    description,
    actionLabel,
    loading,
    disabled,
    onClick,
}: {
    icon: React.ReactNode
    accent: "violet" | "blue" | "amber" | "emerald"
    title: string
    description: string
    actionLabel: string
    loading: boolean
    disabled: boolean
    onClick: () => void
}) {
    const tones: Record<typeof accent, string> = {
        violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
        blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    }

    return (
        <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
            <div
                className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${tones[accent]}`}
            >
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {description}
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-7"
                    onClick={onClick}
                    disabled={disabled}
                >
                    {loading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                    {!loading && <ArrowRight className="mr-1.5 h-3 w-3" />}
                    {actionLabel}
                </Button>
            </div>
        </div>
    )
}
