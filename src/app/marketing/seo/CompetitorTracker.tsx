"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Plus,
    Trash2,
    RefreshCw,
    Loader2,
    Globe,
    Gauge,
    Zap,
    Shield,
} from "lucide-react"
import { toast } from "sonner"
import {
    addTrackedCompetitor,
    removeTrackedCompetitor,
    updateCompetitorPageSpeed,
} from "./actions"
import type { TrackedCompetitor, PageSpeedMetrics } from "./types"

interface CompetitorTrackerProps {
    competitors: TrackedCompetitor[]
    onCompetitorsChange: (competitors: TrackedCompetitor[]) => void
    ownPageSpeed: PageSpeedMetrics | null
}

function getScoreColor(score: number): string {
    if (score >= 90) return "text-emerald-500"
    if (score >= 50) return "text-amber-500"
    return "text-rose-500"
}

function getScoreBg(score: number): string {
    if (score >= 90) return "bg-emerald-500/10"
    if (score >= 50) return "bg-amber-500/10"
    return "bg-rose-500/10"
}

export default function CompetitorTracker({
    competitors,
    onCompetitorsChange,
    ownPageSpeed,
}: CompetitorTrackerProps) {
    const [newDomain, setNewDomain] = useState("")
    const [newName, setNewName] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [scanningIds, setScanningIds] = useState<Set<string>>(new Set())
    const [isScanningAll, setIsScanningAll] = useState(false)

    async function handleAdd() {
        const domain = newDomain.trim()
        const name = newName.trim() || domain
        if (!domain) return

        if (competitors.some((c) => c.domain === domain.replace("www.", "").toLowerCase())) {
            toast.error("Competitor already tracked")
            return
        }

        setIsAdding(true)
        const result = await addTrackedCompetitor(domain, name)
        if (result.success && result.data) {
            onCompetitorsChange([result.data, ...competitors])
            setNewDomain("")
            setNewName("")
            toast.success(`Added ${name}`)
        } else {
            toast.error(result.error || "Failed to add competitor")
        }
        setIsAdding(false)
    }

    async function handleRemove(id: string) {
        const result = await removeTrackedCompetitor(id)
        if (result.success) {
            onCompetitorsChange(competitors.filter((c) => c.id !== id))
            toast.success("Competitor removed")
        } else {
            toast.error(result.error || "Failed to remove competitor")
        }
    }

    async function scanCompetitor(comp: TrackedCompetitor) {
        setScanningIds((prev) => new Set(prev).add(comp.id))

        try {
            const url = comp.domain.startsWith("http") ? comp.domain : `https://${comp.domain}`
            const res = await fetch("/api/seo/pagespeed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, strategy: "mobile" }),
            })

            if (!res.ok) throw new Error("PageSpeed scan failed")

            const pageSpeed: PageSpeedMetrics = await res.json()
            await updateCompetitorPageSpeed(comp.id, pageSpeed)

            onCompetitorsChange(
                competitors.map((c) =>
                    c.id === comp.id
                        ? { ...c, pageSpeed, lastChecked: new Date().toISOString() }
                        : c
                )
            )
            toast.success(`Scanned ${comp.name}`)
        } catch {
            toast.error(`Failed to scan ${comp.name}`)
        } finally {
            setScanningIds((prev) => {
                const next = new Set(prev)
                next.delete(comp.id)
                return next
            })
        }
    }

    async function handleScanAll() {
        if (competitors.length === 0) return
        setIsScanningAll(true)

        for (const comp of competitors) {
            await scanCompetitor(comp)
            await new Promise((r) => setTimeout(r, 1000))
        }

        setIsScanningAll(false)
        toast.success("All competitors scanned")
    }

    return (
        <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
            <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <CardTitle className="text-base font-semibold">Competitor Analysis</CardTitle>
                        <CardDescription className="text-xs">
                            Compare PageSpeed & SEO scores against competitors
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                            {competitors.length} site{competitors.length !== 1 ? "s" : ""}
                        </Badge>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] gap-1"
                            onClick={handleScanAll}
                            disabled={isScanningAll || competitors.length === 0}
                        >
                            {isScanningAll ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <RefreshCw className="h-3 w-3" />
                            )}
                            Scan All
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add Competitor */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        placeholder="competitor.com"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        className="h-9 text-sm flex-1"
                    />
                    <Input
                        placeholder="Name (optional)"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        className="h-9 text-sm sm:w-40"
                    />
                    <Button
                        size="sm"
                        className="h-9 gap-1 shrink-0"
                        onClick={handleAdd}
                        disabled={isAdding || !newDomain.trim()}
                    >
                        {isAdding ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Plus className="h-3 w-3" />
                        )}
                        Add
                    </Button>
                </div>

                {/* Comparison Grid */}
                {(ownPageSpeed || competitors.some((c) => c.pageSpeed)) && (
                    <div className="overflow-x-auto">
                    <div className="min-w-[600px] space-y-1">
                        {/* Header */}
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            <div className="col-span-3">Site</div>
                            <div className="col-span-2 text-center">Performance</div>
                            <div className="col-span-2 text-center">SEO</div>
                            <div className="col-span-1 text-center">LCP</div>
                            <div className="col-span-1 text-center">CLS</div>
                            <div className="col-span-1 text-center">TBT</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        {/* Your site row */}
                        {ownPageSpeed && (
                            <div className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/10 items-center">
                                <div className="col-span-3 flex items-center gap-2">
                                    <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center">
                                        <Globe className="h-3 w-3 text-primary" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold">Your Site</span>
                                        <Badge className="ml-1.5 text-[8px] h-3.5 bg-primary text-primary-foreground">You</Badge>
                                    </div>
                                </div>
                                <div className="col-span-2 text-center">
                                    <Badge className={`text-[10px] font-bold h-5 px-1.5 ${getScoreBg(ownPageSpeed.performanceScore)} ${getScoreColor(ownPageSpeed.performanceScore)}`}>
                                        {ownPageSpeed.performanceScore}
                                    </Badge>
                                </div>
                                <div className="col-span-2 text-center">
                                    <Badge className={`text-[10px] font-bold h-5 px-1.5 ${getScoreBg(ownPageSpeed.seoScore)} ${getScoreColor(ownPageSpeed.seoScore)}`}>
                                        {ownPageSpeed.seoScore}
                                    </Badge>
                                </div>
                                <div className="col-span-1 text-center text-[10px] font-medium">{(ownPageSpeed.lcp / 1000).toFixed(1)}s</div>
                                <div className="col-span-1 text-center text-[10px] font-medium">{ownPageSpeed.cls.toFixed(3)}</div>
                                <div className="col-span-1 text-center text-[10px] font-medium">{Math.round(ownPageSpeed.tbt)}ms</div>
                                <div className="col-span-2" />
                            </div>
                        )}

                        {/* Competitor rows */}
                        {competitors
                            .filter((c) => c.pageSpeed)
                            .map((comp) => {
                                const ps = comp.pageSpeed!
                                return (
                                    <div
                                        key={comp.id}
                                        className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/10 transition-colors items-center"
                                    >
                                        <div className="col-span-3 flex items-center gap-2">
                                            <div className="h-6 w-6 rounded bg-muted/30 flex items-center justify-center">
                                                <Globe className="h-3 w-3 text-muted-foreground" />
                                            </div>
                                            <div className="truncate">
                                                <span className="text-xs font-medium">{comp.name}</span>
                                                <p className="text-[9px] text-muted-foreground truncate">{comp.domain}</p>
                                            </div>
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <Badge className={`text-[10px] font-bold h-5 px-1.5 ${getScoreBg(ps.performanceScore)} ${getScoreColor(ps.performanceScore)}`}>
                                                {ps.performanceScore}
                                            </Badge>
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <Badge className={`text-[10px] font-bold h-5 px-1.5 ${getScoreBg(ps.seoScore)} ${getScoreColor(ps.seoScore)}`}>
                                                {ps.seoScore}
                                            </Badge>
                                        </div>
                                        <div className="col-span-1 text-center text-[10px] font-medium">{(ps.lcp / 1000).toFixed(1)}s</div>
                                        <div className="col-span-1 text-center text-[10px] font-medium">{ps.cls.toFixed(3)}</div>
                                        <div className="col-span-1 text-center text-[10px] font-medium">{Math.round(ps.tbt)}ms</div>
                                        <div className="col-span-2 flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => scanCompetitor(comp)}
                                                disabled={scanningIds.has(comp.id)}
                                            >
                                                {scanningIds.has(comp.id) ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="h-3 w-3" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-500"
                                                onClick={() => handleRemove(comp.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                    </div>
                )}

                {/* Unscanned competitors */}
                {competitors.filter((c) => !c.pageSpeed).length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-1">
                            Awaiting Scan
                        </p>
                        {competitors
                            .filter((c) => !c.pageSpeed)
                            .map((comp) => (
                                <div
                                    key={comp.id}
                                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/10 border border-white/5"
                                >
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                        <div>
                                            <span className="text-xs font-medium">{comp.name}</span>
                                            <span className="text-[10px] text-muted-foreground ml-2">{comp.domain}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 text-[10px] gap-1"
                                            onClick={() => scanCompetitor(comp)}
                                            disabled={scanningIds.has(comp.id)}
                                        >
                                            {scanningIds.has(comp.id) ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Gauge className="h-3 w-3" />
                                            )}
                                            Scan
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-500"
                                            onClick={() => handleRemove(comp.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                {competitors.length === 0 && !ownPageSpeed && (
                    <div className="py-8 flex flex-col items-center justify-center text-muted-foreground">
                        <Globe className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-xs">No competitors tracked yet</p>
                        <p className="text-[10px] mt-1">Add competitor domains to compare performance</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
