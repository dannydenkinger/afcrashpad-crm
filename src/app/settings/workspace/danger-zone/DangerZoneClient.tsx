"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Download, Loader2, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import {
    cancelWorkspaceDeletion,
    getDeletionStatus,
    requestWorkspaceDeletion,
} from "./actions"

export function DangerZoneClient() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [scheduled, setScheduled] = useState(false)
    const [purgeAt, setPurgeAt] = useState<string | null>(null)
    const [requestedByEmail, setRequestedByEmail] = useState<string | null>(null)
    const [workspaceName, setWorkspaceName] = useState("")
    const [confirmText, setConfirmText] = useState("")
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        getDeletionStatus().then((status) => {
            setScheduled(status.scheduled)
            setPurgeAt(status.purgeAt)
            setRequestedByEmail(status.requestedByEmail)
            setWorkspaceName(status.workspaceName)
            setLoading(false)
        })
    }, [])

    const handleDelete = () => {
        startTransition(async () => {
            const res = await requestWorkspaceDeletion(confirmText)
            if (!res.success) {
                toast.error(res.error || "Failed to schedule deletion")
                return
            }
            toast.success("Workspace deletion scheduled")
            const status = await getDeletionStatus()
            setScheduled(status.scheduled)
            setPurgeAt(status.purgeAt)
            setRequestedByEmail(status.requestedByEmail)
            setConfirmText("")
            router.refresh()
        })
    }

    const handleCancel = () => {
        startTransition(async () => {
            const res = await cancelWorkspaceDeletion()
            if (!res.success) {
                toast.error(res.error || "Failed to cancel deletion")
                return
            }
            toast.success("Deletion canceled")
            const status = await getDeletionStatus()
            setScheduled(status.scheduled)
            setPurgeAt(status.purgeAt)
            setRequestedByEmail(status.requestedByEmail)
            router.refresh()
        })
    }

    if (loading) {
        return <div className="text-sm text-muted-foreground">Loading…</div>
    }

    return (
        <div className="space-y-6">
            <div className="rounded-lg border bg-muted/20 p-4 flex items-start gap-3">
                <Download className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Export your data first</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Before deleting, download a complete JSON backup of your contacts, deals, notes, tasks, settings and more.
                        This is your GDPR/CCPA-compliant data export.
                    </p>
                    <Link href="/settings/data/backup" className="inline-block mt-2">
                        <Button variant="outline" size="sm">
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Download workspace backup
                        </Button>
                    </Link>
                </div>
            </div>

            {scheduled ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-destructive">
                                Deletion scheduled
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                Workspace <span className="font-medium text-foreground">{workspaceName}</span>{" "}
                                will be permanently purged on{" "}
                                <span className="font-medium text-foreground">
                                    {purgeAt ? new Date(purgeAt).toLocaleDateString(undefined, { dateStyle: "long" }) : "—"}
                                </span>
                                {requestedByEmail && (
                                    <> by request of <span className="font-medium text-foreground">{requestedByEmail}</span></>
                                )}.
                                You can cancel anytime before then.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        disabled={isPending}
                    >
                        {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        Cancel deletion
                    </Button>
                </div>
            ) : (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-destructive">
                                Delete this workspace
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                Permanently removes every contact, deal, note, task, document, integration credential,
                                and member of this workspace. After confirming, you have a 30-day grace period to cancel —
                                after that, deletion is irreversible. Owner-only.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="confirm-name" className="text-xs">
                            Type <span className="font-mono text-foreground">{workspaceName}</span> to confirm
                        </Label>
                        <Input
                            id="confirm-name"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder={workspaceName}
                            autoComplete="off"
                            className="font-mono"
                        />
                    </div>

                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={isPending || confirmText.trim() !== workspaceName.trim()}
                    >
                        {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        Schedule deletion
                    </Button>
                </div>
            )}
        </div>
    )
}
