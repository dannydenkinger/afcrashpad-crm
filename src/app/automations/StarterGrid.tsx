"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { ArrowRight, Loader2 } from "lucide-react"
import { forkStarterAction } from "./actions"

const CATEGORY_COLORS: Record<string, string> = {
    Onboarding: "bg-emerald-500/10 text-emerald-700",
    Engagement: "bg-amber-500/10 text-amber-700",
    Sales: "bg-indigo-500/10 text-indigo-700",
    Retention: "bg-purple-500/10 text-purple-700",
    Lifecycle: "bg-sky-500/10 text-sky-700",
    Events: "bg-pink-500/10 text-pink-700",
}

/**
 * Plain serializable starter — the original AutomationStarter type includes
 * a `buildNodes` function which can't cross the server→client boundary.
 * The server-side parent strips it before passing here; the function lives
 * on the server and runs only when forkStarterAction looks the slug back up.
 */
export interface StarterSummary {
    slug: string
    name: string
    description: string
    category: string
}

export function StarterGrid({
    starters,
}: {
    starters: StarterSummary[]
}) {
    const router = useRouter()
    const [pendingSlug, setPendingSlug] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleFork = (slug: string) => {
        setPendingSlug(slug)
        startTransition(async () => {
            const res = await forkStarterAction(slug)
            setPendingSlug(null)
            if (!res.success || !res.automation) {
                toast.error(res.error || "Failed to fork")
                return
            }
            toast.success(`"${res.automation.name}" created — review and turn it on`)
            router.push(`/automations/${res.automation.id}`)
        })
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {starters.map((s) => {
                const isLoading = isPending && pendingSlug === s.slug
                return (
                    <button
                        key={s.slug}
                        type="button"
                        onClick={() => handleFork(s.slug)}
                        disabled={isPending}
                        className="text-left group disabled:opacity-50"
                    >
                        <Card className="h-full hover:border-primary/40 hover:shadow-sm transition-all">
                            <CardContent className="py-4 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                                            CATEGORY_COLORS[s.category] ?? "bg-muted"
                                        }`}
                                    >
                                        {s.category}
                                    </span>
                                    {isLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                    ) : (
                                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                    )}
                                </div>
                                <div className="font-semibold text-sm">{s.name}</div>
                                <div className="text-xs text-muted-foreground line-clamp-3 leading-snug">
                                    {s.description}
                                </div>
                            </CardContent>
                        </Card>
                    </button>
                )
            })}
        </div>
    )
}
