"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
    AlertTriangle,
    Ban,
    Coins,
    CreditCard,
    Crown,
    Loader2,
    Rocket,
    Sparkles,
    Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    addEmailCreditsOperator,
    cancelStripeSubscriptionOperator,
    forcePurgeWorkspaceNow,
    setWorkspacePlanComp,
    setWorkspaceSuspended,
} from "./actions"

type PlanTier = "free" | "pro" | "max"

export function OperatorActions({
    workspaceId,
    workspaceName,
    currentPlan,
    isSuspended,
    hasStripeSubscription,
}: {
    workspaceId: string
    workspaceName: string
    currentPlan: PlanTier
    isSuspended: boolean
    hasStripeSubscription: boolean
}) {
    const [pending, startTransition] = useTransition()
    const [creditsAmount, setCreditsAmount] = useState("1000")
    const [creditsNote, setCreditsNote] = useState("")
    const [suspendReason, setSuspendReason] = useState("")
    const [confirmingPurge, setConfirmingPurge] = useState(false)
    const [purgeConfirmText, setPurgeConfirmText] = useState("")
    const [confirmingCancel, setConfirmingCancel] = useState(false)

    const compTo = (tier: PlanTier) => {
        if (tier === currentPlan) {
            toast.info(`Already on ${tier.toUpperCase()}`)
            return
        }
        startTransition(async () => {
            const res = await setWorkspacePlanComp({ workspaceId, tier })
            if (!res.success) {
                toast.error(res.error || "Failed")
                return
            }
            toast.success(`Plan set to ${tier.toUpperCase()}`)
        })
    }

    const addCredits = () => {
        const n = Number(creditsAmount)
        if (!Number.isFinite(n) || n <= 0) {
            toast.error("Enter a positive number")
            return
        }
        startTransition(async () => {
            const res = await addEmailCreditsOperator({
                workspaceId,
                amount: Math.round(n),
                note: creditsNote || undefined,
            })
            if (!res.success) {
                toast.error(res.error || "Failed")
                return
            }
            toast.success(`+${creditsAmount} credits → new balance ${res.newBalance}`)
            setCreditsAmount("1000")
            setCreditsNote("")
        })
    }

    const toggleSuspended = () => {
        if (!isSuspended && !suspendReason.trim()) {
            toast.error("Add a reason before suspending")
            return
        }
        startTransition(async () => {
            const res = await setWorkspaceSuspended({
                workspaceId,
                suspended: !isSuspended,
                reason: !isSuspended ? suspendReason : undefined,
            })
            if (!res.success) {
                toast.error(res.error || "Failed")
                return
            }
            toast.success(!isSuspended ? "Workspace suspended" : "Workspace reactivated")
            setSuspendReason("")
        })
    }

    const cancelStripe = () => {
        startTransition(async () => {
            const res = await cancelStripeSubscriptionOperator({ workspaceId })
            setConfirmingCancel(false)
            if (!res.success) {
                toast.error(res.error || "Failed")
                return
            }
            toast.success("Stripe subscription canceled — will fall off at period end")
        })
    }

    const purge = () => {
        startTransition(async () => {
            const res = await forcePurgeWorkspaceNow({
                workspaceId,
                confirmName: purgeConfirmText,
            })
            setConfirmingPurge(false)
            if (!res.success) {
                toast.error(res.error || "Failed")
                return
            }
            toast.success("Workspace purged. Redirecting…")
            setTimeout(() => {
                window.location.href = "/admin/workspaces"
            }, 800)
        })
    }

    return (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold">Operator actions</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
                Everything below writes to <code className="text-[10px]">operator_audit_log</code>.
                Be deliberate.
            </p>

            {/* Comp plan */}
            <Section title="Comp plan (bypass Stripe)">
                <div className="flex flex-wrap gap-1.5">
                    {(["free", "pro", "max"] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => compTo(t)}
                            disabled={pending}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                                currentPlan === t
                                    ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-400"
                                    : "border-border hover:bg-muted/50"
                            }`}
                        >
                            {t === "free" && <Sparkles className="h-3 w-3" />}
                            {t === "pro" && <Rocket className="h-3 w-3" />}
                            {t === "max" && <Crown className="h-3 w-3" />}
                            {t.toUpperCase()}
                            {currentPlan === t && (
                                <span className="text-[9px] uppercase tracking-wider opacity-70">
                                    current
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                    Sets <code className="text-[10px]">workspace.plan</code> directly. Doesn&apos;t
                    touch Stripe — if the customer has a paid subscription, cancel that
                    separately.
                </p>
            </Section>

            {/* Add credits */}
            <Section title="Add email credits">
                <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Amount
                        </label>
                        <input
                            type="number"
                            value={creditsAmount}
                            onChange={(e) => setCreditsAmount(e.target.value)}
                            className="w-28 px-2 py-1.5 text-xs rounded-md border bg-background"
                            min="1"
                            step="100"
                        />
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Note (optional)
                        </label>
                        <input
                            type="text"
                            value={creditsNote}
                            onChange={(e) => setCreditsNote(e.target.value)}
                            placeholder="e.g. beta tester comp"
                            className="px-2 py-1.5 text-xs rounded-md border bg-background"
                        />
                    </div>
                    <Button size="sm" onClick={addCredits} disabled={pending}>
                        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
                        Grant
                    </Button>
                </div>
            </Section>

            {/* Suspend */}
            <Section title={isSuspended ? "Reactivate workspace" : "Suspend workspace"}>
                {isSuspended ? (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={toggleSuspended}
                        disabled={pending}
                    >
                        Reactivate
                    </Button>
                ) : (
                    <div className="flex flex-wrap gap-2 items-end">
                        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Reason (logged + saved)
                            </label>
                            <input
                                type="text"
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                placeholder="e.g. ToS violation: bulk spam"
                                className="px-2 py-1.5 text-xs rounded-md border bg-background"
                            />
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={toggleSuspended}
                            disabled={pending}
                            className="text-rose-600 dark:text-rose-400"
                        >
                            <Ban className="h-3.5 w-3.5 mr-1.5" />
                            Suspend
                        </Button>
                    </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1.5">
                    Sets <code className="text-[10px]">workspace.status</code>. Suspended
                    workspaces redirect every authed request to <code className="text-[10px]">/suspended</code>;
                    active support sessions against this workspace are also blocked.
                </p>
            </Section>

            {/* Cancel Stripe */}
            {hasStripeSubscription && (
                <Section title="Stripe subscription">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmingCancel(true)}
                        disabled={pending}
                        className="text-rose-600 dark:text-rose-400"
                    >
                        <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                        Cancel subscription
                    </Button>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                        Calls Stripe&apos;s cancel endpoint. The subscription stops at the
                        end of the current billing period.
                    </p>
                </Section>
            )}

            {/* Force purge */}
            <Section title="Force purge now (destructive)">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmingPurge(true)}
                    disabled={pending}
                    className="text-rose-600 dark:text-rose-400 border-rose-500/30"
                >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Purge workspace
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                    Skips the 30-day grace period. Hard-deletes every workspace-scoped
                    document, contact subcollections, Storage objects, and cancels any
                    Stripe subscription. Not recoverable.
                </p>
            </Section>

            {/* Cancel Stripe confirm */}
            <Dialog open={confirmingCancel} onOpenChange={(o) => (!o ? setConfirmingCancel(false) : null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancel Stripe subscription?</DialogTitle>
                        <DialogDescription>
                            The customer will be billed through the end of the current period,
                            then drop to free. They&apos;ll see the standard cancellation
                            banner in-app.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmingCancel(false)} disabled={pending}>
                            Back
                        </Button>
                        <Button onClick={cancelStripe} disabled={pending}>
                            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Cancel subscription
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Purge confirm */}
            <Dialog open={confirmingPurge} onOpenChange={(o) => (!o ? setConfirmingPurge(false) : null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-rose-600 dark:text-rose-400">
                            Purge {workspaceName}?
                        </DialogTitle>
                        <DialogDescription>
                            This is permanent. Every contact, deal, automation, message,
                            document, integration, and Storage object for this workspace
                            will be deleted. Stripe subscription will be canceled too.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <p className="text-xs text-muted-foreground">
                            Type the workspace name to confirm: <code className="text-[11px]">{workspaceName}</code>
                        </p>
                        <input
                            type="text"
                            value={purgeConfirmText}
                            onChange={(e) => setPurgeConfirmText(e.target.value)}
                            placeholder={workspaceName}
                            className="w-full px-3 py-2 text-sm rounded-md border bg-background"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmingPurge(false)} disabled={pending}>
                            Back
                        </Button>
                        <Button
                            onClick={purge}
                            disabled={pending || purgeConfirmText.trim() !== workspaceName}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Purge permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5 pt-3 border-t first:border-t-0 first:pt-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
            </h3>
            <div>{children}</div>
        </div>
    )
}
