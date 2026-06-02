"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CalendarDays, List, Mail, Search, X } from "lucide-react"
import { CampaignsCalendar } from "./CampaignsCalendar"
import { EmptyState } from "@/components/ui/EmptyState"

interface CampaignSummary {
    id: string
    name: string
    subject: string
    status: string
    scheduledAt?: string
    sentAt?: string
    createdAt: string
    stats: { targeted: number; sent: number; failed: number; skipped: number }
}

const STATUS_FILTERS: { value: string; label: string }[] = [
    { value: "all", label: "All" },
    { value: "draft", label: "Drafts" },
    { value: "scheduled", label: "Scheduled" },
    { value: "sending", label: "Sending" },
    { value: "sent", label: "Sent" },
    { value: "failed", label: "Failed" },
]

function statusBadge(status: string) {
    const map: Record<string, { label: string; className: string }> = {
        draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
        scheduled: { label: "Scheduled", className: "bg-blue-500/10 text-blue-600" },
        sending: { label: "Sending…", className: "bg-amber-500/10 text-amber-600" },
        sent: { label: "Sent", className: "bg-emerald-500/10 text-emerald-600" },
        sent_with_errors: {
            label: "Sent (with errors)",
            className: "bg-yellow-500/10 text-yellow-700",
        },
        failed: { label: "Failed", className: "bg-red-500/10 text-red-600" },
        canceled: { label: "Canceled", className: "bg-muted text-muted-foreground" },
    }
    const v = map[status] ?? { label: status, className: "bg-muted" }
    return <Badge className={v.className}>{v.label}</Badge>
}

export function CampaignsList({ campaigns }: { campaigns: CampaignSummary[] }) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [view, setView] = useState<"list" | "calendar">(() => {
        if (typeof window === "undefined") return "list"
        return (
            (localStorage.getItem("vesta:campaigns:view") as "list" | "calendar") ??
            "list"
        )
    })
    const setViewPersisted = (next: "list" | "calendar") => {
        setView(next)
        try {
            localStorage.setItem("vesta:campaigns:view", next)
        } catch {
            /* ignore */
        }
    }

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: campaigns.length }
        campaigns.forEach((cmp) => {
            const key = cmp.status === "sent_with_errors" ? "sent" : cmp.status
            c[key] = (c[key] ?? 0) + 1
        })
        return c
    }, [campaigns])

    const lower = search.trim().toLowerCase()
    const filtered = useMemo(() => {
        return campaigns.filter((c) => {
            if (statusFilter !== "all") {
                const matchesStatus =
                    c.status === statusFilter ||
                    (statusFilter === "sent" && c.status === "sent_with_errors")
                if (!matchesStatus) return false
            }
            if (lower) {
                if (
                    !c.name.toLowerCase().includes(lower) &&
                    !c.subject.toLowerCase().includes(lower)
                ) {
                    return false
                }
            }
            return true
        })
    }, [campaigns, lower, statusFilter])

    if (campaigns.length === 0) {
        return (
            <Card>
                <CardContent className="p-0">
                    <EmptyState
                        Icon={Mail}
                        accent="primary"
                        title="No campaigns yet"
                        description="Create your first campaign to start reaching contacts."
                        action={{ label: "New campaign", href: "/marketing/email/campaigns/new" }}
                    />
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-3">
            {/* View toggle (List / Calendar) */}
            <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 w-fit">
                <button
                    type="button"
                    onClick={() => setViewPersisted("list")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                        view === "list"
                            ? "bg-background shadow-sm font-medium"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <List className="w-3 h-3" />
                    List
                </button>
                <button
                    type="button"
                    onClick={() => setViewPersisted("calendar")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                        view === "calendar"
                            ? "bg-background shadow-sm font-medium"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <CalendarDays className="w-3 h-3" />
                    Calendar
                </button>
            </div>

            {view === "calendar" ? (
                <CampaignsCalendar campaigns={campaigns} />
            ) : (
                <ListView
                    campaigns={campaigns}
                    counts={counts}
                    search={search}
                    setSearch={setSearch}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    filtered={filtered}
                />
            )}
        </div>
    )
}

interface ListViewProps {
    campaigns: CampaignSummary[]
    counts: Record<string, number>
    search: string
    setSearch: (v: string) => void
    statusFilter: string
    setStatusFilter: (v: string) => void
    filtered: CampaignSummary[]
}

function ListView({
    campaigns,
    counts,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered,
}: ListViewProps) {
    return (
        <div className="space-y-3">
            {/* Filter toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or subject"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 pr-7 h-8 text-sm"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Clear search"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                    {STATUS_FILTERS.map((f) => {
                        const count = counts[f.value] ?? 0
                        const active = statusFilter === f.value
                        if (f.value !== "all" && count === 0) return null
                        return (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setStatusFilter(f.value)}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                    active
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {f.label}
                                <span className="ml-1 opacity-70 tabular-nums">{count}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Campaign rows */}
            {filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-0">
                        <EmptyState
                            Icon={Search}
                            title="No matching campaigns"
                            description="Try a different search term or clear the filters."
                            compact
                        />
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {filtered.map((c) => (
                        <Link key={c.id} href={`/marketing/email/campaigns/${c.id}`}>
                            <Card className="hover:bg-muted/40 hover:border-primary/30 transition-colors cursor-pointer">
                                <CardContent className="py-4 flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium truncate">{c.name}</span>
                                            {statusBadge(c.status)}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1 truncate">
                                            {c.subject}
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground tabular-nums text-right shrink-0 ml-4">
                                        {c.status === "sent" || c.status === "sent_with_errors" ? (
                                            <>
                                                <div>
                                                    {c.stats.sent}/{c.stats.targeted} sent
                                                </div>
                                                {c.stats.failed > 0 && (
                                                    <div className="text-red-600">
                                                        {c.stats.failed} failed
                                                    </div>
                                                )}
                                            </>
                                        ) : c.status === "scheduled" && c.scheduledAt ? (
                                            <>
                                                <div className="text-blue-600">Fires at</div>
                                                <div>
                                                    {new Date(c.scheduledAt).toLocaleString()}
                                                </div>
                                            </>
                                        ) : (
                                            <div>
                                                {new Date(c.createdAt).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
