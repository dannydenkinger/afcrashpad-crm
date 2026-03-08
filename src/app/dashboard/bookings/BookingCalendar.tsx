"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, MapPin, CalendarDays, Users, DollarSign, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { getBookingsData } from "./actions"
import type { BookingEntry, OverlapGroup, BookingsData } from "./types"

const BASE_COLORS = [
    { bg: "bg-blue-500/25", border: "border-blue-500/50", text: "text-blue-400" },
    { bg: "bg-emerald-500/25", border: "border-emerald-500/50", text: "text-emerald-400" },
    { bg: "bg-violet-500/25", border: "border-violet-500/50", text: "text-violet-400" },
    { bg: "bg-rose-500/25", border: "border-rose-500/50", text: "text-rose-400" },
    { bg: "bg-cyan-500/25", border: "border-cyan-500/50", text: "text-cyan-400" },
    { bg: "bg-indigo-500/25", border: "border-indigo-500/50", text: "text-indigo-400" },
    { bg: "bg-pink-500/25", border: "border-pink-500/50", text: "text-pink-400" },
    { bg: "bg-teal-500/25", border: "border-teal-500/50", text: "text-teal-400" },
    { bg: "bg-orange-500/25", border: "border-orange-500/50", text: "text-orange-400" },
    { bg: "bg-fuchsia-500/25", border: "border-fuchsia-500/50", text: "text-fuchsia-400" },
]

const BASE_COLOR_DOTS = [
    "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500", "bg-cyan-500",
    "bg-indigo-500", "bg-pink-500", "bg-teal-500", "bg-orange-500", "bg-fuchsia-500",
]

function getBaseColor(base: string, baseList: string[]) {
    const idx = baseList.indexOf(base)
    return BASE_COLORS[(idx >= 0 ? idx : 0) % BASE_COLORS.length]
}

function formatCurrency(value: number) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
}

function formatDateShort(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00")
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function daysBetween(a: string, b: string): number {
    return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
}

export function BookingCalendar() {
    const [data, setData] = useState<BookingsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [filterBase, setFilterBase] = useState<string>("all")
    const [viewWeeks, setViewWeeks] = useState(16)
    const [startOffset, setStartOffset] = useState(0)

    useEffect(() => {
        getBookingsData().then(res => {
            if (res.success && res.data) setData(res.data)
            setLoading(false)
        })
    }, [])

    const filteredBookings = useMemo(() => {
        if (!data) return []
        if (filterBase === "all") return data.bookings
        return data.bookings.filter(b => b.base === filterBase)
    }, [data, filterBase])

    const filteredOverlaps = useMemo(() => {
        if (!data) return []
        if (filterBase === "all") return data.overlaps
        return data.overlaps.filter(o => o.base === filterBase)
    }, [data, filterBase])

    const timelineStart = useMemo(() => {
        const d = new Date()
        d.setDate(d.getDate() + startOffset * 7)
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
        return d
    }, [startOffset])

    const timelineEnd = useMemo(() => {
        const d = new Date(timelineStart)
        d.setDate(d.getDate() + viewWeeks * 7)
        return d
    }, [timelineStart, viewWeeks])

    // Group bookings by base
    const baseGrouped = useMemo(() => {
        const groups: Record<string, BookingEntry[]> = {}
        for (const b of filteredBookings) {
            const start = new Date(b.startDate)
            const end = new Date(b.endDate)
            if (end >= timelineStart && start <= timelineEnd) {
                if (!groups[b.base]) groups[b.base] = []
                groups[b.base].push(b)
            }
        }
        for (const base of Object.keys(groups)) {
            groups[base].sort((a, b) => a.startDate.localeCompare(b.startDate))
        }
        return groups
    }, [filteredBookings, timelineStart, timelineEnd])

    // Week labels
    const weekLabels = useMemo(() => {
        const labels: { label: string; date: Date; monthLabel?: string }[] = []
        let lastMonth = -1
        for (let w = 0; w < viewWeeks; w++) {
            const d = new Date(timelineStart)
            d.setDate(d.getDate() + w * 7)
            const month = d.getMonth()
            labels.push({
                label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                date: d,
                monthLabel: month !== lastMonth ? d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : undefined,
            })
            lastMonth = month
        }
        return labels
    }, [timelineStart, viewWeeks])

    // Today position
    const todayPercent = useMemo(() => {
        const now = new Date()
        if (now < timelineStart || now > timelineEnd) return null
        return ((now.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())) * 100
    }, [timelineStart, timelineEnd])

    function getBarPosition(startDate: string, endDate: string) {
        const start = Math.max(new Date(startDate).getTime(), timelineStart.getTime())
        const end = Math.min(new Date(endDate).getTime(), timelineEnd.getTime())
        const tlStart = timelineStart.getTime()
        const tlEnd = timelineEnd.getTime()
        const tlRange = tlEnd - tlStart

        const left = ((start - tlStart) / tlRange) * 100
        const width = ((end - start) / tlRange) * 100

        return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, Math.max(width, 1.5))}%` }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!data) {
        return <div className="text-center py-20 text-muted-foreground">Failed to load stay data.</div>
    }

    const baseList = data.bases
    const overlapCount = filteredOverlaps.length
    const totalArbitrageRevenue = filteredOverlaps.reduce((s, o) => s + o.combinedRevenue, 0)

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Stays</CardTitle>
                        <CalendarDays className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredBookings.length}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">With dates assigned</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bases</CardTitle>
                        <MapPin className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{baseList.length}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">With active travelers</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overlap Opportunities</CardTitle>
                        <Users className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{overlapCount}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Same base, overlapping dates</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Arbitrage Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalArbitrageRevenue)}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Combined overlap deal value</p>
                    </CardContent>
                </Card>
            </div>

            {/* Overlap Alerts */}
            {filteredOverlaps.length > 0 && (
                <Card className="border-emerald-500/30 shadow-md bg-emerald-500/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-emerald-500" />
                            Arbitrage Opportunities
                        </CardTitle>
                        <CardDescription>
                            Travelers at the same base with overlapping dates — pair them in one property for 2x government rate, 1x host cost.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {filteredOverlaps.slice(0, 10).map((overlap, i) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border bg-card/60">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="text-[10px] font-semibold">
                                            <MapPin className="h-3 w-3 mr-1" />
                                            {overlap.base}
                                        </Badge>
                                        <Badge variant="secondary" className="text-[10px] text-emerald-600">
                                            {overlap.overlapDays} overlapping days
                                        </Badge>
                                    </div>
                                    <div className="mt-1.5 text-sm">
                                        <span className="font-medium">{overlap.travelers[0].name}</span>
                                        <span className="text-muted-foreground mx-1.5">&</span>
                                        <span className="font-medium">{overlap.travelers[1].name}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {formatDateShort(overlap.overlapStart)} → {formatDateShort(overlap.overlapEnd)}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-sm font-bold text-emerald-600">{formatCurrency(overlap.combinedRevenue)}</div>
                                    <div className="text-[10px] text-muted-foreground">combined value</div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Base Legend */}
            <div className="flex flex-wrap items-center gap-4 px-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Base:</span>
                {baseList.map((base, i) => (
                    <div key={base} className="flex items-center gap-1.5">
                        <div className={`h-2.5 w-2.5 rounded-sm ${BASE_COLOR_DOTS[i % BASE_COLOR_DOTS.length]}`} />
                        <span className="text-[10px] text-muted-foreground font-medium">{base}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                    <span className="text-[10px] text-muted-foreground font-medium">Overlap</span>
                </div>
            </div>

            {/* Gantt Timeline */}
            <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 p-4 sm:p-6 pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Stay Timeline
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Select value={filterBase} onValueChange={setFilterBase}>
                            <SelectTrigger className="h-8 w-[160px] text-xs">
                                <SelectValue placeholder="All Bases" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Bases</SelectItem>
                                {baseList.map(base => (
                                    <SelectItem key={base} value={base}>{base}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={String(viewWeeks)} onValueChange={(v) => setViewWeeks(Number(v))}>
                            <SelectTrigger className="h-8 w-[120px] text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="8">2 Months</SelectItem>
                                <SelectItem value="12">3 Months</SelectItem>
                                <SelectItem value="16">4 Months</SelectItem>
                                <SelectItem value="26">6 Months</SelectItem>
                                <SelectItem value="52">12 Months</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStartOffset(o => o - 4)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => setStartOffset(0)}>
                                Today
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStartOffset(o => o + 4)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 px-2 sm:px-6">
                    <div className="overflow-x-auto pt-5">
                        <div className={`relative ${viewWeeks <= 12 ? "min-w-[900px]" : viewWeeks <= 26 ? "min-w-[1200px]" : "min-w-[1800px]"}`}>
                            {/* Month headers */}
                            <div className="flex">
                                <div className="w-36 sm:w-44 shrink-0" />
                                <div className="flex-1 flex">
                                    {weekLabels.map((w, i) => (
                                        w.monthLabel ? (
                                            <div
                                                key={`month-${i}`}
                                                className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider px-1 pb-0.5"
                                                style={{ width: `${100 / viewWeeks}%` }}
                                            >
                                                {w.monthLabel}
                                            </div>
                                        ) : (
                                            <div key={`month-${i}`} style={{ width: `${100 / viewWeeks}%` }} />
                                        )
                                    ))}
                                </div>
                            </div>

                            {/* Week headers */}
                            <div className="flex border-b border-border/30 mb-1">
                                <div className="w-36 sm:w-44 shrink-0 text-[10px] font-semibold text-muted-foreground px-2 py-1.5">
                                    Base / Traveler
                                </div>
                                <div className="flex-1 flex">
                                    {weekLabels.map((w, i) => (
                                        <div
                                            key={i}
                                            className="text-[10px] text-muted-foreground font-medium border-l border-border/20 px-1 py-1.5"
                                            style={{ width: `${100 / viewWeeks}%` }}
                                        >
                                            {w.label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Base groups */}
                            {Object.entries(baseGrouped).length === 0 && (
                                <div className="text-center py-12 text-muted-foreground text-sm">
                                    No stays in this date range.
                                </div>
                            )}
                            {Object.entries(baseGrouped).map(([base, travelers]) => (
                                <div key={base} className="mb-2">
                                    {/* Base header */}
                                    <div className="flex items-center gap-2 px-2 py-2 bg-muted/10 rounded-lg mb-1">
                                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs font-bold">{base}</span>
                                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                                            {travelers.length} {travelers.length === 1 ? "traveler" : "travelers"}
                                        </Badge>
                                        {travelers.length >= 2 && (
                                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 text-amber-600 bg-amber-500/10 border-amber-500/20">
                                                Overlap detected
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Traveler bars */}
                                    {travelers.map(traveler => {
                                        const pos = getBarPosition(traveler.startDate, traveler.endDate)
                                        const isOverlap = filteredOverlaps.some(o =>
                                            o.travelers.some(t => t.id === traveler.id)
                                        )
                                        const stageColor = isOverlap
                                            ? { bg: "bg-amber-500/25", border: "border-amber-500/50", text: "text-amber-400" }
                                            : getBaseColor(traveler.base, baseList)
                                        const duration = daysBetween(traveler.startDate, traveler.endDate)

                                        return (
                                            <div key={traveler.id} className="flex items-center group">
                                                <div className="w-36 sm:w-44 shrink-0 px-2 py-1.5">
                                                    <div className="text-xs font-semibold truncate">{traveler.name}</div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                                        <span>{formatDateShort(traveler.startDate)} → {formatDateShort(traveler.endDate)}</span>
                                                        <span className="text-muted-foreground/40">·</span>
                                                        <span>{duration}d</span>
                                                    </div>
                                                </div>
                                                <div className="flex-1 relative h-10">
                                                    {/* Week grid lines */}
                                                    {weekLabels.map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className="absolute top-0 bottom-0 border-l border-border/10"
                                                            style={{ left: `${(i / viewWeeks) * 100}%` }}
                                                        />
                                                    ))}
                                                    {/* Bar */}
                                                    <div
                                                        className={`absolute top-1 bottom-1 rounded-md border transition-all cursor-default
                                                            ${stageColor.bg} ${stageColor.border}
                                                            ${isOverlap ? "ring-1 ring-amber-500/30" : ""}
                                                        `}
                                                        style={{ left: pos.left, width: pos.width, minWidth: "24px" }}
                                                    >
                                                        <div className={`px-2 text-[10px] font-semibold truncate leading-8 h-full flex items-center gap-1.5 ${stageColor.text}`}>
                                                            <span className="truncate">{traveler.name.split(" ")[0]}</span>
                                                            {isOverlap && <span className="shrink-0">⚡</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}

                            {/* Today marker */}
                            {todayPercent !== null && (
                                <div
                                    className="absolute -top-5 bottom-0 pointer-events-none z-10"
                                    style={{ left: `calc(9rem + (100% - 9rem) * ${todayPercent / 100})` }}
                                >
                                    <div className="w-px h-full bg-rose-500/60" />
                                    <div className="absolute top-0 -left-[11px] bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                        Today
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
