"use client"

import { usePathname, useRouter } from "next/navigation"
import { Bell, Search } from "lucide-react"
import { useBranding } from "@/hooks/useBranding"
import { Plane } from "lucide-react"

const PAGE_TITLES: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/pipeline": "Pipeline",
    "/contacts": "Contacts",
    "/calendar": "Calendar",
    "/communications": "Messages",
    "/tasks": "Tasks",
    "/finance": "Finance",
    "/marketing": "Marketing",
    "/tools": "Tools",
    "/settings": "Settings",
    "/notifications": "Notifications",
    "/search": "Search",
}

interface MobileTopNavProps {
    onNotificationsClick: () => void
    unreadCount?: number
}

export function MobileTopNav({ onNotificationsClick, unreadCount = 0 }: MobileTopNavProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { companyName } = useBranding()

    // Get page title from pathname
    const pageTitle = PAGE_TITLES[pathname] ||
        Object.entries(PAGE_TITLES).find(([prefix]) => pathname.startsWith(prefix))?.[1] ||
        companyName || "AFCrashpad"

    return (
        <header className="shrink-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/30 flex items-center justify-between px-4 safe-top" style={{ minHeight: 'calc(3rem + env(safe-area-inset-top, 0px))' }}>
            <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <Plane className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground">{pageTitle}</span>
            </div>

            <div className="flex items-center gap-1">
                <button
                    className="p-2 rounded-full hover:bg-muted transition-colors touch-manipulation"
                    onClick={() => router.push("/search")}
                >
                    <Search className="h-4.5 w-4.5 text-muted-foreground" />
                </button>
                <button
                    className="relative p-2 rounded-full hover:bg-muted transition-colors touch-manipulation"
                    onClick={onNotificationsClick}
                >
                    <Bell className="h-4.5 w-4.5 text-muted-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>
            </div>
        </header>
    )
}
