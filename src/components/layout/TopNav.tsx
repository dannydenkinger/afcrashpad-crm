"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Bell, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/theme-toggle"
import { getNotifications } from "@/app/notifications/actions"
import { CommandPalette } from "@/components/CommandPalette"
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh"

function TopNavInner({ onMenuClick, onNotificationsClick }: { onMenuClick?: () => void; onNotificationsClick?: () => void }) {
    const [unreadCount, setUnreadCount] = useState(0)

    const fetchNotifications = useCallback(async () => {
        const res = await getNotifications()
        if (res.success) {
            setUnreadCount(res.unreadCount || 0)
        }
    }, [])

    useEffect(() => {
        fetchNotifications()
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
    }, [fetchNotifications])

    useRealtimeRefresh(fetchNotifications)

    return (
        <header className="flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b bg-background px-3 sm:px-6 safe-top">
            <div className="flex flex-1 items-center gap-2 sm:gap-4 min-w-0">
                {onMenuClick && (
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 md:hidden touch-manipulation" onClick={onMenuClick} aria-label="Open menu">
                        <Menu className="h-5 w-5" />
                    </Button>
                )}
                <div className="flex-1 min-w-0 sm:flex-initial sm:min-w-0">
                    <CommandPalette />
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <ModeToggle />

                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-11 w-11"
                    onClick={onNotificationsClick}
                    aria-label="Open notifications"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 items-center justify-center text-[9px] text-white font-bold">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        </span>
                    )}
                </Button>
            </div>
        </header>
    )
}

export const TopNav = React.memo(TopNavInner)
