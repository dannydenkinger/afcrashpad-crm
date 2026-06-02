"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useTransition } from "react"
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import {
    AlertTriangle,
    CalendarX,
    Copy,
    Loader2,
    MailWarning,
    MoreHorizontal,
    Pencil,
    Send,
    Trash2,
} from "lucide-react"
import {
    cancelScheduledCampaignAction,
    deleteCampaignAction,
    duplicateCampaignAction,
    resendToNonOpenersAction,
    sendCampaignAction,
} from "../../actions"

interface Props {
    campaignId: string
    status: string
    canSend: boolean
    canEdit: boolean
}

type ConfirmKind =
    | { type: "send" }
    | { type: "delete" }
    | { type: "cancelSchedule" }
    | null

export function CampaignActions({ campaignId, status, canSend, canEdit }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [confirm, setConfirm] = useState<ConfirmKind>(null)

    const handleSend = () => {
        if (!canSend) {
            toast.error("Verify a SES domain before sending")
            return
        }
        setConfirm({ type: "send" })
    }

    const performSend = () => {
        setConfirm(null)
        startTransition(async () => {
            const result = await sendCampaignAction(campaignId)
            if (!result.success) {
                toast.error(result.error || "Send failed")
                return
            }
            toast.success(
                `Campaign sent. ${result.sent ?? 0} delivered, ${result.failed ?? 0} failed.`,
            )
            router.refresh()
        })
    }

    const performDelete = () => {
        setConfirm(null)
        startTransition(async () => {
            const result = await deleteCampaignAction(campaignId)
            if (!result.success) {
                toast.error(result.error || "Delete failed")
                return
            }
            toast.success("Campaign deleted")
            router.push("/marketing/email")
        })
    }

    const performCancelSchedule = () => {
        setConfirm(null)
        startTransition(async () => {
            const result = await cancelScheduledCampaignAction(campaignId)
            if (!result.success) {
                toast.error(result.error || "Failed to cancel schedule")
                return
            }
            toast.success("Schedule canceled — campaign is a draft again")
            router.refresh()
        })
    }

    const handleDuplicate = () => {
        startTransition(async () => {
            const result = await duplicateCampaignAction(campaignId)
            if (!result.success || !result.campaign) {
                toast.error(result.error || "Duplicate failed")
                return
            }
            toast.success(`Created "${result.campaign.name}"`)
            router.push(`/marketing/email/campaigns/${result.campaign.id}/edit`)
        })
    }

    const handleResendNonOpeners = () => {
        startTransition(async () => {
            const result = await resendToNonOpenersAction(campaignId)
            if (!result.success || !result.campaign) {
                toast.error(result.error || "Resend setup failed")
                return
            }
            toast.success(
                `Draft created targeting ${result.recipients?.toLocaleString()} non-openers`,
            )
            router.push(`/marketing/email/campaigns/${result.campaign.id}/edit`)
        })
    }

    const canSendNow = status === "draft" || status === "scheduled"
    const isScheduled = status === "scheduled"
    const isSent = status === "sent" || status === "sent_with_errors"

    return (
        <>
            <div className="flex items-center gap-2 shrink-0">
                {canEdit && (
                    <Link href={`/marketing/email/campaigns/${campaignId}/edit`}>
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                        </Button>
                    </Link>
                )}
                {isScheduled && (
                    <Button
                        onClick={() => setConfirm({ type: "cancelSchedule" })}
                        disabled={isPending}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                    >
                        <CalendarX className="w-3.5 h-3.5" />
                        Cancel schedule
                    </Button>
                )}
                {canSendNow && (
                    <Button
                        onClick={handleSend}
                        disabled={isPending || !canSend}
                        size="sm"
                        className="gap-1.5"
                    >
                        {isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Send className="w-3.5 h-3.5" />
                        )}
                        {isScheduled ? "Send now instead" : "Send now"}
                    </Button>
                )}
                {isSent && (
                    <Button
                        onClick={handleResendNonOpeners}
                        disabled={isPending}
                        size="sm"
                        className="gap-1.5"
                        title="Create a new draft targeting only contacts who didn't open"
                    >
                        <MailWarning className="w-3.5 h-3.5" />
                        Resend to non-openers
                    </Button>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={isPending}
                            className="h-8 w-8"
                            title="More actions"
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={handleDuplicate} className="gap-2">
                            <Copy className="w-3.5 h-3.5" />
                            Duplicate as new draft
                        </DropdownMenuItem>
                        {isSent && (
                            <DropdownMenuItem
                                onSelect={handleResendNonOpeners}
                                className="gap-2"
                            >
                                <MailWarning className="w-3.5 h-3.5" />
                                Resend to non-openers
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={() => setConfirm({ type: "delete" })}
                            disabled={status === "sending"}
                            className="gap-2 text-destructive focus:text-destructive"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete campaign
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Dialog open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
                <DialogContent className="sm:max-w-md">
                    {confirm?.type === "send" && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Send className="w-4 h-4 text-primary" />
                                    Send this campaign now?
                                </DialogTitle>
                                <DialogDescription>
                                    Delivery starts immediately and credits are deducted per
                                    recipient. You can&rsquo;t undo it.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setConfirm(null)}>
                                    Cancel
                                </Button>
                                <Button onClick={performSend}>
                                    <Send className="w-3.5 h-3.5 mr-1.5" />
                                    Send now
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                    {confirm?.type === "delete" && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    Delete this campaign?
                                </DialogTitle>
                                <DialogDescription>
                                    This permanently removes the campaign and its draft. Sent
                                    emails are unaffected. This action can&rsquo;t be undone.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setConfirm(null)}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={performDelete}>
                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                    Delete
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                    {confirm?.type === "cancelSchedule" && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <CalendarX className="w-4 h-4 text-amber-600" />
                                    Cancel scheduled send?
                                </DialogTitle>
                                <DialogDescription>
                                    The campaign will become a draft again. You can re-schedule
                                    or send it manually later.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setConfirm(null)}>
                                    Keep schedule
                                </Button>
                                <Button variant="destructive" onClick={performCancelSchedule}>
                                    Cancel schedule
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
