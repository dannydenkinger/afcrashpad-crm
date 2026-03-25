"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, Check, CheckCheck, Loader2, ExternalLink } from "lucide-react"
import { getNotifications, markAsRead, markAllAsRead } from "./actions"
import { useRouter } from "next/navigation"
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh"
import { VirtualList } from "@/components/ui/VirtualList"
import { isToday, isYesterday, isThisWeek } from "date-fns"

type Notification = {
    id: string
    title: string
    message: string
    type: string
    linkUrl: string | null
    isRead: boolean
    createdAt: string | null
}

const TYPE_OPTIONS = ["all", "opportunity", "contact", "task", "checkin", "checkout"] as const

export default function NotificationsPage() {
    const router = useRouter()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<"all" | "unread">("all")
    const [typeFilter, setTypeFilter] = useState<string>("all")

    const fetchData = useCallback(async () => {
        const res = await getNotifications(100)
        if (res.success) {
            setNotifications(res.notifications)
            setUnreadCount(res.unreadCount)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Auto-refresh when push notification arrives or tab regains focus
    useRealtimeRefresh(fetchData)

    const handleMarkRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
        await markAsRead(id)
    }

    const handleMarkAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        setUnreadCount(0)
        await markAllAsRead()
    }

    const handleClick = async (notif: Notification) => {
        if (!notif.isRead) {
            handleMarkRead(notif.id)
        }
        if (notif.linkUrl) {
            router.push(notif.linkUrl)
        }
    }

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return ""
        const d = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - d.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return d.toLocaleDateString()
    }

    const typeColor = (type: string) => {
        switch (type) {
            case "opportunity": return "bg-emerald-500"
            case "contact": return "bg-blue-500"
            case "checkin": return "bg-amber-500"
            case "checkout": return "bg-purple-500"
            case "task": return "bg-rose-500"
            default: return "bg-slate-500"
        }
    }

    const typeLabel = (type: string) => {
        switch (type) {
            case "opportunity": return "Deal"
            case "contact": return "Contact"
            case "checkin": return "Check-in"
            case "checkout": return "Check-out"
            case "task": return "Task"
            default: return type || "System"
        }
    }

    const filtered = useMemo(() => {
        let result = notifications
        if (filter === "unread") result = result.filter(n => !n.isRead)
        if (typeFilter !== "all") result = result.filter(n => n.type === typeFilter)
        return result
    }, [notifications, filter, typeFilter])

    const groupedNotifications = useMemo(() => {
        const groups: { key: string; label: string; items: Notification[] }[] = [
            { key: "today", label: "Today", items: [] },
            { key: "yesterday", label: "Yesterday", items: [] },
            { key: "thisWeek", label: "This Week", items: [] },
            { key: "older", label: "Older", items: [] },
        ]
        for (const n of filtered) {
            if (!n.createdAt) { groups[3].items.push(n); continue }
            const d = new Date(n.createdAt)
            if (isToday(d)) groups[0].items.push(n)
            else if (isYesterday(d)) groups[1].items.push(n)
            else if (isThisWeek(d, { weekStartsOn: 1 })) groups[2].items.push(n)
            else groups[3].items.push(n)
        }
        return groups.filter(g => g.items.length > 0)
    }, [filtered])

    if (loading) {
        return (
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-6 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-28 md:pb-8">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Notifications
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Loading...</p>
                    </div>
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-20 bg-muted/10 rounded-lg animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-28 md:pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Notifications
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-muted/30 p-0.5 rounded-md">
                            {(["all", "unread"] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-all capitalize min-h-[44px] sm:min-h-0 touch-manipulation ${filter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        {unreadCount > 0 && (
                            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5">
                                <CheckCheck className="h-3.5 w-3.5" />
                                Mark all read
                            </Button>
                        )}
                    </div>
                </div>

                {/* Type Filter Chips */}
                <div className="flex items-center gap-1.5 flex-wrap -mt-2">
                    {TYPE_OPTIONS.map(t => (
                        <button
                            key={t}
                            onClick={() => setTypeFilter(t)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors border touch-manipulation ${
                                typeFilter === t
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                            }`}
                        >
                            {t === "all" ? "All Types" : typeLabel(t)}
                        </button>
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <Card className="border-none shadow-md bg-card/40 backdrop-blur-md">
                        <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground">
                            <Bell className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">
                                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                            </p>
                            <p className="text-sm mt-1">
                                {filter === "unread" ? "You're all caught up!" : "Notifications will appear here as activity happens."}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {groupedNotifications.map(group => (
                            <div key={group.key}>
                                <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-2 px-1">
                                    {group.label}
                                    <span className="ml-1.5 text-muted-foreground/50">{group.items.length}</span>
                                </h3>
                                <div className="space-y-2">
                                    {group.items.map(notif => (
                                        <Card
                                            key={notif.id}
                                            className={`border-none shadow-sm transition-colors cursor-pointer ${notif.isRead ? "bg-card/30 hover:bg-card/50" : "bg-card/60 hover:bg-card/80 ring-1 ring-primary/10"}`}
                                            onClick={() => handleClick(notif)}
                                        >
                                            <CardContent className="flex items-start gap-3 py-4 px-4 sm:px-5">
                                                <div className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${notif.isRead ? "bg-transparent" : typeColor(notif.type)}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className={`text-sm font-medium ${notif.isRead ? "text-muted-foreground" : "text-foreground"}`}>
                                                                    {notif.title}
                                                                </span>
                                                                <Badge variant="outline" className="text-xs h-4 px-1.5 shrink-0">
                                                                    {typeLabel(notif.type)}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                                {formatTime(notif.createdAt)}
                                                            </span>
                                                            {notif.linkUrl && (
                                                                <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {!notif.isRead && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleMarkRead(notif.id)
                                                        }}
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                        <span className="sr-only">Mark as read</span>
                                                    </Button>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
