"use client"

import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { FeedbackDialog } from "@/components/FeedbackDialog"

/**
 * "Share feedback" button shown in the top header next to the
 * theme toggle. Desktop renders the full pill; mobile is icon-only
 * to fit the tighter header. Wraps the same FeedbackDialog as the
 * sidebar dropdown entry.
 */
export function FeedbackHeaderButton({
    iconOnly = false,
}: {
    iconOnly?: boolean
}) {
    const [open, setOpen] = useState(false)
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Share feedback"
                className={
                    iconOnly
                        ? "p-2 rounded-full hover:bg-amber-500/10 active:bg-amber-500/20 transition-colors touch-manipulation text-amber-600 dark:text-amber-400"
                        : "inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 transition-colors"
                }
            >
                <MessageCircle className={iconOnly ? "h-5 w-5" : "h-3.5 w-3.5"} />
                {!iconOnly && <span>Feedback</span>}
            </button>
            <FeedbackDialog open={open} onOpenChange={setOpen} />
        </>
    )
}
