"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Copy, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import type { SupportGrant } from "@/lib/support/grants"
import type { AuditLogEntry } from "@/lib/support/audit"

type Duration = "1h" | "8h" | "24h" | "7d"
const DURATION_LABELS: Record<Duration, string> = {
    "1h": "1 hour",
    "8h": "8 hours",
    "24h": "24 hours",
    "7d": "7 days",
}

export function SupportAccessClient({
    initialGrants,
    initialAudit,
    isOwner,
}: {
    initialGrants: SupportGrant[]
    initialAudit: AuditLogEntry[]
    isOwner: boolean
}) {
    const [grants, setGrants] = useState<SupportGrant[]>(initialGrants)
    const [audit] = useState<AuditLogEntry[]>(initialAudit)
    const [issueOpen, setIssueOpen] = useState(false)
    const [duration, setDuration] = useState<Duration>("8h")
    const [supportEmail, setSupportEmail] = useState("")
    const [pending, startTransition] = useTransition()
    const [newToken, setNewToken] = useState<{ token: string; expiresAt: string } | null>(null)

    const active = useMemo(() => grants.filter((g) => g.status === "active"), [grants])
    const past = useMemo(() => grants.filter((g) => g.status !== "active"), [grants])

    const reload = async () => {
        const res = await fetch("/api/support-grants", { cache: "no-store" })
        if (res.ok) {
            const data = await res.json()
            setGrants(data.grants as SupportGrant[])
        }
    }

    const issue = () => {
        startTransition(async () => {
            const res = await fetch("/api/support-grants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    duration,
                    supportEmail: supportEmail.trim() || undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "Failed to grant")
                return
            }
            setNewToken({ token: data.token, expiresAt: data.grant.expiresAt })
            setIssueOpen(false)
            await reload()
        })
    }

    const revoke = (id: string) => {
        startTransition(async () => {
            const res = await fetch(`/api/support-grants/${id}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data.error || "Failed to revoke")
                return
            }
            toast.success("Grant revoked")
            await reload()
        })
    }

    return (
        <div className="space-y-6">
            <section className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-base font-semibold flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-violet-500" />
                            Active grants
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Tokens currently usable by the support team.
                        </p>
                    </div>
                    {isOwner && (
                        <Button size="sm" onClick={() => setIssueOpen(true)} disabled={pending}>
                            Grant access
                        </Button>
                    )}
                </div>
                {active.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No active grants.</p>
                ) : (
                    <ul className="space-y-2">
                        {active.map((g) => (
                            <li
                                key={g.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border bg-background/40 p-3"
                            >
                                <div className="text-xs space-y-0.5">
                                    <div className="font-medium text-sm">
                                        {g.scope === "read" ? "Read-only" : "Full access"}
                                        {g.supportEmail && (
                                            <span className="text-muted-foreground ml-2 font-normal">
                                                · {g.supportEmail}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground">
                                        Granted by {g.grantedByEmail} · expires{" "}
                                        {new Date(g.expiresAt).toLocaleString()}
                                    </div>
                                    {g.useCount > 0 && (
                                        <div className="text-muted-foreground">
                                            Used {g.useCount} times
                                            {g.lastUsedAt &&
                                                ` · last ${new Date(g.lastUsedAt).toLocaleString()}`}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => revoke(g.id)}
                                    disabled={pending}
                                    className="self-start sm:self-auto"
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                    Revoke
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-xl border bg-card p-5">
                <div className="mb-3">
                    <h2 className="text-base font-semibold">Past grants</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Revoked or expired.
                    </p>
                </div>
                {past.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">None yet.</p>
                ) : (
                    <ul className="space-y-1.5">
                        {past.slice(0, 10).map((g) => (
                            <li
                                key={g.id}
                                className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded border bg-background/40"
                            >
                                <span>
                                    <span className="font-medium uppercase">{g.status}</span>
                                    <span className="text-muted-foreground ml-2">
                                        {g.scope} · {g.grantedByEmail}
                                    </span>
                                </span>
                                <span className="text-muted-foreground">
                                    {new Date(g.grantedAt).toLocaleDateString()} →{" "}
                                    {new Date(g.expiresAt).toLocaleDateString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-xl border bg-card p-5">
                <h2 className="text-base font-semibold">Support audit log</h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                    Last 50 actions taken by support inside this workspace.
                </p>
                {audit.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No support activity yet.</p>
                ) : (
                    <ul className="space-y-1.5">
                        {audit.map((entry) => (
                            <li key={entry.id} className="text-xs">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span>
                                        <span className="font-medium">{entry.agentEmail}</span>
                                        <span className="text-muted-foreground ml-2">
                                            {entry.action}
                                            {entry.entity && ` · ${entry.entity}`}
                                            {entry.method && ` (${entry.method})`}
                                        </span>
                                    </span>
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        {entry.at ? new Date(entry.at).toLocaleString() : "—"}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Issue dialog */}
            <Dialog open={issueOpen} onOpenChange={(o) => (!o ? setIssueOpen(false) : null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Grant support access</DialogTitle>
                        <DialogDescription>
                            Pick a duration. We&apos;ll generate a one-time token to share
                            with support — they paste it to sign in as your workspace.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">
                                Duration
                            </label>
                            <div className="flex gap-1 mt-1">
                                {(Object.keys(DURATION_LABELS) as Duration[]).map((d) => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setDuration(d)}
                                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
                                            duration === d
                                                ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                                                : "border-border hover:bg-muted/50"
                                        }`}
                                    >
                                        {DURATION_LABELS[d]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">
                                Lock to support agent email (optional)
                            </label>
                            <input
                                type="email"
                                value={supportEmail}
                                onChange={(e) => setSupportEmail(e.target.value)}
                                placeholder="support@vestacrm.com"
                                className="mt-1 w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                                If set, only this email can redeem the token.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIssueOpen(false)} disabled={pending}>
                            Cancel
                        </Button>
                        <Button onClick={issue} disabled={pending}>
                            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Generate token
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Token reveal dialog (one-time) */}
            <Dialog
                open={!!newToken}
                onOpenChange={(o) => (!o ? setNewToken(null) : null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Token created</DialogTitle>
                        <DialogDescription>
                            Copy this token now — it won&apos;t be shown again. Hand it to
                            support via a secure channel (DM, email, password manager).
                        </DialogDescription>
                    </DialogHeader>
                    {newToken && (
                        <div className="space-y-3">
                            <div className="rounded-md border bg-muted/40 p-3 font-mono text-xs break-all">
                                {newToken.token}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Expires {new Date(newToken.expiresAt).toLocaleString()}
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    navigator.clipboard.writeText(newToken.token)
                                    toast.success("Token copied")
                                }}
                            >
                                <Copy className="h-3.5 w-3.5 mr-1.5" />
                                Copy token
                            </Button>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setNewToken(null)}>I&apos;ve copied it</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
