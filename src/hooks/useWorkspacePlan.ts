"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { getPlanStatus } from "@/app/settings/billing/actions"
import { type PlanTier, type FeatureKey, hasFeature } from "@/lib/billing/plans"

/**
 * Client-side hook for reading the workspace's current plan tier and
 * checking feature gates. Use sparingly in client components that need
 * to conditionally render gated UI (e.g. <WriteWithAIButton> hides for
 * free tier).
 *
 * For server-side gating, use requirePlan() in plans-server.ts instead —
 * that's the authoritative enforcement. This hook is for UX only.
 */
export function useWorkspacePlan() {
    const { data: session } = useSession()
    const [tier, setTier] = useState<PlanTier>("free")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        if (!session?.user?.id) {
            setLoading(false)
            return
        }
        getPlanStatus()
            .then((s) => {
                if (cancelled) return
                setTier(s.tier)
            })
            .catch(() => {
                // Stay on "free" if we couldn't read — fail closed.
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [session?.user?.id])

    return {
        tier,
        loading,
        isFree: tier === "free",
        isPro: tier === "pro",
        isMax: tier === "max",
        hasFeature: (feature: FeatureKey) => hasFeature(tier, feature),
    }
}
