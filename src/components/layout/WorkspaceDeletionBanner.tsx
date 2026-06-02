"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { getDeletionStatus } from "@/app/settings/workspace/danger-zone/actions"

/**
 * Top-of-app banner shown when the workspace is scheduled for deletion.
 * Lives in the AppShell so every authenticated route surfaces it. Fetches
 * once per mount — cheap enough since deletion is rare and the request is
 * already part of the page bootstrap.
 */
export function WorkspaceDeletionBanner() {
    const [scheduled, setScheduled] = useState(false)
    const [purgeAt, setPurgeAt] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        getDeletionStatus()
            .then((status) => {
                if (cancelled) return
                setScheduled(status.scheduled)
                setPurgeAt(status.purgeAt)
            })
            .catch(() => {
                // Silently ignore — banner is non-critical.
            })
        return () => {
            cancelled = true
        }
    }, [])

    if (!scheduled) return null

    const purgeDate = purgeAt
        ? new Date(purgeAt).toLocaleDateString(undefined, {
              dateStyle: "long",
          })
        : null
    const daysLeft = purgeAt
        ? Math.max(
              0,
              Math.ceil(
                  (new Date(purgeAt).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24),
              ),
          )
        : null

    return (
        <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2 flex items-center gap-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <span className="flex-1 min-w-0 truncate text-foreground">
                <span className="font-semibold text-destructive">Deletion scheduled.</span>{" "}
                This workspace will be permanently purged
                {purgeDate && ` on ${purgeDate}`}
                {daysLeft !== null && ` (${daysLeft} day${daysLeft === 1 ? "" : "s"} left)`}.
            </span>
            <Link
                href="/settings/workspace/danger-zone"
                className="font-medium text-destructive hover:underline whitespace-nowrap shrink-0"
            >
                Review or cancel
            </Link>
        </div>
    )
}
