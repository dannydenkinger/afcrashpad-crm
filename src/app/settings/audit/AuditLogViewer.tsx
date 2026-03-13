"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollText, Loader2, ChevronDown } from "lucide-react"
import { getAuditLog } from "./actions"

interface AuditEntry {
    id: string
    userId: string
    userEmail: string
    userName: string
    action: string
    entity: string
    entityId: string
    entityName: string
    changes: Record<string, { from: unknown; to: unknown }> | null
    metadata: Record<string, unknown> | null
    createdAt: string
}

const ACTION_COLORS: Record<string, string> = {
    create: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    update: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    delete: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    export: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    settings_change: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    stage_move: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
}

const ENTITY_OPTIONS = [
    { value: "all", label: "All Entities" },
    { value: "opportunity", label: "Opportunities" },
    { value: "contact", label: "Contacts" },
    { value: "pipeline", label: "Pipelines" },
    { value: "user", label: "Users" },
    { value: "settings", label: "Settings" },
]

function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
        " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function describeAction(entry: AuditEntry): string {
    const name = entry.entityName || entry.entityId
    switch (entry.action) {
        case "create": return `Created ${entry.entity} "${name}"`
        case "update": {
            if (entry.changes) {
                const fields = Object.keys(entry.changes)
                return `Updated ${fields.join(", ")} on ${entry.entity} "${name}"`
            }
            return `Updated ${entry.entity} "${name}"`
        }
        case "delete": return `Deleted ${entry.entity} "${name}"`
        case "export": return `Exported ${entry.entity} data`
        case "settings_change": return `Changed ${entry.entity} settings`
        case "stage_move": return `Moved ${entry.entity} "${name}" to new stage`
        default: return `${entry.action} on ${entry.entity} "${name}"`
    }
}

export function AuditLogViewer() {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [entityFilter, setEntityFilter] = useState("all")
    const [hasMore, setHasMore] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const fetchEntries = useCallback(async (startAfter?: string) => {
        const isLoadMore = !!startAfter
        if (isLoadMore) setLoadingMore(true)
        else setLoading(true)

        const result = await getAuditLog({
            entity: entityFilter !== "all" ? entityFilter : undefined,
            limit: 50,
            startAfter,
        })

        if (result.success && result.entries) {
            if (isLoadMore) {
                setEntries(prev => [...prev, ...result.entries!])
            } else {
                setEntries(result.entries)
            }
            setHasMore(result.entries.length === 50)
        }

        setLoading(false)
        setLoadingMore(false)
    }, [entityFilter])

    useEffect(() => {
        fetchEntries()
    }, [fetchEntries])

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ScrollText className="h-5 w-5" />
                            Audit Log
                        </CardTitle>
                        <CardDescription>Track all changes made across the CRM.</CardDescription>
                    </div>
                    <Select value={entityFilter} onValueChange={setEntityFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {ENTITY_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p>No audit entries found.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {entries.map(entry => (
                            <div
                                key={entry.id}
                                className="flex flex-col gap-1 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Badge
                                            variant="outline"
                                            className={`shrink-0 text-[10px] uppercase font-semibold ${ACTION_COLORS[entry.action] || ""}`}
                                        >
                                            {entry.action}
                                        </Badge>
                                        <span className="text-sm truncate">{describeAction(entry)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-muted-foreground hidden sm:block">
                                            {entry.userName || entry.userEmail}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatDate(entry.createdAt)}
                                        </span>
                                    </div>
                                </div>
                                {expandedId === entry.id && entry.changes && (
                                    <div className="mt-2 pl-4 border-l-2 border-muted space-y-1">
                                        {Object.entries(entry.changes).map(([field, change]) => (
                                            <div key={field} className="text-xs text-muted-foreground">
                                                <span className="font-medium text-foreground">{field}:</span>{" "}
                                                <span className="text-rose-500 line-through">{String(change.from ?? "empty")}</span>
                                                {" → "}
                                                <span className="text-emerald-500">{String(change.to ?? "empty")}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {hasMore && (
                            <div className="flex justify-center pt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        const last = entries[entries.length - 1]
                                        if (last) fetchEntries(last.createdAt)
                                    }}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4 mr-2" />
                                    )}
                                    Load More
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
