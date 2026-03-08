"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Mail, Eye, MousePointerClick, MessageSquareReply, Clock,
    TrendingUp, X, BarChart3, ArrowLeft
} from "lucide-react"
import { getCommunicationAnalytics } from "./actions"

interface Analytics {
    totalEmailsAllTime: number
    totalEmailsThisMonth: number
    openRate: number
    openRateThisMonth: number
    clickRate: number
    responseRate: number
    repliesReceived: number
    contactsEmailed: number
    bestHours: { hour: number; count: number }[]
    hourHistogram: number[]
    dailyActivity: { date: string; sent: number; opened: number; clicked: number }[]
}

interface AnalyticsPanelProps {
    onClose: () => void
}

export default function AnalyticsPanel({ onClose }: AnalyticsPanelProps) {
    const [analytics, setAnalytics] = useState<Analytics | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetch = async () => {
            setIsLoading(true)
            const res = await getCommunicationAnalytics()
            if (res.success && res.analytics) {
                setAnalytics(res.analytics as Analytics)
            }
            setIsLoading(false)
        }
        fetch()
    }, [])

    const formatHour = (h: number) => {
        if (h === 0) return "12 AM"
        if (h === 12) return "12 PM"
        return h > 12 ? `${h - 12} PM` : `${h} AM`
    }

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex items-center justify-between bg-muted/20 shrink-0">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8 -ml-2" onClick={onClose}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <BarChart3 className="h-5 w-5 text-primary" />
                        <h3 className="text-sm font-semibold">Communication Analytics</h3>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground hidden sm:block">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    Loading analytics...
                </div>
            </div>
        )
    }

    if (!analytics) {
        return (
            <div className="flex-1 flex flex-col">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex items-center justify-between bg-muted/20 shrink-0">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8 -ml-2" onClick={onClose}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <BarChart3 className="h-5 w-5 text-primary" />
                        <h3 className="text-sm font-semibold">Communication Analytics</h3>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground hidden sm:block">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    Failed to load analytics.
                </div>
            </div>
        )
    }

    const maxDailySent = Math.max(...analytics.dailyActivity.map(d => d.sent), 1)

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex items-center justify-between bg-muted/20 shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8 -ml-2" onClick={onClose}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h3 className="text-sm font-semibold">Communication Analytics</h3>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground hidden sm:block">
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Mail className="h-4 w-4 text-blue-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold">{analytics.totalEmailsThisMonth}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Emails This Month</p>
                        <p className="text-xs text-muted-foreground mt-1">{analytics.totalEmailsAllTime} all time</p>
                    </div>

                    <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <Eye className="h-4 w-4 text-emerald-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold">{analytics.openRate}%</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Open Rate</p>
                        <p className="text-xs text-muted-foreground mt-1">{analytics.openRateThisMonth}% this month</p>
                    </div>

                    <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <MousePointerClick className="h-4 w-4 text-purple-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold">{analytics.clickRate}%</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Click Rate</p>
                    </div>

                    <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <MessageSquareReply className="h-4 w-4 text-amber-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold">{analytics.responseRate}%</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Response Rate</p>
                        <p className="text-xs text-muted-foreground mt-1">{analytics.repliesReceived} / {analytics.contactsEmailed} contacts</p>
                    </div>
                </div>

                {/* Best Send Times */}
                <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-semibold">Best Send Times</h4>
                        <span className="text-[10px] text-muted-foreground">(based on opens)</span>
                    </div>

                    {analytics.bestHours.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Not enough data yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {analytics.bestHours.map((h, i) => {
                                const maxCount = analytics.bestHours[0].count || 1
                                const pct = Math.round((h.count / maxCount) * 100)
                                return (
                                    <div key={h.hour} className="flex items-center gap-3">
                                        <span className="text-xs font-medium w-16 shrink-0">{formatHour(h.hour)}</span>
                                        <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${
                                                    i === 0 ? "bg-primary" : i === 1 ? "bg-primary/70" : "bg-primary/40"
                                                }`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground w-12 text-right shrink-0">
                                            {h.count} open{h.count !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Hour histogram */}
                    <div className="mt-4 pt-4 border-t">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Opens by Hour of Day</p>
                        <div className="flex items-end gap-0.5 h-16">
                            {analytics.hourHistogram.map((count, hour) => {
                                const maxH = Math.max(...analytics.hourHistogram, 1)
                                const height = Math.max((count / maxH) * 100, 2)
                                return (
                                    <div
                                        key={hour}
                                        className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors cursor-default relative group"
                                        style={{ height: `${height}%` }}
                                        title={`${formatHour(hour)}: ${count} opens`}
                                    >
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-foreground text-background text-[8px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                            {formatHour(hour)}: {count}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-[8px] text-muted-foreground">12 AM</span>
                            <span className="text-[8px] text-muted-foreground">6 AM</span>
                            <span className="text-[8px] text-muted-foreground">12 PM</span>
                            <span className="text-[8px] text-muted-foreground">6 PM</span>
                            <span className="text-[8px] text-muted-foreground">11 PM</span>
                        </div>
                    </div>
                </div>

                {/* 30-Day Activity Chart */}
                <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-semibold">30-Day Activity</h4>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                            <span className="text-[10px] text-muted-foreground">Sent</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] text-muted-foreground">Opened</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-purple-500" />
                            <span className="text-[10px] text-muted-foreground">Clicked</span>
                        </div>
                    </div>

                    <div className="flex items-end gap-0.5 h-24">
                        {analytics.dailyActivity.map((day, i) => {
                            const sentH = Math.max((day.sent / maxDailySent) * 100, 0)
                            const openedH = Math.max((day.opened / maxDailySent) * 100, 0)
                            const clickedH = Math.max((day.clicked / maxDailySent) * 100, 0)

                            return (
                                <div
                                    key={day.date}
                                    className="flex-1 flex flex-col items-center gap-0 relative group cursor-default"
                                    title={`${day.date}: ${day.sent} sent, ${day.opened} opened, ${day.clicked} clicked`}
                                >
                                    <div className="w-full flex flex-col-reverse items-center">
                                        {day.sent > 0 && (
                                            <div
                                                className="w-full bg-blue-500/30 rounded-t-sm"
                                                style={{ height: `${sentH}%`, minHeight: day.sent > 0 ? '2px' : '0' }}
                                            />
                                        )}
                                    </div>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-foreground text-background text-[8px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: {day.sent}s / {day.opened}o / {day.clicked}c
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="flex justify-between mt-1">
                        <span className="text-[8px] text-muted-foreground">
                            {new Date(analytics.dailyActivity[0]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-[8px] text-muted-foreground">
                            {new Date(analytics.dailyActivity[analytics.dailyActivity.length - 1]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
