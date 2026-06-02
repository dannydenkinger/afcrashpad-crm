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
import {
    Search, User, LayoutGrid, FileText, Plus, Mail, CheckSquare, Clock,
    LayoutDashboard, Calendar, MessageSquare, Wallet, Megaphone, Workflow,
    Settings, Keyboard, Users, ArrowRight,
} from "lucide-react"
import { globalSearch } from "@/app/search/actions"
import type { SearchResult } from "@/app/search/types"

// ─── Commands ───────────────────────────────────────────────────
interface PaletteCommand {
    id: string
    label: string
    icon: React.ReactNode
    keywords: string[]
    /** Either navigate to href OR call onSelect (closes palette automatically). */
    href?: string
    onSelect?: () => void
}

const ACTION_COMMANDS: PaletteCommand[] = [
    { id: "new-deal", label: "Create deal", href: "/pipeline?action=new-deal", icon: <Plus className="h-4 w-4" />, keywords: ["create", "deal", "new", "opportunity", "pipeline"] },
    { id: "new-contact", label: "Add contact", href: "/contacts?action=new-contact", icon: <User className="h-4 w-4" />, keywords: ["add", "contact", "new", "person"] },
    { id: "new-task", label: "New task", href: "/tasks?action=new-task", icon: <CheckSquare className="h-4 w-4" />, keywords: ["new", "task", "todo", "create"] },
    { id: "new-email", label: "New email", href: "/communications?action=new", icon: <Mail className="h-4 w-4" />, keywords: ["new", "email", "message", "send", "communication"] },
]

const NAV_COMMANDS: PaletteCommand[] = [
    { id: "go-dashboard", label: "Go to Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, keywords: ["dashboard", "home", "overview"] },
    { id: "go-pipeline", label: "Go to Pipeline", href: "/pipeline", icon: <LayoutGrid className="h-4 w-4" />, keywords: ["pipeline", "deals", "kanban", "opportunities"] },
    { id: "go-contacts", label: "Go to Contacts", href: "/contacts", icon: <Users className="h-4 w-4" />, keywords: ["contacts", "people", "leads"] },
    { id: "go-calendar", label: "Go to Calendar", href: "/calendar", icon: <Calendar className="h-4 w-4" />, keywords: ["calendar", "events", "schedule"] },
    { id: "go-tasks", label: "Go to Tasks", href: "/tasks", icon: <CheckSquare className="h-4 w-4" />, keywords: ["tasks", "todo"] },
    { id: "go-communications", label: "Go to Communications", href: "/communications", icon: <MessageSquare className="h-4 w-4" />, keywords: ["communications", "inbox", "messages", "email"] },
    { id: "go-marketing", label: "Go to Marketing", href: "/marketing", icon: <Megaphone className="h-4 w-4" />, keywords: ["marketing", "campaigns", "email"] },
    { id: "go-finance", label: "Go to Finance", href: "/finance", icon: <Wallet className="h-4 w-4" />, keywords: ["finance", "revenue", "money", "commissions"] },
    { id: "go-automations", label: "Go to Automations", href: "/automations", icon: <Workflow className="h-4 w-4" />, keywords: ["automations", "workflows"] },
    { id: "go-settings", label: "Go to Settings", href: "/settings", icon: <Settings className="h-4 w-4" />, keywords: ["settings", "config"] },
]

const HELP_COMMANDS: PaletteCommand[] = [
    {
        id: "show-shortcuts",
        label: "Show keyboard shortcuts",
        icon: <Keyboard className="h-4 w-4" />,
        keywords: ["shortcuts", "keyboard", "help", "?"],
        onSelect: () => window.dispatchEvent(new CustomEvent("crm:show-shortcuts")),
    },
    {
        id: "open-help",
        label: "Open help & docs",
        href: "/help",
        icon: <FileText className="h-4 w-4" />,
        keywords: ["help", "docs", "documentation", "how", "guide", "support"],
    },
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

    // Filter command groups by query
    const filterCommands = (cmds: PaletteCommand[], q: string) => {
        if (!q) return cmds
        const lower = q.toLowerCase()
        return cmds.filter(
            (cmd) => cmd.label.toLowerCase().includes(lower) || cmd.keywords.some((kw) => kw.includes(lower))
        )
    }

    const matchedActions = useMemo(() => filterCommands(ACTION_COMMANDS, query), [query])
    const matchedNav = useMemo(() => filterCommands(NAV_COMMANDS, query), [query])
    const matchedHelp = useMemo(() => filterCommands(HELP_COMMANDS, query), [query])

    const searchItems: { item: SearchResult; href: string }[] = [
        ...results.contacts.map((r) => ({ item: r, href: `/contacts?contact=${r.id}` })),
        ...results.opportunities.map((r) => r.type === "opportunity" ? { item: r, href: `/pipeline?deal=${r.id}` } : null).filter(Boolean) as { item: SearchResult; href: string }[],
        ...results.notes.map((r) => r.type === "note" ? { item: r, href: `/contacts?contact=${r.contactId}` } : null).filter(Boolean) as { item: SearchResult; href: string }[],
    ]

    // Combined selectable items
    const allSelectableCount =
        matchedActions.length +
        matchedNav.length +
        matchedHelp.length +
        searchItems.length +
        (query.length === 0 ? recentSearches.length : 0)

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

    const runCommand = (cmd: PaletteCommand) => {
        if (cmd.onSelect) {
            cmd.onSelect()
        } else if (cmd.href) {
            router.push(cmd.href)
        }
        setOpen(false)
    }

    const handleSelectByIndex = (idx: number) => {
        // Actions
        if (idx < matchedActions.length) {
            const cmd = matchedActions[idx]
            if (cmd) runCommand(cmd)
            return
        }
        let cursor = idx - matchedActions.length

        // Navigation
        if (cursor < matchedNav.length) {
            const cmd = matchedNav[cursor]
            if (cmd) runCommand(cmd)
            return
        }
        cursor -= matchedNav.length

        // Help
        if (cursor < matchedHelp.length) {
            const cmd = matchedHelp[cursor]
            if (cmd) runCommand(cmd)
            return
        }
        cursor -= matchedHelp.length

        // Recent searches (only when no query)
        if (query.length === 0 && cursor < recentSearches.length) {
            const recentQuery = recentSearches[cursor]
            if (recentQuery) {
                setQuery(recentQuery)
                setSelectedIndex(0)
            }
            return
        }
        if (query.length === 0) cursor -= recentSearches.length

        // Search results
        if (searchItems[cursor]) {
            const href = searchItems[cursor].href
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
                <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
                    <DialogHeader className="sr-only">Quick search and commands</DialogHeader>
                    <div className="flex items-center border-b px-4">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                            placeholder="Search contacts, deals, notes — or type a command..."
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12 bg-transparent"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-[440px] overflow-y-auto py-1">
                        {/* Actions */}
                        {matchedActions.length > 0 && (
                            <CommandSection label="Actions">
                                {matchedActions.map((cmd) => {
                                    const idx = runningIndex++
                                    return (
                                        <CommandRow
                                            key={cmd.id}
                                            command={cmd}
                                            isSelected={idx === selectedIndex}
                                            onSelect={() => runCommand(cmd)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                        />
                                    )
                                })}
                            </CommandSection>
                        )}

                        {/* Navigation */}
                        {matchedNav.length > 0 && (
                            <CommandSection label="Navigation">
                                {matchedNav.map((cmd) => {
                                    const idx = runningIndex++
                                    return (
                                        <CommandRow
                                            key={cmd.id}
                                            command={cmd}
                                            isSelected={idx === selectedIndex}
                                            onSelect={() => runCommand(cmd)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                        />
                                    )
                                })}
                            </CommandSection>
                        )}

                        {/* Help */}
                        {matchedHelp.length > 0 && (
                            <CommandSection label="Help">
                                {matchedHelp.map((cmd) => {
                                    const idx = runningIndex++
                                    return (
                                        <CommandRow
                                            key={cmd.id}
                                            command={cmd}
                                            isSelected={idx === selectedIndex}
                                            onSelect={() => runCommand(cmd)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                        />
                                    )
                                })}
                            </CommandSection>
                        )}

                        {/* Recent searches (only when no query) */}
                        {query.length === 0 && recentSearches.length > 0 && (
                            <CommandSection label="Recent searches">
                                {recentSearches.map((recent) => {
                                    const idx = runningIndex++
                                    const isSelected = idx === selectedIndex
                                    return (
                                        <button
                                            key={recent}
                                            type="button"
                                            onClick={() => { setQuery(recent); setSelectedIndex(0) }}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors rounded-md mx-1 ${isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50"}`}
                                        >
                                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="text-sm text-muted-foreground">{recent}</span>
                                        </button>
                                    )
                                })}
                            </CommandSection>
                        )}

                        {/* Search results */}
                        {query.length >= 2 && (
                            <>
                                {loading ? (
                                    <div className="p-6 text-center text-sm text-muted-foreground">Searching…</div>
                                ) : searchItems.length === 0 && matchedActions.length === 0 && matchedNav.length === 0 && matchedHelp.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <Search className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                                        <p className="text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
                                        <p className="text-xs text-muted-foreground/70 mt-1">Try a different search term</p>
                                    </div>
                                ) : searchItems.length > 0 ? (
                                    <CommandSection label="Results">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (query.length >= 2) addRecentSearch(query)
                                                router.push(`/search?q=${encodeURIComponent(query)}`)
                                                setOpen(false)
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-1.5 text-left transition-colors rounded-md mx-1 hover:bg-muted/50 text-xs text-muted-foreground"
                                        >
                                            <Search className="h-3.5 w-3.5" />
                                            See all results for &ldquo;{query}&rdquo;
                                            <ArrowRight className="h-3 w-3 ml-auto" />
                                        </button>
                                        {searchItems.map(({ item, href }) => {
                                            const idx = runningIndex++
                                            const isSelected = idx === selectedIndex
                                            return (
                                                <button
                                                    key={`${item.type}-${item.id}`}
                                                    type="button"
                                                    onClick={() => handleSelect(href)}
                                                    onMouseEnter={() => setSelectedIndex(idx)}
                                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors rounded-md mx-1 ${isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50"}`}
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
                                    </CommandSection>
                                ) : null}
                            </>
                        )}

                        {/* Hint when no query */}
                        {query.length === 0 && recentSearches.length === 0 && (
                            <div className="px-4 pb-2 pt-2 text-center text-xs text-muted-foreground">
                                Type to search contacts, deals, and notes
                            </div>
                        )}
                    </div>
                    {/* Footer with hints */}
                    <div className="border-t bg-muted/30 px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-3">
                            <KbdHint keys={["↑", "↓"]} label="Navigate" />
                            <KbdHint keys={["↵"]} label="Select" />
                            <KbdHint keys={["Esc"]} label="Close" />
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground/70">
                            <span>Press</span>
                            <kbd className="rounded border bg-background px-1 py-0 font-mono text-[9px]">?</kbd>
                            <span>for shortcuts</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

// ─── Visual helpers ─────────────────────────────────────────────
function CommandSection({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="py-1">
            <div className="px-4 pt-2 pb-1 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-primary/50" />
                <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                    {label}
                </span>
            </div>
            {children}
        </div>
    )
}

function CommandRow({
    command,
    isSelected,
    onSelect,
    onMouseEnter,
}: {
    command: PaletteCommand
    isSelected: boolean
    onSelect: () => void
    onMouseEnter: () => void
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            onMouseEnter={onMouseEnter}
            className={`group w-full flex items-center gap-3 px-3 py-2 text-left transition-colors rounded-md mx-1 ${
                isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50"
            }`}
        >
            <span className={`shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                {command.icon}
            </span>
            <span className="text-sm font-medium flex-1 truncate">{command.label}</span>
            <ArrowRight
                className={`h-3.5 w-3.5 shrink-0 transition-opacity ${
                    isSelected ? "opacity-60 text-primary" : "opacity-0 group-hover:opacity-40"
                }`}
            />
        </button>
    )
}

function KbdHint({ keys, label }: { keys: string[]; label: string }) {
    return (
        <div className="flex items-center gap-1">
            {keys.map((k) => (
                <kbd
                    key={k}
                    className="inline-flex h-4 min-w-[16px] items-center justify-center rounded border bg-background px-1 font-mono text-[9px] font-medium"
                >
                    {k}
                </kbd>
            ))}
            <span>{label}</span>
        </div>
    )
}
