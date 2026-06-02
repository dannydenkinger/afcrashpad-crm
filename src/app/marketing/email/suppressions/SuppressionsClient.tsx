"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
    AlertTriangle,
    Download,
    Loader2,
    Plus,
    Search,
    Trash2,
    Upload,
    X,
} from "lucide-react"
import {
    addSuppressionAction,
    bulkAddSuppressionsAction,
    bulkRemoveSuppressionsAction,
    removeSuppressionAction,
} from "./actions"
import type { SuppressionEntry } from "@/lib/email/suppressions"

const REASON_STYLES: Record<string, string> = {
    bounce: "bg-red-500/10 text-red-700 dark:text-red-400",
    complaint: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    unsubscribe: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    manual: "bg-muted text-muted-foreground",
}

const REASON_LABELS: Record<string, string> = {
    all: "All",
    bounce: "Bounces",
    complaint: "Complaints",
    unsubscribe: "Unsubscribes",
    manual: "Manual",
}

export function SuppressionsClient({
    initialEntries,
}: {
    initialEntries: SuppressionEntry[]
}) {
    const router = useRouter()
    const [entries, setEntries] = useState(initialEntries)
    const [filter, setFilter] = useState("")
    const [reasonFilter, setReasonFilter] = useState<string>("all")
    const [newEmail, setNewEmail] = useState("")
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [importOpen, setImportOpen] = useState(false)
    const [confirmRemove, setConfirmRemove] = useState<{
        emails: string[]
        bulk: boolean
    } | null>(null)
    const [isPending, startTransition] = useTransition()

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: entries.length }
        entries.forEach((e) => {
            c[e.reason] = (c[e.reason] ?? 0) + 1
        })
        return c
    }, [entries])

    const visible = useMemo(() => {
        const lowered = filter.trim().toLowerCase()
        return entries.filter((e) => {
            if (reasonFilter !== "all" && e.reason !== reasonFilter) return false
            if (lowered && !e.email.toLowerCase().includes(lowered)) return false
            return true
        })
    }, [entries, filter, reasonFilter])

    const allVisibleSelected =
        visible.length > 0 && visible.every((e) => selected.has(e.email))

    const toggleAllVisible = () => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (allVisibleSelected) {
                visible.forEach((e) => next.delete(e.email))
            } else {
                visible.forEach((e) => next.add(e.email))
            }
            return next
        })
    }

    const handleAdd = () => {
        const email = newEmail.trim().toLowerCase()
        if (!email || !email.includes("@")) {
            toast.error("Enter a valid email")
            return
        }
        startTransition(async () => {
            const res = await addSuppressionAction({
                email,
                reason: "manual",
                source: "added by user from suppressions page",
            })
            if (!res.success) {
                toast.error(res.error || "Failed to add")
                return
            }
            setNewEmail("")
            toast.success(`${email} suppressed`)
            router.refresh()
        })
    }

    const handleRemove = (email: string) => {
        setConfirmRemove({ emails: [email], bulk: false })
    }

    const handleBulkRemove = () => {
        if (selected.size === 0) return
        setConfirmRemove({ emails: Array.from(selected), bulk: true })
    }

    const performRemove = () => {
        if (!confirmRemove) return
        const emails = confirmRemove.emails
        const bulk = confirmRemove.bulk
        setConfirmRemove(null)
        startTransition(async () => {
            if (bulk) {
                const res = await bulkRemoveSuppressionsAction({ emails })
                if (!res.success) {
                    toast.error("Bulk remove failed")
                    return
                }
                setEntries((prev) => prev.filter((e) => !emails.includes(e.email)))
                setSelected(new Set())
                toast.success(`Removed ${res.removed} addresses`)
            } else {
                const res = await removeSuppressionAction({ email: emails[0] })
                if (!res.success) {
                    toast.error(res.error || "Failed to remove")
                    return
                }
                setEntries((prev) => prev.filter((e) => e.email !== emails[0]))
                toast.success("Removed")
            }
        })
    }

    const handleExport = () => {
        const rows = [
            ["email", "reason", "source", "added_at"],
            ...visible.map((e) => [
                e.email,
                e.reason,
                e.source ?? "",
                new Date(e.addedAt).toISOString(),
            ]),
        ]
        const csv = rows
            .map((r) =>
                r
                    .map((cell) =>
                        /[",\n]/.test(String(cell))
                            ? `"${String(cell).replace(/"/g, '""')}"`
                            : String(cell),
                    )
                    .join(","),
            )
            .join("\n")
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `suppressions-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${visible.length} addresses`)
    }

    return (
        <div className="space-y-4">
            {/* Top toolbar — search, add manually, import/export */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter by email…"
                        className="pl-9 pr-8 h-9"
                    />
                    {filter && (
                        <button
                            type="button"
                            onClick={() => setFilter("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Clear search"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Add: name@example.com"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleAdd()
                        }}
                        disabled={isPending}
                        className="h-9 w-60"
                    />
                    <Button
                        onClick={handleAdd}
                        disabled={isPending || !newEmail.trim()}
                        size="sm"
                        title="Suppress this email"
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                    </Button>
                </div>
                <div className="h-6 w-px bg-border" />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportOpen(true)}
                    disabled={isPending}
                    className="gap-1.5"
                    title="Bulk import emails (paste a list or CSV)"
                >
                    <Upload className="w-3.5 h-3.5" />
                    Import
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={isPending || visible.length === 0}
                    className="gap-1.5"
                    title="Download visible entries as CSV"
                >
                    <Download className="w-3.5 h-3.5" />
                    Export
                </Button>
            </div>

            {/* Reason facet pills */}
            <div className="flex items-center gap-1 flex-wrap">
                {(["all", "bounce", "complaint", "unsubscribe", "manual"] as const).map(
                    (r) => {
                        const count = counts[r] ?? 0
                        if (r !== "all" && count === 0) return null
                        const active = reasonFilter === r
                        return (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setReasonFilter(r)}
                                className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                                    active
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {REASON_LABELS[r]}
                                <span className="opacity-70 tabular-nums">{count}</span>
                            </button>
                        )
                    },
                )}
            </div>

            {/* Bulk action bar (visible only when something is selected) */}
            {selected.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-md text-sm">
                    <span className="text-xs font-medium">
                        {selected.size} selected
                    </span>
                    <div className="flex-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(new Set())}
                        className="h-7"
                    >
                        Clear
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkRemove}
                        disabled={isPending}
                        className="h-7 gap-1.5"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove {selected.size}
                    </Button>
                </div>
            )}

            {/* Entries list */}
            {visible.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground border border-dashed rounded-md">
                    {entries.length === 0
                        ? "No suppressed addresses yet."
                        : "No matches for these filters."}
                </div>
            ) : (
                <div className="border rounded-md">
                    <div className="flex items-center gap-3 py-2 px-3 border-b bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleAllVisible}
                            aria-label={
                                allVisibleSelected ? "Unselect all" : "Select all visible"
                            }
                            className="cursor-pointer"
                        />
                        <span className="w-24 text-center">Reason</span>
                        <span className="flex-1">Email</span>
                        <span className="shrink-0">Added</span>
                        <span className="w-7" />
                    </div>
                    <div className="divide-y max-h-[640px] overflow-y-auto">
                        {visible.map((e) => (
                            <div
                                key={e.email}
                                className="flex items-center gap-3 py-2.5 px-3 text-sm hover:bg-muted/30 transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(e.email)}
                                    onChange={() => {
                                        setSelected((prev) => {
                                            const next = new Set(prev)
                                            if (next.has(e.email)) next.delete(e.email)
                                            else next.add(e.email)
                                            return next
                                        })
                                    }}
                                    aria-label={`Select ${e.email}`}
                                    className="cursor-pointer"
                                />
                                <span
                                    className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded shrink-0 w-24 text-center ${
                                        REASON_STYLES[e.reason] ?? REASON_STYLES.manual
                                    }`}
                                >
                                    {e.reason}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="truncate font-mono text-[13px]">
                                        {e.email}
                                    </div>
                                    {e.source && (
                                        <div className="text-[11px] text-muted-foreground truncate">
                                            {e.source}
                                        </div>
                                    )}
                                </div>
                                <div className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                                    {new Date(e.addedAt).toLocaleDateString()}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemove(e.email)}
                                    disabled={isPending}
                                    title="Remove from suppression list"
                                    className="shrink-0 h-7 w-7"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <BulkImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                onDone={(added) => {
                    setImportOpen(false)
                    if (added > 0) router.refresh()
                }}
            />

            <ConfirmRemoveDialog
                payload={confirmRemove}
                onCancel={() => setConfirmRemove(null)}
                onConfirm={performRemove}
            />
        </div>
    )
}

function BulkImportDialog({
    open,
    onOpenChange,
    onDone,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onDone: (added: number) => void
}) {
    const [text, setText] = useState("")
    const [reason, setReason] = useState<
        "bounce" | "complaint" | "unsubscribe" | "manual"
    >("manual")
    const [isPending, startTransition] = useTransition()

    const emails = useMemo(() => {
        const raw = text
            .split(/[\s,;\n\r]+/)
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.includes("@"))
        return Array.from(new Set(raw))
    }, [text])

    const handleSubmit = () => {
        if (emails.length === 0) {
            toast.error("Paste at least one valid email address")
            return
        }
        startTransition(async () => {
            const res = await bulkAddSuppressionsAction({
                emails,
                reason,
                source: `bulk import (${reason})`,
            })
            if (!res.success) {
                toast.error(res.error || "Import failed")
                return
            }
            toast.success(
                `${res.added} added${res.skipped > 0 ? `, ${res.skipped} skipped (duplicates or invalid)` : ""}`,
            )
            setText("")
            onDone(res.added)
        })
    }

    const handleFile = async (file: File) => {
        if (file.size > 2_000_000) {
            toast.error("File too large (max 2 MB)")
            return
        }
        const content = await file.text()
        setText((prev) => (prev ? prev + "\n" + content : content))
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Import suppressions</DialogTitle>
                    <DialogDescription>
                        Paste a list of emails (one per line, or comma/space separated).
                        CSVs work too — we&rsquo;ll pick out the email addresses.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">
                            Reason
                        </label>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {(["manual", "bounce", "complaint", "unsubscribe"] as const).map(
                                (r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setReason(r)}
                                        disabled={isPending}
                                        className={`text-xs px-2 py-1 rounded transition-colors ${
                                            reason === r
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted/40 hover:bg-muted text-muted-foreground"
                                        }`}
                                    >
                                        {REASON_LABELS[r]}
                                    </button>
                                ),
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">
                            Emails
                        </label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={"one@example.com\ntwo@example.com\nthree@example.com"}
                            disabled={isPending}
                            className="mt-1 w-full h-40 px-3 py-2 border rounded-md bg-background font-mono text-xs"
                        />
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                            <span>
                                {emails.length} valid email{emails.length === 1 ? "" : "s"} detected
                            </span>
                            <label className="cursor-pointer hover:text-foreground inline-flex items-center gap-1">
                                <Upload className="w-3 h-3" />
                                Upload .txt or .csv
                                <input
                                    type="file"
                                    accept=".txt,.csv,text/plain,text/csv"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0]
                                        if (f) handleFile(f)
                                        e.target.value = ""
                                    }}
                                    disabled={isPending}
                                />
                            </label>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isPending || emails.length === 0}
                    >
                        {isPending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Suppress {emails.length || ""}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ConfirmRemoveDialog({
    payload,
    onCancel,
    onConfirm,
}: {
    payload: { emails: string[]; bulk: boolean } | null
    onCancel: () => void
    onConfirm: () => void
}) {
    const open = payload !== null
    const count = payload?.emails.length ?? 0
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Remove from suppression list?
                    </DialogTitle>
                    <DialogDescription>
                        {count === 1 ? (
                            <>
                                <span className="font-mono">{payload?.emails[0]}</span> will start
                                receiving emails again. If they originally bounced or complained,
                                future sends to this address may also fail.
                            </>
                        ) : (
                            <>
                                {count.toLocaleString()} addresses will start receiving emails
                                again. Don&rsquo;t do this for bounced or complained addresses
                                unless you&rsquo;re sure they&rsquo;re valid now.
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={onConfirm}>
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Remove {count}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
