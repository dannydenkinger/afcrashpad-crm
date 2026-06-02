"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Bug, CheckCircle2, Circle, Eye, Inbox, Lightbulb, Loader2, MessageSquare, Search } from "lucide-react"
import {
    updateFeedbackStatus,
    type FeedbackEntry,
    type FeedbackKind,
    type FeedbackStatus,
} from "./actions"
import { formatRelative } from "@/lib/admin/format"

const KIND_FILTERS: { value: "all" | FeedbackKind; label: string; icon: typeof Bug }[] = [
    { value: "all", label: "All", icon: Inbox },
    { value: "bug", label: "Bug", icon: Bug },
    { value: "idea", label: "Idea", icon: Lightbulb },
    { value: "other", label: "Other", icon: MessageSquare },
]

const STATUS_FILTERS: { value: "all" | FeedbackStatus; label: string }[] = [
    { value: "all", label: "All status" },
    { value: "new", label: "New" },
    { value: "triaged", label: "Triaged" },
    { value: "resolved", label: "Resolved" },
]

export function FeedbackInbox({ initial }: { initial: FeedbackEntry[] }) {
    const [entries, setEntries] = useState<FeedbackEntry[]>(initial)
    const [query, setQuery] = useState("")
    const [kindFilter, setKindFilter] = useState<"all" | FeedbackKind>("all")
    const [statusFilter, setStatusFilter] = useState<"all" | FeedbackStatus>("new")
    const [selected, setSelected] = useState<FeedbackEntry | null>(null)
    const [, startTransition] = useTransition()
    const [savingId, setSavingId] = useState<string | null>(null)

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return entries.filter((e) => {
            if (kindFilter !== "all" && e.kind !== kindFilter) return false
            if (statusFilter !== "all" && e.status !== statusFilter) return false
            if (q) {
                if (
                    !e.message.toLowerCase().includes(q) &&
                    !e.userEmail.toLowerCase().includes(q) &&
                    !e.workspaceName.toLowerCase().includes(q)
                ) {
                    return false
                }
            }
            return true
        })
    }, [entries, query, kindFilter, statusFilter])

    const counts = useMemo(() => {
        return {
            new: entries.filter((e) => e.status === "new").length,
            triaged: entries.filter((e) => e.status === "triaged").length,
            resolved: entries.filter((e) => e.status === "resolved").length,
            bug: entries.filter((e) => e.kind === "bug").length,
            idea: entries.filter((e) => e.kind === "idea").length,
            other: entries.filter((e) => e.kind === "other").length,
        }
    }, [entries])

    const updateStatus = (id: string, status: FeedbackStatus) => {
        setSavingId(id)
        startTransition(async () => {
            const res = await updateFeedbackStatus({ id, status })
            setSavingId(null)
            if (!res.success) {
                toast.error(res.error || "Failed to update")
                return
            }
            setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
            if (selected?.id === id) setSelected({ ...selected, status })
            toast.success(`Marked ${status}`)
        })
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <Pill label="New" value={counts.new} accent="amber" />
                <Pill label="Triaged" value={counts.triaged} accent="blue" />
                <Pill label="Resolved" value={counts.resolved} accent="emerald" />
                <Pill label="Bugs" value={counts.bug} accent="rose" />
                <Pill label="Ideas" value={counts.idea} accent="violet" />
                <Pill label="Other" value={counts.other} accent="zinc" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search message / email / workspace"
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>
                <FilterPills
                    options={KIND_FILTERS}
                    value={kindFilter}
                    onChange={(v) => setKindFilter(v as typeof kindFilter)}
                />
                <FilterPills
                    options={STATUS_FILTERS}
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
                    {filtered.length === 0 ? (
                        <div className="p-6 text-xs text-muted-foreground italic">
                            Nothing matches the current filters.
                        </div>
                    ) : (
                        <ul className="divide-y max-h-[70vh] overflow-y-auto">
                            {filtered.map((e) => (
                                <li
                                    key={e.id}
                                    className={
                                        selected?.id === e.id
                                            ? "bg-violet-500/10"
                                            : "hover:bg-muted/40 cursor-pointer"
                                    }
                                    onClick={() => setSelected(e)}
                                >
                                    <div className="p-3 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <KindIcon kind={e.kind} />
                                                <StatusDot status={e.status} />
                                                <span className="text-xs font-medium truncate">
                                                    {e.userName || e.userEmail || "anonymous"}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                                {formatRelative(e.createdAt)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground line-clamp-2">
                                            {e.message}
                                        </div>
                                        {e.workspaceName && (
                                            <div className="text-[10px] text-muted-foreground/80">
                                                {e.workspaceName}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="lg:col-span-3">
                    {selected ? (
                        <FeedbackDetail
                            entry={selected}
                            onStatus={(s) => updateStatus(selected.id, s)}
                            saving={savingId === selected.id}
                        />
                    ) : (
                        <div className="rounded-xl border bg-card p-6 text-center text-xs text-muted-foreground italic">
                            Pick an entry on the left to see the full message.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function FeedbackDetail({
    entry,
    onStatus,
    saving,
}: {
    entry: FeedbackEntry
    onStatus: (s: FeedbackStatus) => void
    saving: boolean
}) {
    const mailto = entry.userEmail
        ? `mailto:${entry.userEmail}?subject=Re:%20your%20feedback%20on%20Vesta&body=${encodeURIComponent("Hey — thanks for the note about:\n\n> " + entry.message.slice(0, 500) + "\n\n")}`
        : null

    return (
        <div className="rounded-xl border bg-card p-5 space-y-4">
            <header className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <KindIcon kind={entry.kind} />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {entry.kind}
                        </span>
                        <StatusBadge status={entry.status} />
                    </div>
                    <div className="text-sm font-medium">
                        {entry.userName || entry.userEmail || "anonymous"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {entry.userEmail}
                        {entry.workspaceName && (
                            <>
                                {" · "}
                                <Link
                                    href={`/admin/workspaces/${entry.workspaceId}`}
                                    className="text-violet-600 dark:text-violet-400 hover:underline"
                                >
                                    {entry.workspaceName}
                                </Link>
                            </>
                        )}
                        {entry.createdAt && (
                            <span className="ml-1.5">· {formatRelative(entry.createdAt)}</span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    {entry.status !== "triaged" && (
                        <button
                            onClick={() => onStatus("triaged")}
                            disabled={saving}
                            className="text-[11px] px-2.5 py-1 rounded border hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                            {saving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Eye className="h-3 w-3" />
                            )}
                            Mark triaged
                        </button>
                    )}
                    {entry.status !== "resolved" && (
                        <button
                            onClick={() => onStatus("resolved")}
                            disabled={saving}
                            className="text-[11px] px-2.5 py-1 rounded border hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                            {saving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-3 w-3" />
                            )}
                            Resolved
                        </button>
                    )}
                    {entry.status !== "new" && (
                        <button
                            onClick={() => onStatus("new")}
                            disabled={saving}
                            className="text-[11px] px-2.5 py-1 rounded border hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                            <Circle className="h-3 w-3" />
                            Reopen
                        </button>
                    )}
                </div>
            </header>

            <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap leading-relaxed">
                {entry.message}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <Meta label="Page" value={entry.pageUrl} />
                <Meta label="Viewport" value={entry.viewport} />
                <Meta label="IP" value={entry.ip} />
                <Meta label="User agent" value={entry.userAgent} />
            </dl>

            {mailto && (
                <a
                    href={mailto}
                    className="inline-flex items-center text-xs px-3 py-1.5 rounded-md bg-violet-500 text-white hover:bg-violet-600"
                >
                    Reply via email
                </a>
            )}
        </div>
    )
}

function Pill({
    label,
    value,
    accent,
}: {
    label: string
    value: number
    accent: "amber" | "blue" | "emerald" | "rose" | "violet" | "zinc"
}) {
    const colorClass = {
        amber: "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/5",
        blue: "border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-500/5",
        emerald:
            "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5",
        rose: "border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/5",
        violet:
            "border-violet-500/30 text-violet-700 dark:text-violet-400 bg-violet-500/5",
        zinc: "border-zinc-500/30 text-zinc-700 dark:text-zinc-400 bg-zinc-500/5",
    }[accent]
    return (
        <div className={`rounded-lg border px-3 py-2 ${colorClass}`}>
            <div className="text-[10px] font-medium uppercase tracking-wider opacity-80">
                {label}
            </div>
            <div className="text-lg font-semibold tabular-nums">{value}</div>
        </div>
    )
}

function FilterPills({
    options,
    value,
    onChange,
}: {
    options: ReadonlyArray<{ value: string; label: string; icon?: typeof Bug }>
    value: string
    onChange: (v: string) => void
}) {
    return (
        <div className="inline-flex items-center gap-0.5 rounded-md border bg-card p-0.5">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded ${
                        value === o.value
                            ? "bg-violet-500/15 text-violet-700 dark:text-violet-400"
                            : "text-muted-foreground hover:bg-muted"
                    }`}
                >
                    {o.icon && <o.icon className="h-3 w-3" />}
                    {o.label}
                </button>
            ))}
        </div>
    )
}

function KindIcon({ kind }: { kind: FeedbackKind }) {
    if (kind === "bug") return <Bug className="h-3.5 w-3.5 text-rose-500" />
    if (kind === "idea") return <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
    return <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
}

function StatusDot({ status }: { status: FeedbackStatus }) {
    const cls =
        status === "new"
            ? "bg-amber-500"
            : status === "triaged"
              ? "bg-blue-500"
              : "bg-emerald-500"
    return <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
    const cls =
        status === "new"
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            : status === "triaged"
              ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    return (
        <span
            className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}
        >
            {status}
        </span>
    )
}

function Meta({ label, value }: { label: string; value: string }) {
    if (!value) return null
    return (
        <div className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono text-[11px] truncate" title={value}>
                {value}
            </dd>
        </div>
    )
}
