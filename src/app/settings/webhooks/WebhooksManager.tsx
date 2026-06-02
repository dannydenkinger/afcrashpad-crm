"use client"

import { useEffect, useState, useTransition } from "react"
import {
    Plus,
    Trash2,
    Loader2,
    Send,
    Eye,
    EyeOff,
    Copy,
    Check,
    RefreshCw,
    AlertCircle,
    Webhook,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    listWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    rotateSecret,
    sendTestEvent,
} from "./actions"
import { ALL_WEBHOOK_EVENTS, type WebhookEvent, type WebhookSubscription, type WebhookFormat } from "@/lib/webhooks/types"

/**
 * Outbound webhooks settings UI. Lets workspace admins register receiver
 * URLs that will be POSTed to whenever specific CRM events happen
 * (contact.created, deal.stage_changed, etc).
 *
 * Each subscription gets:
 *   - A list of events it cares about (multi-select)
 *   - An HMAC secret used to sign every payload — receivers verify with
 *     `HMAC-SHA256(secret, request_body)` and compare against the
 *     X-Vesta-Signature header.
 *   - Toggle to enable/disable without deleting
 *   - "Send test" button so the operator can verify their receiver
 *     works without waiting for a real CRM event.
 */
export function WebhooksManager() {
    const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [newUrl, setNewUrl] = useState("")
    const [newEvents, setNewEvents] = useState<WebhookEvent[]>([])
    const [newFormat, setNewFormat] = useState<WebhookFormat>("vesta")
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [, startTransition] = useTransition()
    /** When a brand-new webhook is created, surface the secret in a dialog
     *  so the admin can copy it immediately. We only show the secret in the
     *  list view when they explicitly toggle it. */
    const [newSecretDialog, setNewSecretDialog] = useState<{ url: string; secret: string } | null>(null)

    const refresh = async () => {
        const res = await listWebhooks()
        if (res.success && res.webhooks) setWebhooks(res.webhooks)
        setLoading(false)
    }

    useEffect(() => {
        refresh()
    }, [])

    const handleCreate = async () => {
        if (!newUrl.trim() || newEvents.length === 0) {
            toast.error("Add a URL and pick at least one event")
            return
        }
        setCreating(true)
        const res = await createWebhook({ url: newUrl.trim(), events: newEvents, format: newFormat })
        setCreating(false)
        if (!res.success) {
            toast.error(res.error || "Failed to create webhook")
            return
        }
        toast.success("Webhook created")
        setCreateOpen(false)
        setNewSecretDialog({ url: newUrl.trim(), secret: res.secret || "" })
        setNewUrl("")
        setNewEvents([])
        setNewFormat("vesta")
        await refresh()
    }

    const handleToggle = (id: string, enabled: boolean) => {
        setWebhooks(ws => ws.map(w => w.id === id ? { ...w, enabled } : w))
        startTransition(async () => {
            const res = await updateWebhook({ id, enabled })
            if (!res.success) {
                toast.error("Failed to toggle webhook")
                refresh()
            }
        })
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this webhook? Receivers will stop getting events.")) return
        const res = await deleteWebhook(id)
        if (!res.success) {
            toast.error("Failed to delete")
            return
        }
        toast.success("Webhook deleted")
        await refresh()
    }

    const handleRotate = async (id: string) => {
        if (!confirm("Rotate the secret? Your receiver will need to be updated with the new value or signature checks will fail.")) return
        const res = await rotateSecret(id)
        if (!res.success || !res.secret) {
            toast.error(res.error || "Failed to rotate")
            return
        }
        toast.success("Secret rotated")
        await refresh()
        setNewSecretDialog({ url: webhooks.find(w => w.id === id)?.url || "", secret: res.secret })
    }

    const handleTest = async (id: string) => {
        const res = await sendTestEvent(id)
        if (!res.success) {
            toast.error("Failed to send test")
            return
        }
        toast.success("Test event sent — check your receiver logs")
    }

    const handleCopySecret = async (id: string, secret: string) => {
        await navigator.clipboard.writeText(secret)
        setCopiedId(id)
        toast.success("Secret copied")
        setTimeout(() => setCopiedId(null), 2000)
    }

    const toggleSecretVisible = (id: string) => {
        setShowSecrets(s => ({ ...s, [id]: !s[id] }))
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading webhooks…
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Explainer */}
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-start gap-2">
                    <Webhook className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                    <div>
                        <p className="font-medium text-foreground">How webhooks work</p>
                        <p className="mt-1">
                            Register a URL and pick events. Whenever something happens in this workspace
                            (a contact is created, a deal moves stage, a task is completed), Vesta POSTs
                            a JSON payload to your URL. Each request is signed with the subscription&apos;s
                            secret using HMAC-SHA256 — verify the <code className="px-1 py-0.5 rounded bg-muted text-foreground">X-Vesta-Signature</code> header matches{" "}
                            <code className="px-1 py-0.5 rounded bg-muted text-foreground">sha256=&lt;hmac&gt;</code> before trusting the payload.
                            Failed deliveries retry up to 3 times with exponential backoff.
                        </p>
                    </div>
                </div>
            </div>

            {/* List */}
            {webhooks.length === 0 ? (
                <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                    No webhooks yet. Add one to start sending CRM events to your own systems.
                </div>
            ) : (
                <div className="space-y-3">
                    {webhooks.map((w) => (
                        <div key={w.id} className="rounded-lg border bg-card p-3 space-y-3">
                            {/* Header row */}
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded truncate max-w-[400px]">
                                            {w.url}
                                        </code>
                                        {w.enabled ? (
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Paused
                                            </span>
                                        )}
                                        {w.format === "slack" && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                                                Slack
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground tabular-nums">
                                        <span>{w.deliveryCount || 0} delivered</span>
                                        {(w.failureCount ?? 0) > 0 && (
                                            <span className="text-rose-600 dark:text-rose-400">
                                                {w.failureCount} failed
                                            </span>
                                        )}
                                        {w.lastDeliveredAt && (
                                            <span>last: {new Date(w.lastDeliveredAt).toLocaleString()}</span>
                                        )}
                                    </div>
                                    {w.lastError && (
                                        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                                            <AlertCircle className="h-3 w-3" /> {w.lastError}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Switch
                                        checked={w.enabled}
                                        onCheckedChange={(c) => handleToggle(w.id, c)}
                                        aria-label="Enable/disable webhook"
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={() => handleTest(w.id)}
                                        title="Send test event"
                                    >
                                        <Send className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(w.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Events */}
                            <div className="flex flex-wrap gap-1.5">
                                {w.events.map((e) => (
                                    <span
                                        key={e}
                                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                                    >
                                        {e}
                                    </span>
                                ))}
                            </div>

                            {/* Secret */}
                            <div className="flex items-center gap-2">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                                    Secret
                                </Label>
                                <Input
                                    readOnly
                                    type={showSecrets[w.id] ? "text" : "password"}
                                    value={w.secret}
                                    className="font-mono text-xs h-8"
                                    onFocus={(e) => e.currentTarget.select()}
                                />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 shrink-0"
                                    onClick={() => toggleSecretVisible(w.id)}
                                >
                                    {showSecrets[w.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 shrink-0"
                                    onClick={() => handleCopySecret(w.id, w.secret)}
                                >
                                    {copiedId === w.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 shrink-0"
                                    onClick={() => handleRotate(w.id)}
                                    title="Rotate secret"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Button onClick={() => setCreateOpen(true)} size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add webhook
            </Button>

            {/* Create dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New webhook</DialogTitle>
                        <DialogDescription>
                            Vesta will POST signed JSON payloads to your URL whenever the selected events
                            happen in this workspace.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="webhook-url" className="text-xs">Endpoint URL</Label>
                            <Input
                                id="webhook-url"
                                type="url"
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                placeholder="https://example.com/hooks/vesta"
                                disabled={creating}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Payload format</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setNewFormat("vesta")}
                                    className={`text-left rounded-md border p-2 transition-colors ${
                                        newFormat === "vesta" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                                    }`}
                                >
                                    <div className="text-xs font-semibold">Vesta JSON</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                        Standard signed envelope. Use this for your own backend, Zapier, n8n, Make.
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewFormat("slack")}
                                    className={`text-left rounded-md border p-2 transition-colors ${
                                        newFormat === "slack" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                                    }`}
                                >
                                    <div className="text-xs font-semibold">Slack message</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                        Paste a Slack incoming-webhook URL. Events render as readable Slack messages.
                                    </div>
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Events</Label>
                            <div className="space-y-1 max-h-[260px] overflow-y-auto rounded-md border p-2">
                                {ALL_WEBHOOK_EVENTS.map((e) => {
                                    const checked = newEvents.includes(e.event)
                                    return (
                                        <label
                                            key={e.event}
                                            className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    setNewEvents((prev) =>
                                                        prev.includes(e.event)
                                                            ? prev.filter((x) => x !== e.event)
                                                            : [...prev, e.event],
                                                    )
                                                }}
                                                className="mt-0.5"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <code className="text-[11px] font-mono">{e.event}</code>
                                                    <span className="text-xs">{e.label}</span>
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">{e.description}</div>
                                            </div>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={creating || !newUrl.trim() || newEvents.length === 0}>
                            {creating && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                            Create webhook
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Secret reveal dialog (for new + rotated secrets) */}
            <Dialog open={!!newSecretDialog} onOpenChange={(o) => { if (!o) setNewSecretDialog(null) }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Secret generated</DialogTitle>
                        <DialogDescription>
                            Copy this secret into your receiver now. You can always view it again from the
                            webhook list.
                        </DialogDescription>
                    </DialogHeader>
                    {newSecretDialog && (
                        <div className="space-y-3 py-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">URL</Label>
                                <code className="block text-xs font-mono bg-muted/50 p-2 rounded break-all">
                                    {newSecretDialog.url}
                                </code>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Secret</Label>
                                <div className="flex gap-2">
                                    <code className="flex-1 text-xs font-mono bg-muted/50 p-2 rounded break-all">
                                        {newSecretDialog.secret}
                                    </code>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(newSecretDialog.secret)
                                            toast.success("Secret copied")
                                        }}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setNewSecretDialog(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
