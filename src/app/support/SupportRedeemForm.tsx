"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, LogOut, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SupportRedeemForm({
    activeSession,
}: {
    activeSession: { workspaceId: string; expiresAt: string; grantedBy: string } | null
}) {
    const router = useRouter()
    const [token, setToken] = useState("")
    const [pending, startTransition] = useTransition()

    const redeem = () => {
        if (token.trim().length < 20) {
            toast.error("Paste the full token")
            return
        }
        startTransition(async () => {
            const res = await fetch("/api/support-grants/redeem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: token.trim() }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data.error || "Token rejected")
                return
            }
            toast.success("Support session active")
            router.push("/dashboard")
            router.refresh()
        })
    }

    const end = () => {
        startTransition(async () => {
            const res = await fetch("/api/support-grants/end", { method: "POST" })
            if (!res.ok) {
                toast.error("Couldn't end session")
                return
            }
            toast.success("Support session ended")
            router.refresh()
        })
    }

    if (activeSession) {
        return (
            <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="shrink-0 p-2 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                        <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="font-semibold text-sm">Session active</h2>
                        <p className="text-xs text-muted-foreground">
                            You&apos;re acting inside workspace{" "}
                            <code className="text-[11px] bg-muted px-1 rounded">
                                {activeSession.workspaceId.slice(0, 12)}…
                            </code>
                            , granted by {activeSession.grantedBy}.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Expires {new Date(activeSession.expiresAt).toLocaleString()}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/dashboard")}
                    >
                        Go to workspace
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={end}
                        disabled={pending}
                        className="text-rose-600 dark:text-rose-400"
                    >
                        {pending ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                            <LogOut className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        End session
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
                <h2 className="font-semibold text-sm">Paste a grant token</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                    The workspace owner generates this from{" "}
                    <code className="text-[11px]">Settings → Workspace → Support access</code>.
                </p>
            </div>
            <textarea
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste the support-access token here"
                className="w-full min-h-[100px] p-3 rounded-md border bg-muted/20 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                autoFocus
                disabled={pending}
            />
            <Button onClick={redeem} disabled={pending || token.trim().length < 20} className="w-full">
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start support session
            </Button>
        </div>
    )
}
