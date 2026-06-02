"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Star, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { requestReview } from "@/app/settings/reputation/actions"

/**
 * Sends a review-request email to a contact using the workspace's configured
 * review URLs. No-ops with an actionable error if no URLs are set up yet.
 */
export function RequestReviewButton({
    contactId,
    onSent,
}: {
    contactId: string
    onSent?: () => void
}) {
    const [sending, setSending] = useState(false)

    const handleClick = async () => {
        if (!confirm("Send a review request email to this contact?")) return
        setSending(true)
        const res = await requestReview({ contactId })
        setSending(false)
        if (res.success) {
            toast.success("Review request sent")
            onSent?.()
        } else {
            toast.error(res.error || "Failed to send review request")
        }
    }

    return (
        <div className="mt-1">
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleClick}
                disabled={sending}
            >
                {sending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                    <Star className="h-3 w-3 text-amber-500" />
                )}
                Request review
            </Button>
        </div>
    )
}
