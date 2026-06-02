"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldCheck, BarChart3, Users, Coins, Activity, Filter, MessageCircle, UserCircle, Plug } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
    { href: "/admin/insights", label: "Insights", icon: BarChart3 },
    { href: "/admin/workspaces", label: "Workspaces", icon: Users },
    { href: "/admin/users", label: "Users", icon: UserCircle },
    { href: "/admin/feedback", label: "Feedback", icon: MessageCircle },
    { href: "/admin/revenue", label: "Revenue", icon: Coins },
    { href: "/admin/funnels", label: "Funnels", icon: Filter },
    { href: "/admin/support-sessions", label: "Support", icon: ShieldCheck },
    { href: "/admin/integrations", label: "Integrations", icon: Plug },
    { href: "/admin/activity", label: "Activity", icon: Activity },
]

export function AdminNav() {
    const pathname = usePathname() || ""
    return (
        <header className="border-b bg-background sticky top-0 z-30 backdrop-blur">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
                <Link href="/admin/insights" className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-5 w-5 text-violet-500" />
                    <span>Vesta Admin</span>
                </Link>
                <nav className="flex items-center gap-1 overflow-x-auto">
                    {items.map((item) => {
                        const active = pathname === item.href || pathname.startsWith(item.href + "/")
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                                    active
                                        ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                            >
                                <item.icon className="h-3.5 w-3.5" />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>
                <div className="ml-auto">
                    <Link
                        href="/dashboard"
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        ← back to app
                    </Link>
                </div>
            </div>
        </header>
    )
}
