"use client"

import { useState, useTransition } from "react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { MessageCircle, Loader2, Bug, Lightbulb, MessageSquare } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { submitFeedback, type FeedbackKind } from "@/app/feedback/actions"
import { cn } from "@/lib/utils"

const KINDS: { value: FeedbackKind; label: string; icon: typeof Bug }[] = [
    { value: "bug", label: "Bug", icon: Bug },
    { value: "idea", label: "Idea", icon: Lightbulb },
    { value: "other", label: "Other", icon: MessageSquare },
]

export function FeedbackDialog({
    open,
    onOpenChange,
    defaultKind = "other",
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultKind?: FeedbackKind
}) {
    const pathname = usePathname()
    const [kind, setKind] = useState<FeedbackKind>(defaultKind)
    const [message, setMessage] = useState("")
    const [isPending, startTransition] = useTransition()

    const close = () => {
        if (isPending) return
        setMessage("")
        setKind(defaultKind)
        onOpenChange(false)
    }

    const submit = () => {
        if (message.trim().length < 10) {
            toast.error("Add a bit more detail so we can help (at least 10 characters)")
            return
        }
        startTransition(async () => {
            const pageUrl =
                typeof window !== "undefined"
                    ? `${window.location.origin}${pathname || window.location.pathname}`
                    : pathname || ""
            const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : ""
            const viewport =
                typeof window !== "undefined"
                    ? `${window.innerWidth}x${window.innerHeight}`
                    : ""

            const res = await submitFeedback({
                kind,
                message: message.trim(),
                pageUrl,
                userAgent,
                viewport,
            })

            if (!res.success) {
                toast.error(res.error || "Couldn't send the feedback")
                return
            }
            toast.success("Thanks — the team will take a look.")
            setMessage("")
            setKind(defaultKind)
            onOpenChange(false)
        })
    }

    return (
        <Dialog open={open} onOpenChange={(o) => (!o ? close() : onOpenChange(true))}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Share feedback
                    </DialogTitle>
                    <DialogDescription>
                        Bug, idea, or just a thought — we&apos;ll see it. We&apos;ll know the
                        page you&apos;re on, your workspace, and your browser automatically.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="flex gap-2">
                        {KINDS.map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setKind(value)}
                                disabled={isPending}
                                className={cn(
                                    "flex-1 inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                                    kind === value
                                        ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                                        : "border-border bg-background hover:bg-muted/50",
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>

                    <textarea
                        className="w-full min-h-[140px] p-3 rounded-md border bg-muted/20 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                        placeholder={
                            kind === "bug"
                                ? "What went wrong? Include steps if you can — \"clicked Save on a contact, page froze, no toast\"."
                                : kind === "idea"
                                  ? "What would make AFCrashpad better for you? It can be small — a button, a shortcut, a missing field."
                                  : "Tell us anything — what's working, what's not, what's confusing."
                        }
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        autoFocus
                        disabled={isPending}
                        maxLength={5000}
                    />
                    <p className="text-[11px] text-muted-foreground text-right">
                        {message.length}/5000
                    </p>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={close} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={isPending || message.trim().length < 10}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
