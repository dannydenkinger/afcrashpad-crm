"use client"

import { useEffect, useState } from "react"
import { BlocksProvider } from "@grapesjs/react"
import type { Block } from "grapesjs"
import { Input } from "@/components/ui/input"
import { Search, X, ChevronDown, ChevronRight, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

const COLLAPSED_KEY = "vesta:editor:collapsedCategories"
const RECENT_KEY = "vesta:editor:recentBlocks"
const MAX_RECENT = 6

export function BlocksPanel() {
    const [query, setQuery] = useState("")
    const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed())
    const [recent, setRecent] = useState<string[]>(() => loadRecent())

    // Persist collapsed state
    useEffect(() => {
        try {
            localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
        } catch {
            // ignore
        }
    }, [collapsed])

    // Persist recent blocks
    useEffect(() => {
        try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
        } catch {
            // ignore
        }
    }, [recent])

    const toggleCategory = (cat: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev)
            if (next.has(cat)) next.delete(cat)
            else next.add(cat)
            return next
        })
    }

    const trackUsed = (blockId: string) => {
        setRecent((prev) => {
            const filtered = prev.filter((id) => id !== blockId)
            return [blockId, ...filtered].slice(0, MAX_RECENT)
        })
    }

    return (
        <BlocksProvider>
            {({ mapCategoryBlocks, dragStart, dragStop }) => {
                const q = query.trim().toLowerCase()
                const allCategories: [string, Block[]][] = Array.from(
                    mapCategoryBlocks.entries(),
                ).map(([cat, blocks]) => {
                    const filtered = q
                        ? blocks.filter((b) => {
                              const label = String(b.get("label") ?? "").toLowerCase()
                              return label.includes(q) || cat.toLowerCase().includes(q)
                          })
                        : blocks
                    return [cat, filtered]
                })

                const visibleCategories = allCategories.filter(
                    ([, blocks]) => blocks.length > 0,
                )
                const totalShown = visibleCategories.reduce(
                    (sum, [, b]) => sum + b.length,
                    0,
                )

                // Build recent block list
                const allBlocks = allCategories.flatMap(([, b]) => b)
                const recentBlocks = recent
                    .map((id) => allBlocks.find((b) => b.getId() === id))
                    .filter((b): b is Block => Boolean(b))

                const showRecent = !q && recentBlocks.length > 0

                return (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="px-3 py-2.5 border-b bg-muted/30 shrink-0">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Blocks
                                </div>
                                <div className="text-[10px] text-muted-foreground/70 tabular-nums">
                                    {totalShown}
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search blocks…"
                                    className="h-7 text-xs pl-6 pr-7"
                                />
                                {query && (
                                    <button
                                        type="button"
                                        onClick={() => setQuery("")}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        aria-label="Clear search"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-3">
                            {visibleCategories.length === 0 && (
                                <div className="text-xs text-muted-foreground text-center py-8 px-3">
                                    {q
                                        ? `No blocks match "${query}"`
                                        : "No blocks registered"}
                                </div>
                            )}

                            {showRecent && (
                                <div>
                                    <div className="flex items-center gap-1.5 px-1 mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                        <Clock className="w-3 h-3" />
                                        Recent
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {recentBlocks.map((block) => (
                                            <BlockTile
                                                key={"recent-" + block.getId()}
                                                block={block}
                                                onDragStart={(b, ev) => {
                                                    trackUsed(b.getId() as string)
                                                    dragStart(b, ev)
                                                }}
                                                onDragStop={dragStop}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {visibleCategories.map(([categoryName, blocks]) => {
                                const isCollapsed = collapsed.has(categoryName)
                                // Auto-expand all when searching
                                const expanded = q ? true : !isCollapsed
                                return (
                                    <div key={categoryName || "uncategorized"}>
                                        {categoryName && (
                                            <button
                                                type="button"
                                                onClick={() => toggleCategory(categoryName)}
                                                className="flex items-center gap-1 w-full px-1 mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors"
                                                aria-expanded={expanded}
                                            >
                                                {expanded ? (
                                                    <ChevronDown className="w-3 h-3" />
                                                ) : (
                                                    <ChevronRight className="w-3 h-3" />
                                                )}
                                                {categoryName}
                                                <span className="ml-auto opacity-60 tabular-nums normal-case font-normal">
                                                    {blocks.length}
                                                </span>
                                            </button>
                                        )}
                                        {expanded && (
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {blocks.map((block) => (
                                                    <BlockTile
                                                        key={block.getId()}
                                                        block={block}
                                                        onDragStart={(b, ev) => {
                                                            trackUsed(b.getId() as string)
                                                            dragStart(b, ev)
                                                        }}
                                                        onDragStop={dragStop}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            }}
        </BlocksProvider>
    )
}

function BlockTile({
    block,
    onDragStart,
    onDragStop,
}: {
    block: Block
    onDragStart: (block: Block, ev?: Event) => void
    onDragStop: (cancel?: boolean) => void
}) {
    const label = block.get("label") || block.getId()
    const media = block.get("media") as string | undefined
    const category = block.get("category") as string | undefined

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(block, e.nativeEvent)}
            onDragEnd={() => onDragStop(false)}
            className={cn(
                "group relative flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-md border bg-background",
                "cursor-grab active:cursor-grabbing",
                "hover:border-primary/50 hover:bg-muted/40 hover:shadow-sm hover:-translate-y-0.5",
                "active:translate-y-0 active:shadow-none",
                "transition-all duration-150 text-center select-none",
            )}
            title={
                typeof category === "string"
                    ? `${label} — ${category}`
                    : label
            }
        >
            <div
                className="w-9 h-9 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors [&_svg]:w-7 [&_svg]:h-7 [&_svg]:fill-current"
                dangerouslySetInnerHTML={{ __html: media || defaultIcon() }}
            />
            <div className="text-[10px] font-medium text-foreground/80 truncate w-full leading-tight">
                {label}
            </div>
        </div>
    )
}

function defaultIcon() {
    return '<svg viewBox="0 0 24 24"><path d="M12 2 2 7v10l10 5 10-5V7zm0 2.236 7.5 3.75L12 11.736 4.5 7.986zM4 9.618l7 3.5v7.264l-7-3.5zm9 10.764v-7.264l7-3.5v7.264z"/></svg>'
}

function loadCollapsed(): Set<string> {
    if (typeof window === "undefined") return new Set()
    try {
        const raw = localStorage.getItem(COLLAPSED_KEY)
        if (!raw) return new Set()
        const arr = JSON.parse(raw)
        return new Set(Array.isArray(arr) ? arr : [])
    } catch {
        return new Set()
    }
}

function loadRecent(): string[] {
    if (typeof window === "undefined") return []
    try {
        const raw = localStorage.getItem(RECENT_KEY)
        if (!raw) return []
        const arr = JSON.parse(raw)
        return Array.isArray(arr) ? arr.slice(0, MAX_RECENT) : []
    } catch {
        return []
    }
}
