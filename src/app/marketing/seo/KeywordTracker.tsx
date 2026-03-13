"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    ArrowUpRight,
    ArrowDownRight,
    Plus,
    Trash2,
    RefreshCw,
    Loader2,
    Search,
    Target,
} from "lucide-react"
import { toast } from "sonner"
import {
    addTrackedKeyword,
    removeTrackedKeyword,
    updateKeywordPosition,
} from "./actions"
import type { TrackedKeyword, SerpResponse } from "./types"

interface KeywordTrackerProps {
    keywords: TrackedKeyword[]
    onKeywordsChange: (keywords: TrackedKeyword[]) => void
    defaultDomain: string
}

export default function KeywordTracker({
    keywords,
    onKeywordsChange,
    defaultDomain,
}: KeywordTrackerProps) {
    const [newKeyword, setNewKeyword] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set())
    const [isCheckingAll, setIsCheckingAll] = useState(false)

    async function handleAdd() {
        const kw = newKeyword.trim()
        if (!kw) return

        // Check for duplicates
        if (keywords.some((k) => k.keyword === kw.toLowerCase())) {
            toast.error("Keyword already tracked")
            return
        }

        setIsAdding(true)
        const result = await addTrackedKeyword(kw, defaultDomain)
        if (result.success && result.data) {
            onKeywordsChange([result.data, ...keywords])
            setNewKeyword("")
            toast.success(`Added "${kw}"`)
        } else {
            toast.error(result.error || "Failed to add keyword")
        }
        setIsAdding(false)
    }

    async function handleRemove(id: string) {
        const result = await removeTrackedKeyword(id)
        if (result.success) {
            onKeywordsChange(keywords.filter((k) => k.id !== id))
            toast.success("Keyword removed")
        } else {
            toast.error(result.error || "Failed to remove keyword")
        }
    }

    async function checkSingleKeyword(kw: TrackedKeyword) {
        setCheckingIds((prev) => new Set(prev).add(kw.id))

        try {
            const res = await fetch("/api/seo/serp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keyword: kw.keyword, domain: kw.domain }),
            })

            if (!res.ok) throw new Error("SERP check failed")

            const data: SerpResponse = await res.json()
            await updateKeywordPosition(kw.id, data.foundPosition, data.searchVolume)

            onKeywordsChange(
                keywords.map((k) =>
                    k.id === kw.id
                        ? {
                              ...k,
                              previousPosition: k.position,
                              position: data.foundPosition,
                              searchVolume: data.searchVolume || k.searchVolume,
                              lastChecked: new Date().toISOString(),
                          }
                        : k
                )
            )
        } catch {
            toast.error(`Failed to check "${kw.keyword}"`)
        } finally {
            setCheckingIds((prev) => {
                const next = new Set(prev)
                next.delete(kw.id)
                return next
            })
        }
    }

    async function handleCheckAll() {
        if (keywords.length === 0) return
        setIsCheckingAll(true)

        for (const kw of keywords) {
            await checkSingleKeyword(kw)
            // Small delay to respect rate limits
            await new Promise((r) => setTimeout(r, 500))
        }

        setIsCheckingAll(false)
        toast.success("All keywords checked")
    }

    function getPositionChange(kw: TrackedKeyword) {
        if (kw.position === null || kw.previousPosition === null) return null
        return kw.previousPosition - kw.position // positive = improved
    }

    return (
        <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
            <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <CardTitle className="text-base font-semibold">Keyword Position Tracker</CardTitle>
                        <CardDescription className="text-xs">
                            Track your Google rankings for target keywords via Serper API
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                            {keywords.length} keyword{keywords.length !== 1 ? "s" : ""}
                        </Badge>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] gap-1"
                            onClick={handleCheckAll}
                            disabled={isCheckingAll || keywords.length === 0}
                        >
                            {isCheckingAll ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <RefreshCw className="h-3 w-3" />
                            )}
                            Check All
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add Keyword */}
                <div className="flex gap-2">
                    <Input
                        placeholder="Enter keyword to track..."
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        className="h-9 text-sm"
                    />
                    <Button
                        size="sm"
                        className="h-9 gap-1 shrink-0"
                        onClick={handleAdd}
                        disabled={isAdding || !newKeyword.trim()}
                    >
                        {isAdding ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Plus className="h-3 w-3" />
                        )}
                        Add
                    </Button>
                </div>

                {/* Keywords List */}
                {keywords.length > 0 ? (
                    <div className="overflow-x-auto">
                    <div className="min-w-[500px] space-y-1">
                        {/* Header */}
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            <div className="col-span-4">Keyword</div>
                            <div className="col-span-2 text-center">Position</div>
                            <div className="col-span-2 text-center">Change</div>
                            <div className="col-span-2 text-center">Volume</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        {keywords.map((kw) => {
                            const change = getPositionChange(kw)
                            const isChecking = checkingIds.has(kw.id)

                            return (
                                <div
                                    key={kw.id}
                                    className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/10 transition-colors items-center"
                                >
                                    <div className="col-span-4">
                                        <span className="text-xs font-medium">{kw.keyword}</span>
                                        {kw.lastChecked && (
                                            <p className="text-[9px] text-muted-foreground mt-0.5">
                                                Checked {new Date(kw.lastChecked).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                    <div className="col-span-2 text-center">
                                        {kw.position !== null ? (
                                            <Badge
                                                variant="secondary"
                                                className={`text-[10px] font-bold h-5 px-1.5 ${
                                                    kw.position <= 3
                                                        ? "bg-emerald-500/10 text-emerald-500"
                                                        : kw.position <= 10
                                                        ? "bg-blue-500/10 text-blue-500"
                                                        : kw.position <= 20
                                                        ? "bg-amber-500/10 text-amber-500"
                                                        : "bg-rose-500/10 text-rose-500"
                                                }`}
                                            >
                                                #{kw.position}
                                            </Badge>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground">--</span>
                                        )}
                                    </div>
                                    <div className="col-span-2 flex items-center justify-center gap-1">
                                        {change !== null ? (
                                            <>
                                                {change > 0 ? (
                                                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                                                ) : change < 0 ? (
                                                    <ArrowDownRight className="h-3 w-3 text-rose-500" />
                                                ) : (
                                                    <div className="w-3 h-0.5 bg-muted-foreground/30" />
                                                )}
                                                <span
                                                    className={`text-[10px] font-bold ${
                                                        change > 0
                                                            ? "text-emerald-500"
                                                            : change < 0
                                                            ? "text-rose-500"
                                                            : "text-muted-foreground"
                                                    }`}
                                                >
                                                    {change > 0 ? `+${change}` : change === 0 ? "0" : String(change)}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground">--</span>
                                        )}
                                    </div>
                                    <div className="col-span-2 text-center">
                                        <span className="text-[10px] text-muted-foreground">
                                            {kw.searchVolume ? kw.searchVolume.toLocaleString() : "--"}
                                        </span>
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => checkSingleKeyword(kw)}
                                            disabled={isChecking}
                                        >
                                            {isChecking ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-3 w-3" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-500"
                                            onClick={() => handleRemove(kw.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    </div>
                ) : (
                    <div className="py-8 flex flex-col items-center justify-center text-muted-foreground">
                        <Target className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-xs">No keywords tracked yet</p>
                        <p className="text-[10px] mt-1">Add keywords above to track your Google rankings</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
