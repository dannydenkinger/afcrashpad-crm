"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Search, Sparkles, Users, X } from "lucide-react"

interface ListSummary {
    id: string
    name: string
    description?: string
    contactCount: number
    updatedAt: string
    isSmart?: boolean
}

type SortMode = "recent" | "name" | "size"

export function ListsGrid({ lists }: { lists: ListSummary[] }) {
    const [search, setSearch] = useState("")
    const [sort, setSort] = useState<SortMode>("recent")
    const [kindFilter, setKindFilter] = useState<"all" | "smart" | "static">("all")

    const counts = useMemo(() => {
        let smart = 0
        lists.forEach((l) => {
            if (l.isSmart) smart += 1
        })
        return { all: lists.length, smart, static: lists.length - smart }
    }, [lists])

    const filtered = useMemo(() => {
        const lower = search.trim().toLowerCase()
        let arr = lists
        if (kindFilter === "smart") arr = arr.filter((l) => l.isSmart)
        else if (kindFilter === "static") arr = arr.filter((l) => !l.isSmart)
        if (lower) {
            arr = arr.filter(
                (l) =>
                    l.name.toLowerCase().includes(lower) ||
                    (l.description ?? "").toLowerCase().includes(lower),
            )
        }
        const sorted = [...arr]
        if (sort === "recent") {
            sorted.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        } else if (sort === "name") {
            sorted.sort((a, b) => a.name.localeCompare(b.name))
        } else {
            sorted.sort((a, b) => b.contactCount - a.contactCount)
        }
        return sorted
    }, [lists, search, sort, kindFilter])

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search lists by name or description"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 pr-8 h-9"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Clear search"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                    <SelectTrigger className="w-[150px] h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="recent">Recently updated</SelectItem>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                        <SelectItem value="size">Largest first</SelectItem>
                    </SelectContent>
                </Select>
                {counts.smart > 0 && (
                    <div className="flex items-center gap-1">
                        {(
                            [
                                { value: "all" as const, label: "All", count: counts.all },
                                { value: "static" as const, label: "Static", count: counts.static },
                                { value: "smart" as const, label: "Smart", count: counts.smart },
                            ] as const
                        ).map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setKindFilter(f.value)}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                    kindFilter === f.value
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {f.label}
                                <span className="ml-1 opacity-70 tabular-nums">{f.count}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        {search ? `No lists match "${search}"` : "No lists in this view."}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map((l) => (
                        <Link key={l.id} href={`/marketing/email/lists/${l.id}`}>
                            <Card className="hover:bg-muted/40 hover:border-primary/30 transition-colors cursor-pointer h-full">
                                <CardContent className="py-4">
                                    <div className="flex items-start justify-between gap-3 mb-1">
                                        <div className="font-medium truncate flex items-center gap-1.5">
                                            {l.isSmart ? (
                                                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                                            ) : (
                                                <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            )}
                                            <span className="truncate">{l.name}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground tabular-nums shrink-0">
                                            {l.contactCount.toLocaleString()}
                                        </div>
                                    </div>
                                    {l.description && (
                                        <div className="text-xs text-muted-foreground line-clamp-2">
                                            {l.description}
                                        </div>
                                    )}
                                    <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
                                        {l.isSmart && (
                                            <span className="text-[9px] uppercase tracking-wider font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                                                Smart
                                            </span>
                                        )}
                                        Updated {new Date(l.updatedAt).toLocaleDateString()}
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
