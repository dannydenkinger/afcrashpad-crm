"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldAlert } from "lucide-react"
import { getActiveSupportInfo, type SupportSessionInfo } from "@/app/support/actions"

/**
 * Red banner displayed on every authed page while the current
 * agent is in an active support session. Polls a server action
 * because useSession() doesn't see the cookie-backed augmentation
 * applied in getAuthSession.
 *
 * Renders nothing when no support session is active.
 */
export function SupportSessionBanner() {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [info, setInfo] = useState<SupportSessionInfo | null>(null)
    const [remaining, setRemaining] = useState<string>("")

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const next = await getActiveSupportInfo()
                if (!cancelled) setInfo(next)
            } catch {
                if (!cancelled) setInfo(null)
            }
        }
        load()
        const id = setInterval(load, 60_000)
        return () => {
            cancelled = true
            clearInterval(id)
        }
    }, [])

    useEffect(() => {
        if (!info?.expiresAt) return
        const tick = () => {
            const ms = new Date(info.expiresAt).getTime() - Date.now()
            if (ms <= 0) {
                setRemaining("expired")
                return
            }
            const mins = Math.floor(ms / 60000)
            const hours = Math.floor(mins / 60)
            if (hours > 24) {
                setRemaining(`${Math.floor(hours / 24)}d ${hours % 24}h left`)
            } else if (hours > 0) {
                setRemaining(`${hours}h ${mins % 60}m left`)
            } else {
                setRemaining(`${mins}m left`)
            }
        }
        tick()
        const id = setInterval(tick, 30_000)
        return () => clearInterval(id)
    }, [info?.expiresAt])

    if (!info) return null

    const endSession = () => {
        startTransition(async () => {
            await fetch("/api/support-grants/end", { method: "POST" }).catch(() => null)
            setInfo(null)
            router.refresh()
            router.push("/support")
        })
    }

    return (
        <div className="bg-rose-500/15 border-b border-rose-500/40 text-rose-900 dark:text-rose-200 px-4 py-2 text-xs flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 min-w-0 truncate">
                <span className="font-semibold">Support session active.</span>{" "}
                Acting inside workspace{" "}
                <code className="text-[11px] bg-rose-500/15 px-1 rounded">
                    {info.workspaceId.slice(0, 12)}…
                </code>
                {info.grantedByEmail && (
                    <span className="text-rose-800/80 dark:text-rose-200/80 ml-2">
                        · granted by {info.grantedByEmail}
                    </span>
                )}
                {remaining && (
                    <span className="text-rose-800/80 dark:text-rose-200/80 ml-2">
                        · {remaining}
                    </span>
                )}
            </span>
            <button
                type="button"
                onClick={endSession}
                disabled={pending}
                className="font-semibold hover:underline whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-50"
            >
                {pending && <Loader2 className="h-3 w-3 animate-spin" />}
                End session
            </button>
        </div>
    )
}
