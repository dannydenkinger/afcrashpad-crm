"use client"

import { useState, useEffect, useCallback } from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogHeader,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, User, LayoutGrid, FileText } from "lucide-react"
import { globalSearch } from "@/app/search/actions"
import type { SearchResult } from "@/app/search/types"

export function CommandPalette() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const debouncedQuery = useDebounce(query, 200)
    const [results, setResults] = useState<{ contacts: SearchResult[]; opportunities: SearchResult[]; notes: SearchResult[] }>({ contacts: [], opportunities: [], notes: [] })
    const [loading, setLoading] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)

    const allItems: { item: SearchResult; href: string }[] = [
        ...results.contacts.map((r) => ({ item: r, href: `/contacts?contact=${r.id}` })),
        ...results.opportunities.map((r) => r.type === "opportunity" ? { item: r, href: `/pipeline?deal=${r.id}` } : null).filter(Boolean) as { item: SearchResult; href: string }[],
        ...results.notes.map((r) => r.type === "note" ? { item: r, href: `/contacts?contact=${r.contactId}` } : null).filter(Boolean) as { item: SearchResult; href: string }[],
    ]

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
                    setSelectedIndex((i) => (i + 1) % Math.max(1, allItems.length))
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault()
                    setSelectedIndex((i) => (i - 1 + allItems.length) % Math.max(1, allItems.length))
                }
                if (e.key === "Enter" && allItems[selectedIndex]) {
                    e.preventDefault()
                    router.push(allItems[selectedIndex]!.href)
                    setOpen(false)
                }
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [open, allItems, selectedIndex, router])

    const handleSelect = (href: string) => {
        router.push(href)
        setOpen(false)
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex flex-1 sm:flex-initial items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors sm:w-[300px] md:w-[400px] lg:w-[500px] min-w-0"
            >
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate">Search contacts, deals, notes...</span>
                <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden">
                    <DialogHeader className="sr-only">Quick search</DialogHeader>
                    <div className="flex border-b">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0 ml-4 self-center" />
                        <Input
                            placeholder="Search contacts, deals, notes..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-[320px] overflow-y-auto">
                        {loading ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">Searching...</div>
                        ) : query.length < 2 ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">Type at least 2 characters</div>
                        ) : allItems.length === 0 ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">No results</div>
                        ) : (
                            <div className="py-2">
                                {allItems.map(({ item, href }, idx) => {
                                    const isSelected = idx === selectedIndex
                                    return (
                                        <button
                                            key={`${item.type}-${item.id}`}
                                            type="button"
                                            onClick={() => handleSelect(href)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? "bg-muted" : "hover:bg-muted/50"
                                                }`}
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
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
