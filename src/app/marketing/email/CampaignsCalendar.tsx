"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Mail } from "lucide-react"

interface CalendarCampaign {
    id: string
    name: string
    subject: string
    status: string
    scheduledAt?: string
    sentAt?: string
    createdAt: string
}

export function CampaignsCalendar({ campaigns }: { campaigns: CalendarCampaign[] }) {
    const [cursor, setCursor] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })

    const monthLabel = cursor.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
    })

    // Build a 6-row × 7-col grid covering the full month including padding
    const cells = useMemo(() => buildMonthGrid(cursor), [cursor])

    // Bucket campaigns by YYYY-MM-DD they fall on (scheduled OR sent OR createdAt)
    const buckets = useMemo(() => {
        const m = new Map<string, CalendarCampaign[]>()
        for (const c of campaigns) {
            const dateStr = pickDate(c)
            if (!dateStr) continue
            const arr = m.get(dateStr) ?? []
            arr.push(c)
            m.set(dateStr, arr)
        }
        return m
    }, [campaigns])

    const today = new Date()
    const todayKey = formatDateKey(today)

    const goPrev = () =>
        setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
    const goNext = () =>
        setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
    const goToday = () =>
        setCursor(() => {
            const d = new Date()
            return new Date(d.getFullYear(), d.getMonth(), 1)
        })

    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={goPrev}
                        className="h-7 w-7"
                        title="Previous month"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h3 className="text-sm font-semibold tabular-nums min-w-[140px]">
                        {monthLabel}
                    </h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={goNext}
                        className="h-7 w-7"
                        title="Next month"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={goToday} className="h-7 ml-1">
                        Today
                    </Button>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <LegendDot color="bg-blue-500" label="Scheduled" />
                    <LegendDot color="bg-emerald-500" label="Sent" />
                    <LegendDot color="bg-muted-foreground/40" label="Draft" />
                </div>
            </div>

            <div className="grid grid-cols-7 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b bg-muted/10">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="px-2 py-1.5 text-center">
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7">
                {cells.map((cell, idx) => {
                    const key = formatDateKey(cell.date)
                    const items = buckets.get(key) ?? []
                    const isToday = key === todayKey
                    return (
                        <div
                            key={idx}
                            className={`min-h-[96px] border-b border-r last:border-r-0 px-1.5 py-1.5 ${
                                cell.inMonth
                                    ? "bg-card"
                                    : "bg-muted/20 text-muted-foreground/60"
                            } ${idx % 7 === 6 ? "border-r-0" : ""}`}
                        >
                            <div
                                className={`text-[10px] font-medium tabular-nums w-5 h-5 flex items-center justify-center rounded-full ${
                                    isToday
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {cell.date.getDate()}
                            </div>
                            <div className="mt-1 space-y-0.5">
                                {items.slice(0, 3).map((c) => (
                                    <CalendarPill key={c.id} campaign={c} />
                                ))}
                                {items.length > 3 && (
                                    <div className="text-[9px] text-muted-foreground pl-1">
                                        +{items.length - 3} more
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function CalendarPill({ campaign }: { campaign: CalendarCampaign }) {
    const tone =
        campaign.status === "scheduled"
            ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
            : campaign.status === "sent" || campaign.status === "sent_with_errors"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              : campaign.status === "sending"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                : campaign.status === "failed"
                  ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
                  : "bg-muted/60 text-muted-foreground border-border"
    const time = pickTime(campaign)
    return (
        <Link
            href={`/marketing/email/campaigns/${campaign.id}`}
            className={`block text-[10px] px-1.5 py-0.5 rounded border truncate hover:brightness-110 transition-all ${tone}`}
            title={`${campaign.name} — ${campaign.subject}`}
        >
            {time && (
                <span className="opacity-70 tabular-nums mr-1 font-medium">{time}</span>
            )}
            <span className="font-medium">{campaign.name}</span>
        </Link>
    )
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label}
        </span>
    )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pickDate(c: CalendarCampaign): string | null {
    const raw = c.scheduledAt || c.sentAt || c.createdAt
    if (!raw) return null
    const d = new Date(raw)
    if (isNaN(d.getTime())) return null
    return formatDateKey(d)
}

function pickTime(c: CalendarCampaign): string | null {
    const raw = c.scheduledAt || c.sentAt
    if (!raw) return null
    const d = new Date(raw)
    if (isNaN(d.getTime())) return null
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

function formatDateKey(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}

interface DayCell {
    date: Date
    inMonth: boolean
}

function buildMonthGrid(cursor: Date): DayCell[] {
    const out: DayCell[] = []
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const offset = first.getDay() // 0 = Sunday
    const start = new Date(first)
    start.setDate(1 - offset)
    for (let i = 0; i < 42; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        out.push({ date: d, inMonth: d.getMonth() === cursor.getMonth() })
    }
    return out
}
