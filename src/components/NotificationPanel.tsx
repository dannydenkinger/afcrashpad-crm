"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, Check, CheckCheck, X, ExternalLink } from "lucide-react"
import { getNotifications, markAsRead, markAllAsRead } from "@/app/notifications/actions"
import { useRouter } from "next/navigation"
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh"

type Notification = {
    id: string
    title: string
    message: string
    type: string
    linkUrl: string | null
    isRead: boolean
    createdAt: string | null
}

interface NotificationPanelProps {
    open: boolean
    onClose: () => void
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
    const router = useRouter()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<"all" | "unread">("all")

    const fetchData = useCallback(async () => {
        const res = await getNotifications(100)
        if (res.success) {
            setNotifications(res.notifications)
            setUnreadCount(res.unreadCount)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (open) {
            fetchData()
        }
    }, [open, fetchData])

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
            onClose()
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

    const filtered = filter === "unread"
        ? notifications.filter(n => !n.isRead)
        : notifications

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={`fixed inset-y-0 right-0 z-[70] w-full sm:w-[400px] bg-background border-l shadow-2xl transition-transform duration-300 ease-out flex flex-col ${open ? "translate-x-0" : "translate-x-full"}`}
                role="dialog"
                aria-label="Notifications"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">Notifications</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5 h-8 text-xs">
                                <CheckCheck className="h-3.5 w-3.5" />
                                Mark all read
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" aria-label="Close notifications">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Filter tabs */}
                <div className="px-4 sm:px-5 py-2.5 border-b shrink-0">
                    <div className="flex bg-muted/30 p-0.5 rounded-md w-fit">
                        {(["all", "unread"] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-all capitalize ${filter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    {loading ? (
                        <div className="space-y-3 p-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-16 bg-muted/10 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <Bell className="h-10 w-10 mb-3 opacity-20" />
                            <p className="text-sm font-medium">
                                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                            </p>
                            <p className="text-xs mt-1">
                                {filter === "unread" ? "You're all caught up!" : "Notifications will appear here as activity happens."}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/30">
                            {filtered.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleClick(notif)}
                                    className={`flex items-start gap-3 px-4 sm:px-5 py-3.5 cursor-pointer transition-colors ${notif.isRead ? "opacity-60 hover:bg-muted/30" : "bg-primary/5 hover:bg-primary/10"}`}
                                >
                                    <div className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${notif.isRead ? "bg-transparent" : typeColor(notif.type)}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`text-sm font-medium ${notif.isRead ? "text-muted-foreground" : "text-foreground"}`}>
                                                        {notif.title}
                                                    </span>
                                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
                                                        {typeLabel(notif.type)}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
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
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
