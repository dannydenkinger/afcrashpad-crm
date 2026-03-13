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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"

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
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                    onClick={() => { setShowMore(false); setShowAdd(false) }}
                />
            )}

            {/* More sheet */}
            {showMore && (
                <div className="fixed bottom-16 left-0 right-0 z-50 bg-zinc-900 border-t border-white/10 rounded-t-2xl animate-slide-up" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    <div className="flex items-center justify-between p-4 pb-2">
                        <span className="text-sm font-semibold text-white">More</span>
                        <button onClick={() => setShowMore(false)} className="p-1 rounded-full hover:bg-white/10">
                            <X className="h-4 w-4 text-zinc-400" />
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-3 pb-4">
                        {MORE_ITEMS.map(item => {
                            const Icon = item.icon
                            const active = isActive(item.href)
                            return (
                                <button
                                    key={item.href}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-colors touch-manipulation",
                                        active ? "bg-primary/10 text-primary" : "text-zinc-400 hover:bg-white/5"
                                    )}
                                    onClick={() => handleNav(item.href)}
                                >
                                    <Icon className="h-5 w-5" />
                                    <span className="text-[10px] font-medium">{item.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Add sheet */}
            {showAdd && (
                <div className="fixed bottom-16 left-0 right-0 z-50 bg-zinc-900 border-t border-white/10 rounded-t-2xl animate-slide-up" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    <div className="flex items-center justify-between p-4 pb-2">
                        <span className="text-sm font-semibold text-white">Quick Add</span>
                        <button onClick={() => setShowAdd(false)} className="p-1 rounded-full hover:bg-white/10">
                            <X className="h-4 w-4 text-zinc-400" />
                        </button>
                    </div>
                    <div className="flex flex-col gap-1 p-3 pb-4">
                        {ADD_ITEMS.map(item => (
                            <button
                                key={item.href}
                                className="flex items-center gap-3 py-3 px-4 rounded-xl text-sm font-medium text-white hover:bg-white/5 transition-colors touch-manipulation"
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
            <nav className="mobile-tab-bar bg-zinc-950/95 backdrop-blur-md border-t border-white/5">
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
                                    active ? "text-primary" : "text-zinc-500"
                                )}
                                onClick={() => handleNav(tab.href)}
                            >
                                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
                                <span className="text-[10px] font-medium">{tab.label}</span>
                            </button>
                        )
                    })}

                    {/* Center add button */}
                    <button
                        className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 -mt-4 touch-manipulation transition-transform active:scale-95"
                        onClick={() => { setShowAdd(!showAdd); setShowMore(false) }}
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
                                    active ? "text-primary" : "text-zinc-500"
                                )}
                                onClick={() => handleNav(tab.href)}
                            >
                                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
                                <span className="text-[10px] font-medium">{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
            </nav>
        </>
    )
}
