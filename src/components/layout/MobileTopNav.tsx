"use client"

import { usePathname, useRouter } from "next/navigation"
import { Bell, Search, Hexagon } from "lucide-react"
import { useBranding } from "@/hooks/useBranding"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { FeedbackHeaderButton } from "@/components/FeedbackHeaderButton"

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
    "/automations": "Automations",
    "/documents": "Documents",
}

interface MobileTopNavProps {
    onNotificationsClick: () => void
    unreadCount?: number
}

export function MobileTopNav({ onNotificationsClick, unreadCount = 0 }: MobileTopNavProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { companyName } = useBranding()
    const { trigger: haptic } = useHapticFeedback()

    const pageTitle = PAGE_TITLES[pathname] ||
        Object.entries(PAGE_TITLES).find(([prefix]) => pathname.startsWith(prefix))?.[1] ||
        companyName || "Vesta CRM"

    return (
        <header
            className="shrink-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/30 flex items-center justify-between px-4 safe-top"
            style={{ minHeight: 'calc(3rem + env(safe-area-inset-top, 0px))' }}
        >
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Hexagon className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground truncate">{pageTitle}</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                <FeedbackHeaderButton iconOnly />
                <button
                    className="p-2 rounded-full hover:bg-muted active:bg-muted/70 transition-colors touch-manipulation"
                    onClick={() => { haptic("light"); router.push("/search") }}
                    aria-label="Search"
                >
                    <Search className="h-4.5 w-4.5 text-muted-foreground" />
                </button>
                <button
                    className="relative p-2 rounded-full hover:bg-muted active:bg-muted/70 transition-colors touch-manipulation"
                    onClick={() => { haptic("light"); onNotificationsClick() }}
                    aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                >
                    <Bell className="h-4.5 w-4.5 text-muted-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground tabular-nums shadow-sm">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>
            </div>
        </header>
    )
}
