"use client"

import { useState, useEffect, useMemo } from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogHeader,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, User, LayoutGrid, FileText, Plus, Mail, CheckSquare, Clock } from "lucide-react"
import { globalSearch } from "@/app/search/actions"
import type { SearchResult } from "@/app/search/types"

// ─── Action commands ─────────────────────────────────────────────
interface ActionCommand {
    id: string
    label: string
    href: string
    icon: React.ReactNode
    keywords: string[]
}

const ACTION_COMMANDS: ActionCommand[] = [
    { id: "new-deal", label: "Create deal", href: "/pipeline?action=new-deal", icon: <Plus className="h-4 w-4" />, keywords: ["create", "deal", "new", "opportunity", "pipeline"] },
    { id: "new-contact", label: "Add contact", href: "/contacts?action=new-contact", icon: <User className="h-4 w-4" />, keywords: ["add", "contact", "new", "person"] },
    { id: "new-task", label: "New task", href: "/tasks?action=new-task", icon: <CheckSquare className="h-4 w-4" />, keywords: ["new", "task", "todo", "create"] },
    { id: "new-email", label: "New email", href: "/communications?action=new", icon: <Mail className="h-4 w-4" />, keywords: ["new", "email", "message", "send", "communication"] },
]

// ─── Recent searches (localStorage) ─────────────────────────────
const RECENT_SEARCHES_KEY = "crm:recent-searches"
const MAX_RECENT = 5

function getRecentSearches(): string[] {
    if (typeof window === "undefined") return []
    try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

function addRecentSearch(query: string) {
    if (typeof window === "undefined" || query.length < 2) return
    try {
        const recent = getRecentSearches().filter((s) => s !== query)
        recent.unshift(query)
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
    } catch {
        // ignore storage errors
    }
}

export function CommandPalette() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const debouncedQuery = useDebounce(query, 200)
    const [results, setResults] = useState<{ contacts: SearchResult[]; opportunities: SearchResult[]; notes: SearchResult[] }>({ contacts: [], opportunities: [], notes: [] })
    const [loading, setLoading] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [recentSearches, setRecentSearches] = useState<string[]>([])

    // Load recent searches when palette opens
    useEffect(() => {
        if (open) {
            setRecentSearches(getRecentSearches())
        }
    }, [open])

    // Filter action commands by query
    const matchedActions = useMemo(() => {
        if (query.length === 0) return ACTION_COMMANDS
        const q = query.toLowerCase()
        return ACTION_COMMANDS.filter(
            (cmd) => cmd.label.toLowerCase().includes(q) || cmd.keywords.some((kw) => kw.includes(q))
        )
    }, [query])

    const searchItems: { item: SearchResult; href: string }[] = [
        ...results.contacts.map((r) => ({ item: r, href: `/contacts?contact=${r.id}` })),
        ...results.opportunities.map((r) => r.type === "opportunity" ? { item: r, href: `/pipeline?deal=${r.id}` } : null).filter(Boolean) as { item: SearchResult; href: string }[],
        ...results.notes.map((r) => r.type === "note" ? { item: r, href: `/contacts?contact=${r.contactId}` } : null).filter(Boolean) as { item: SearchResult; href: string }[],
    ]

    // Combined selectable items: actions first, then search results
    const allSelectableCount = matchedActions.length + searchItems.length + (query.length === 0 ? recentSearches.length : 0)

    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setResults({ contacts: [], opportunities: [], notes: [] })
            return
        }
        let cancelled = false
        setLoading(true)
        globalSearch(debouncedQuery).then((res) => {
            if (!cancelled) {
                setResults(res)
                setSelectedIndex(0)
                setLoading(false)
            }
        })
        return () => { cancelled = true }
    }, [debouncedQuery])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault()
                setOpen((o) => !o)
                setQuery("")
                setSelectedIndex(0)
            }
            if (open) {
                if (e.key === "Escape") setOpen(false)
                if (e.key === "ArrowDown") {
                    e.preventDefault()
                    setSelectedIndex((i) => (i + 1) % Math.max(1, allSelectableCount))
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault()
                    setSelectedIndex((i) => (i - 1 + allSelectableCount) % Math.max(1, allSelectableCount))
                }
                if (e.key === "Enter") {
                    e.preventDefault()
                    handleSelectByIndex(selectedIndex)
                }
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, allSelectableCount, selectedIndex])

    const handleSelectByIndex = (idx: number) => {
        // Actions come first
        if (idx < matchedActions.length) {
            const action = matchedActions[idx]
            if (action) {
                router.push(action.href)
                setOpen(false)
            }
            return
        }

        const afterActions = idx - matchedActions.length

        // If no query, recent searches come next
        if (query.length === 0 && afterActions < recentSearches.length) {
            const recentQuery = recentSearches[afterActions]
            if (recentQuery) {
                setQuery(recentQuery)
                setSelectedIndex(0)
            }
            return
        }

        // Then search results
        const searchIdx = query.length === 0 ? afterActions - recentSearches.length : afterActions
        if (searchItems[searchIdx]) {
            const href = searchItems[searchIdx].href
            // Save search to recents
            if (query.length >= 2) addRecentSearch(query)
            router.push(href)
            setOpen(false)
        }
    }

    const handleSelect = (href: string) => {
        if (query.length >= 2) addRecentSearch(query)
        router.push(href)
        setOpen(false)
    }

    const handleSelectAction = (href: string) => {
        router.push(href)
        setOpen(false)
    }

    let runningIndex = 0

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex flex-1 sm:flex-initial items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors sm:w-[300px] md:w-[400px] lg:w-[500px] min-w-0"
            >
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate">Search or type a command...</span>
                <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden">
                    <DialogHeader className="sr-only">Quick search and commands</DialogHeader>
                    <div className="flex border-b">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0 ml-4 self-center" />
                        <Input
                            placeholder="Search or type a command..."
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                        {/* Action commands */}
                        {matchedActions.length > 0 && (
                            <div className="py-1">
                                <div className="px-4 py-1.5">
                                    <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Actions</span>
                                </div>
                                {matchedActions.map((action) => {
                                    const idx = runningIndex++
                                    const isSelected = idx === selectedIndex
                                    return (
                                        <button
                                            key={action.id}
                                            type="button"
                                            onClick={() => handleSelectAction(action.href)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? "bg-muted" : "hover:bg-muted/50"}`}
                                        >
                                            <span className="text-muted-foreground shrink-0">{action.icon}</span>
                                            <span className="text-sm font-medium">{action.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* Recent searches (only when no query) */}
                        {query.length === 0 && recentSearches.length > 0 && (
                            <div className="py-1 border-t">
                                <div className="px-4 py-1.5">
                                    <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Recent searches</span>
                                </div>
                                {recentSearches.map((recent) => {
                                    const idx = runningIndex++
                                    const isSelected = idx === selectedIndex
                                    return (
                                        <button
                                            key={recent}
                                            type="button"
                                            onClick={() => { setQuery(recent); setSelectedIndex(0) }}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? "bg-muted" : "hover:bg-muted/50"}`}
                                        >
                                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="text-sm text-muted-foreground">{recent}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* Search results */}
                        {query.length >= 2 && (
                            <>
                                {loading ? (
                                    <div className="p-6 text-center text-sm text-muted-foreground">Searching...</div>
                                ) : searchItems.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
                                ) : (
                                    <div className="py-1 border-t">
                                        <div className="px-4 py-1.5">
                                            <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Results</span>
                                        </div>
                                        {searchItems.map(({ item, href }) => {
                                            const idx = runningIndex++
                                            const isSelected = idx === selectedIndex
                                            return (
                                                <button
                                                    key={`${item.type}-${item.id}`}
                                                    type="button"
                                                    onClick={() => handleSelect(href)}
                                                    onMouseEnter={() => setSelectedIndex(idx)}
                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? "bg-muted" : "hover:bg-muted/50"}`}
                                                >
                                                    {item.type === "contact" && <User className="h-4 w-4 text-muted-foreground shrink-0" />}
                                                    {item.type === "opportunity" && <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />}
                                                    {item.type === "note" && <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium truncate">
                                                            {item.type === "contact" && item.name}
                                                            {item.type === "opportunity" && `${item.contactName} — Deal`}
                                                            {item.type === "note" && `${item.contactName} — Note`}
                                                        </div>
                                                        {item.type === "contact" && item.email && (
                                                            <div className="text-xs text-muted-foreground truncate">{item.email}</div>
                                                        )}
                                                        {item.type === "note" && (
                                                            <div className="text-xs text-muted-foreground truncate">{item.content}</div>
                                                        )}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Empty state when no query and no recents */}
                        {query.length === 0 && recentSearches.length === 0 && matchedActions.length > 0 && (
                            <div className="px-4 pb-3 pt-1 text-center text-xs text-muted-foreground">
                                Type to search contacts, deals, and notes
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
