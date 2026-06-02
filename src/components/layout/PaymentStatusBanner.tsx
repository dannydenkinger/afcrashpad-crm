"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react"
import { getPlanStatus, openCustomerPortal } from "@/app/settings/billing/actions"
import { toast } from "sonner"

/**
 * Top-of-app banner shown when the workspace's subscription is past_due
 * or canceled. Lives in AppShell next to the WorkspaceDeletionBanner so
 * users in a workspace with billing issues always see them.
 *
 * past_due → amber. "Your payment failed, retrying. Update card now."
 *            CTA opens Stripe Customer Portal directly.
 *
 * canceled → red. Shows the date paid features end. CTA links to
 *            /settings/billing to re-subscribe.
 *
 * Both clear themselves once the workspace returns to "active" status.
 */
export function PaymentStatusBanner() {
    const [status, setStatus] = useState<"past_due" | "canceled" | null>(null)
    const [expiresAt, setExpiresAt] = useState<string | null>(null)
    const [pendingPortal, setPendingPortal] = useState(false)
    const [, startTransition] = useTransition()

    useEffect(() => {
        let cancelled = false
        getPlanStatus()
            .then((s) => {
                if (cancelled) return
                if (s.status === "past_due" || s.status === "canceled") {
                    setStatus(s.status)
                    setExpiresAt(s.expiresAt)
                }
            })
            .catch(() => {
                // Silently ignore — banner is non-critical.
            })
        return () => {
            cancelled = true
        }
    }, [])

    if (!status) return null

    const handlePortal = () => {
        setPendingPortal(true)
        startTransition(async () => {
            const res = await openCustomerPortal()
            setPendingPortal(false)
            if (res.error || !res.url) {
                toast.error(res.error || "Couldn't open billing portal")
                return
            }
            window.location.href = res.url
        })
    }

    const isPastDue = status === "past_due"
    const expiresDate = expiresAt
        ? new Date(expiresAt).toLocaleDateString(undefined, { dateStyle: "long" })
        : null

    return (
        <div
            className={`border-b px-4 py-2 flex items-center gap-2 text-xs ${
                isPastDue
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-destructive/10 border-destructive/30"
            }`}
        >
            <AlertTriangle
                className={`h-3.5 w-3.5 shrink-0 ${
                    isPastDue ? "text-amber-600" : "text-destructive"
                }`}
            />
            <span className="flex-1 min-w-0 truncate text-foreground">
                {isPastDue ? (
                    <>
                        <span className="font-semibold text-amber-600">
                            Payment failed.
                        </span>{" "}
                        Stripe is retrying — update your card to keep paid features running.
                    </>
                ) : (
                    <>
                        <span className="font-semibold text-destructive">
                            Subscription canceled.
                        </span>{" "}
                        Paid features {expiresDate ? `end on ${expiresDate}` : "have ended"}.
                        Re-subscribe to keep them.
                    </>
                )}
            </span>
            {isPastDue ? (
                <button
                    onClick={handlePortal}
                    disabled={pendingPortal}
                    className="font-medium text-amber-600 hover:underline whitespace-nowrap shrink-0 inline-flex items-center gap-1 disabled:opacity-50"
                >
                    {pendingPortal ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <ExternalLink className="h-3 w-3" />
                    )}
                    Update payment
                </button>
            ) : (
                <Link
                    href="/settings/billing"
                    className="font-medium text-destructive hover:underline whitespace-nowrap shrink-0"
                >
                    Re-subscribe
                </Link>
            )}
        </div>
    )
}
