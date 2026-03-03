"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bell, Check, Menu } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ModeToggle } from "@/components/theme-toggle"
import { getNotifications, markAsRead, markAllAsRead } from "@/app/notifications/actions"
import { CommandPalette } from "@/components/CommandPalette"

export function TopNav({ onMenuClick }: { onMenuClick?: () => void }) {
    const router = useRouter()
    const [notifications, setNotifications] = useState<any[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    const fetchNotifications = async () => {
        const res = await getNotifications()
        if (res.success) {
            setNotifications(res.notifications || [])
            setUnreadCount(res.unreadCount || 0)
        }
    }

    useEffect(() => {
        fetchNotifications()
        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
    }, [])

    // Refresh on dropdown open
    useEffect(() => {
        if (isOpen) fetchNotifications()
    }, [isOpen])

    const handleClickNotification = async (notif: any) => {
        if (!notif.isRead) {
            await markAsRead(notif.id)
            fetchNotifications()
        }
        if (notif.linkUrl) {
            router.push(notif.linkUrl)
            setIsOpen(false)
        }
    }

    const handleMarkAllRead = async () => {
        await markAllAsRead()
        fetchNotifications()
    }

    const formatTime = (dateStr: string) => {
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
            default: return "bg-slate-500"
        }
    }

    return (
        <header className="flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b bg-background px-3 sm:px-6">
            <div className="flex flex-1 items-center gap-2 sm:gap-4 min-w-0">
                {onMenuClick && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 md:hidden touch-manipulation" onClick={onMenuClick} aria-label="Open menu">
                        <Menu className="h-5 w-5" />
                    </Button>
                )}
                <div className="flex-1 min-w-0 sm:flex-initial sm:min-w-0">
                    <CommandPalette />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <ModeToggle />

                <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative">
                            <Bell className="h-5 w-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 items-center justify-center text-[9px] text-white font-bold">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                </span>
                            )}
                            <span className="sr-only">Toggle notifications</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-96">
                        <div className="flex items-center justify-between px-3 py-2">
                            <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] text-muted-foreground gap-1"
                                    onClick={handleMarkAllRead}
                                >
                                    <Check className="h-3 w-3" /> Mark all read
                                </Button>
                            )}
                        </div>
                        <DropdownMenuSeparator />
                        <div className="max-h-[400px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-6 text-center text-sm text-muted-foreground">
                                    No notifications yet
                                </div>
                            ) : notifications.map((notif: any) => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleClickNotification(notif)}
                                    className={`px-3 py-2.5 cursor-pointer transition-colors border-b border-border/30 last:border-0 ${notif.isRead ? "opacity-60 hover:bg-muted/30" : "bg-primary/5 hover:bg-primary/10"
                                        }`}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${notif.isRead ? "bg-transparent" : typeColor(notif.type)
                                            }`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium truncate">{notif.title}</span>
                                                <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(notif.createdAt)}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">{notif.message}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
