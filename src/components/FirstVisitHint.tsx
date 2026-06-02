"use client"

import { useEffect, useState } from "react"
import { Lightbulb, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { markPageVisited, getVisitedPages } from "@/app/dashboard/first-visit-actions"

/**
 * One-line dismissible hint that appears the first time a user lands on a
 * given page. Stored per-user in Firestore (`users.firstVisits[pageKey]`)
 * with a localStorage cache for an instant decision on subsequent loads.
 *
 * Replaces the OnboardingWizard spotlight tour with something far less
 * intrusive — no overlay, no blocking, just a soft banner that goes away
 * forever once clicked.
 *
 * Usage at the top of a page component:
 *
 *     <FirstVisitHint
 *         pageKey="pipeline"
 *         text="Drag deals between stages. Click + to add a new deal."
 *     />
 */
export function FirstVisitHint({
    pageKey,
    text,
}: {
    pageKey: string
    text: string
}) {
    const [show, setShow] = useState<boolean | null>(null)

    useEffect(() => {
        const lsKey = `firstVisit:${pageKey}`

        // Instant decision from localStorage.
        if (typeof window !== "undefined") {
            const cached = window.localStorage.getItem(lsKey)
            if (cached === "seen") {
                setShow(false)
                return
            }
        }

        // Otherwise hit the server and sync.
        getVisitedPages().then((pages) => {
            const seen = pages.includes(pageKey)
            if (seen && typeof window !== "undefined") {
                window.localStorage.setItem(lsKey, "seen")
            }
            setShow(!seen)
        }).catch(() => setShow(false))
    }, [pageKey])

    if (!show) return null

    const dismiss = () => {
        setShow(false)
        if (typeof window !== "undefined") {
            window.localStorage.setItem(`firstVisit:${pageKey}`, "seen")
        }
        // Fire-and-forget — even if it fails, localStorage prevents re-show.
        markPageVisited(pageKey).catch(() => {})
    }

    return (
        <div className="flex items-start gap-3 rounded-lg border bg-primary/5 border-primary/20 px-4 py-3 mb-4 animate-in fade-in slide-in-from-top-1 duration-300">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm flex-1 leading-relaxed">{text}</p>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 -my-0.5 text-muted-foreground hover:text-foreground"
                onClick={dismiss}
                aria-label="Dismiss hint"
            >
                <X className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}
