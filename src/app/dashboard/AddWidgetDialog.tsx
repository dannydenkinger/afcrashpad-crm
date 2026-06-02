"use client"

import { useState, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    WIDGET_REGISTRY,
    type WidgetCategory,
    type WidgetMeta,
    type WidgetAccent,
} from "./widget-registry"

const CATEGORIES: WidgetCategory[] = ["Metrics", "Charts", "Lists", "Other"]

const ACCENT_TONES: Record<WidgetAccent, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
}

interface Props {
    open: boolean
    onClose: () => void
    /** IDs of widgets currently visible — they show as dimmed/already added. */
    visibleIds: string[]
    /** Add a widget to the dashboard. Caller picks a position. */
    onAdd: (widget: WidgetMeta) => void
}

export function AddWidgetDialog({ open, onClose, visibleIds, onAdd }: Props) {
    const [search, setSearch] = useState("")
    const [category, setCategory] = useState<WidgetCategory | "All">("All")

    const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return WIDGET_REGISTRY.filter((w) => {
            if (category !== "All" && w.category !== category) return false
            if (!q) return true
            return (
                w.title.toLowerCase().includes(q) ||
                w.description.toLowerCase().includes(q) ||
                w.id.toLowerCase().includes(q)
            )
        })
    }, [search, category])

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Add a widget</DialogTitle>
                    <DialogDescription>
                        Pick from {WIDGET_REGISTRY.length} widgets. You can resize and rearrange
                        any widget after adding it.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    {/* Search + category tabs */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-[180px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search widgets…"
                                className="h-8 text-sm pl-8 pr-7"
                                autoFocus
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-md">
                            {(["All", ...CATEGORIES] as const).map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCategory(c)}
                                    className={cn(
                                        "px-2 py-1 text-[10px] font-semibold rounded transition-colors",
                                        category === c
                                            ? "bg-background shadow-sm text-foreground"
                                            : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Widget grid */}
                    <div className="max-h-[440px] overflow-y-auto pr-1">
                        {filtered.length === 0 ? (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                                No widgets match &ldquo;{search}&rdquo;
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {filtered.map((w) => {
                                    const isVisible = visibleSet.has(w.id)
                                    return (
                                        <button
                                            key={w.id}
                                            type="button"
                                            disabled={isVisible}
                                            onClick={() => {
                                                onAdd(w)
                                                onClose()
                                            }}
                                            className={cn(
                                                "group flex items-start gap-3 text-left rounded-lg border p-3 transition-all",
                                                isVisible
                                                    ? "opacity-50 cursor-not-allowed"
                                                    : "hover:border-primary/40 hover:bg-muted/30 hover:-translate-y-0.5",
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
                                                    ACCENT_TONES[w.accent],
                                                )}
                                            >
                                                <w.Icon className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
                                                        {w.title}
                                                    </span>
                                                    {isVisible && (
                                                        <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-muted text-muted-foreground">
                                                            On dashboard
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                                                    {w.description}
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
