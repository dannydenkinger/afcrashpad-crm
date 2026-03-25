"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
    LayoutDashboard,
    Kanban,
    Users,
    Plus,
    MoreHorizontal,
    Calendar,
    MessageSquare,
    CheckSquare,
    Wallet,
    Megaphone,
    Wrench,
    Settings,
    Bell,
    X,
    Sun,
    Moon,
    FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useTheme } from "next-themes"

interface TabItem {
    label: string
    icon: typeof LayoutDashboard
    href: string
}

const MAIN_TABS: TabItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { label: "Pipeline", icon: Kanban, href: "/pipeline" },
    // Center "+" button is rendered separately
    { label: "Contacts", icon: Users, href: "/contacts" },
    { label: "More", icon: MoreHorizontal, href: "__more__" },
]

const MORE_ITEMS: TabItem[] = [
    { label: "Calendar", icon: Calendar, href: "/calendar" },
    { label: "Documents", icon: FileText, href: "/documents" },
    { label: "Messages", icon: MessageSquare, href: "/communications" },
    { label: "Tasks", icon: CheckSquare, href: "/tasks" },
    { label: "Finance", icon: Wallet, href: "/finance" },
    { label: "Marketing", icon: Megaphone, href: "/marketing" },
    { label: "Tools", icon: Wrench, href: "/tools" },
    { label: "Settings", icon: Settings, href: "/settings" },
    { label: "Notifications", icon: Bell, href: "/notifications" },
]

const ADD_ITEMS = [
    { label: "New Deal", href: "/pipeline?action=new-deal" },
    { label: "New Contact", href: "/contacts?action=new-contact" },
    { label: "New Task", href: "/tasks?action=new-task" },
]

export function MobileBottomNav() {
    const pathname = usePathname()
    const router = useRouter()
    const { trigger: haptic } = useHapticFeedback()
    const { theme, setTheme } = useTheme()
    const [showMore, setShowMore] = useState(false)
    const [showAdd, setShowAdd] = useState(false)

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard"
        return pathname.startsWith(href)
    }

    const handleNav = (href: string) => {
        haptic("light")
        if (href === "__more__") {
            setShowMore(true)
            setShowAdd(false)
            return
        }
        setShowMore(false)
        setShowAdd(false)
        router.push(href)
    }

    return (
        <>
            {/* Backdrop for sheets */}
            {(showMore || showAdd) && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                    onClick={() => { setShowMore(false); setShowAdd(false) }}
                />
            )}

            {/* More sheet */}
            {showMore && (
                <div className="fixed bottom-16 left-0 right-0 z-50 bg-card border-t border-border/30 rounded-t-2xl animate-slide-up shadow-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    <div className="flex items-center justify-between p-4 pb-2">
                        <span className="text-sm font-semibold text-foreground">More</span>
                        <button onClick={() => setShowMore(false)} className="p-1 rounded-full hover:bg-muted">
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-3 pb-2">
                        {MORE_ITEMS.map(item => {
                            const Icon = item.icon
                            const active = isActive(item.href)
                            return (
                                <button
                                    key={item.href}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-colors touch-manipulation",
                                        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                                    )}
                                    onClick={() => handleNav(item.href)}
                                >
                                    <Icon className="h-5 w-5" />
                                    <span className="text-xs font-medium">{item.label}</span>
                                </button>
                            )
                        })}
                    </div>
                    {/* Theme toggle */}
                    <div className="px-3 pb-4">
                        <button
                            className="flex items-center justify-between w-full py-3 px-4 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors touch-manipulation"
                            onClick={() => { haptic("light"); setTheme(theme === "dark" ? "light" : "dark") }}
                        >
                            <span className="flex items-center gap-3">
                                {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-400" />}
                                {theme === "dark" ? "Light Mode" : "Dark Mode"}
                            </span>
                            <span className="text-xs text-muted-foreground">Switch</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Add sheet */}
            {showAdd && (
                <div className="fixed bottom-16 left-0 right-0 z-50 bg-card border-t border-border/30 rounded-t-2xl animate-slide-up shadow-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    <div className="flex items-center justify-between p-4 pb-2">
                        <span className="text-sm font-semibold text-foreground">Quick Add</span>
                        <button onClick={() => setShowAdd(false)} className="p-1 rounded-full hover:bg-muted">
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </div>
                    <div className="flex flex-col gap-1 p-3 pb-4">
                        {ADD_ITEMS.map(item => (
                            <button
                                key={item.href}
                                className="flex items-center gap-3 py-3 px-4 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors touch-manipulation"
                                onClick={() => handleNav(item.href)}
                            >
                                <Plus className="h-4 w-4 text-primary" />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab bar */}
            <nav className="mobile-tab-bar bg-background/95 backdrop-blur-md border-t border-border/30" aria-label="Main navigation">
                <div className="flex items-center justify-around h-16 px-2">
                    {/* First two tabs */}
                    {MAIN_TABS.slice(0, 2).map(tab => {
                        const Icon = tab.icon
                        const active = isActive(tab.href)
                        return (
                            <button
                                key={tab.href}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-0.5 flex-1 h-full touch-manipulation transition-colors",
                                    active ? "text-primary" : "text-muted-foreground"
                                )}
                                onClick={() => handleNav(tab.href)}
                            >
                                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
                                <span className="text-xs font-medium">{tab.label}</span>
                            </button>
                        )
                    })}

                    {/* Center add button */}
                    <button
                        className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 -mt-4 touch-manipulation transition-transform active:scale-95"
                        onClick={() => { setShowAdd(!showAdd); setShowMore(false) }}
                        aria-label="Quick add"
                    >
                        <Plus className={cn("h-6 w-6 transition-transform", showAdd && "rotate-45")} />
                    </button>

                    {/* Last two tabs */}
                    {MAIN_TABS.slice(2).map(tab => {
                        const Icon = tab.icon
                        const active = tab.href === "__more__" ? showMore : isActive(tab.href)
                        return (
                            <button
                                key={tab.href}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-0.5 flex-1 h-full touch-manipulation transition-colors",
                                    active ? "text-primary" : "text-muted-foreground"
                                )}
                                onClick={() => handleNav(tab.href)}
                            >
                                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
                                <span className="text-xs font-medium">{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
            </nav>
        </>
    )
}
