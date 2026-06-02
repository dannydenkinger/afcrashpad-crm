"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MessageCircle, Sparkles } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * Shown once per user (per browser) on their first authenticated
 * page load. Points at the Feedback button in the top header and
 * promises a fast response loop. Reset by clearing localStorage
 * keyed on `vesta:feedback-intro-seen:<userId>`.
 *
 * Remove this component (delete the file + AppShell mounts) once
 * the active tester phase wraps and you're past the point of
 * needing this nudge.
 */
export function FeedbackWelcomeModal() {
    const { data: session, status } = useSession()
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (status !== "authenticated") return
        const userId = (session?.user as { id?: string } | undefined)?.id
        if (!userId) return
        const key = `vesta:feedback-intro-seen:${userId}`
        try {
            if (typeof window === "undefined") return
            if (window.localStorage.getItem(key)) return
            // Slight delay so it doesn't crash into the first paint —
            // gives the dashboard a moment to render first.
            const t = window.setTimeout(() => setOpen(true), 800)
            return () => window.clearTimeout(t)
        } catch {
            // localStorage blocked (private window, etc.) — skip the intro
        }
    }, [status, session?.user])

    const dismiss = () => {
        const userId = (session?.user as { id?: string } | undefined)?.id
        if (userId) {
            try {
                window.localStorage.setItem(`vesta:feedback-intro-seen:${userId}`, "1")
            } catch {
                // ignore
            }
        }
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={(o) => (!o ? dismiss() : null)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <DialogTitle className="text-center text-xl">
                        Help shape Vesta
                    </DialogTitle>
                    <DialogDescription className="text-center pt-1">
                        You&apos;re one of our first users — your feedback drives what we
                        build and fix next.
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                    <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5 p-1.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <MessageCircle className="h-3.5 w-3.5" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-medium text-foreground">
                                Look for the &ldquo;Feedback&rdquo; pill in the top header.
                            </p>
                            <p className="text-muted-foreground text-[13px] leading-snug">
                                Click it anytime to report a bug, share an idea, or just
                                tell us what&apos;s confusing. We read every message and
                                respond fast.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={dismiss} className="w-full">
                        Got it
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
