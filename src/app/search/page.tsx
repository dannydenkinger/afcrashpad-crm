"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, User, LayoutGrid, FileText, Loader2 } from "lucide-react"
import { globalSearch } from "./actions"
import type { SearchResult } from "./types"

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="p-8">Loading search...</div>}>
            <SearchContent />
        </Suspense>
    )
}

function SearchContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const initialQuery = searchParams.get("q") || ""

    const [query, setQuery] = useState(initialQuery)
    const debouncedQuery = useDebounce(query, 300)
    const [results, setResults] = useState<{
        contacts: SearchResult[]
        opportunities: SearchResult[]
        notes: SearchResult[]
    }>({ contacts: [], opportunities: [], notes: [] })
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setResults({ contacts: [], opportunities: [], notes: [] })
            setSearched(false)
            return
        }
        let cancelled = false
        setLoading(true)
        globalSearch(debouncedQuery).then((res) => {
            if (!cancelled) {
                setResults(res)
                setSearched(true)
                setLoading(false)
            }
        })
        return () => { cancelled = true }
    }, [debouncedQuery])

    const handleNavigate = (result: SearchResult) => {
        if (result.type === "contact") {
            router.push(`/contacts?contact=${result.id}`)
        } else if (result.type === "opportunity") {
            router.push(`/pipeline?deal=${result.id}`)
        } else if (result.type === "note") {
            router.push(`/contacts?contact=${result.contactId}`)
        }
    }

    const totalResults = results.contacts.length + results.opportunities.length + results.notes.length

    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8 max-w-4xl">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Search
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Search across contacts, deals, and notes</p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email, phone..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-10 h-12 text-base"
                        autoFocus
                    />
                    {loading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>

                {searched && !loading && totalResults === 0 && (
                    <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardContent className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                            <Search className="h-10 w-10 mb-4 opacity-20" />
                            <p className="text-base font-medium">No results found</p>
                            <p className="text-sm mt-1">Try a different search term</p>
                        </CardContent>
                    </Card>
                )}

                {results.contacts.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Contacts ({results.contacts.length})
                        </h3>
                        <div className="space-y-2">
                            {results.contacts.map(result => result.type === "contact" && (
                                <Card
                                    key={result.id}
                                    className="border-none shadow-sm bg-card/40 hover:bg-card/60 transition-colors cursor-pointer"
                                    onClick={() => handleNavigate(result)}
                                >
                                    <CardContent className="flex items-center gap-3 py-3 px-4">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 shrink-0">
                                            <User className="h-4 w-4 text-blue-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{result.name}</p>
                                            {result.email && (
                                                <p className="text-xs text-muted-foreground truncate">{result.email}</p>
                                            )}
                                        </div>
                                        <Badge variant="outline" className="ml-auto text-[10px] shrink-0">Contact</Badge>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {results.opportunities.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Deals ({results.opportunities.length})
                        </h3>
                        <div className="space-y-2">
                            {results.opportunities.map(result => result.type === "opportunity" && (
                                <Card
                                    key={result.id}
                                    className="border-none shadow-sm bg-card/40 hover:bg-card/60 transition-colors cursor-pointer"
                                    onClick={() => handleNavigate(result)}
                                >
                                    <CardContent className="flex items-center gap-3 py-3 px-4">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 shrink-0">
                                            <LayoutGrid className="h-4 w-4 text-emerald-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {result.contactName} — Deal
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="ml-auto text-[10px] shrink-0">Deal</Badge>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {results.notes.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Notes ({results.notes.length})
                        </h3>
                        <div className="space-y-2">
                            {results.notes.map(result => result.type === "note" && (
                                <Card
                                    key={result.id}
                                    className="border-none shadow-sm bg-card/40 hover:bg-card/60 transition-colors cursor-pointer"
                                    onClick={() => handleNavigate(result)}
                                >
                                    <CardContent className="flex items-center gap-3 py-3 px-4">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 shrink-0">
                                            <FileText className="h-4 w-4 text-amber-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {result.contactName}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">{result.content}</p>
                                        </div>
                                        <Badge variant="outline" className="ml-auto text-[10px] shrink-0">Note</Badge>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {!searched && !loading && (
                    <div className="text-center text-sm text-muted-foreground pt-8">
                        Type at least 2 characters to search
                    </div>
                )}
            </div>
        </div>
    )
}
