"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { getCurrentUserRole } from "./users/actions"
import {
    CreditCard,
    Database,
    GitBranch,
    Palette,
    Settings as SettingsIcon,
    Sparkles,
    Star,
    User,
    Users,
} from "lucide-react"

interface NavItem {
    href: string
    label: string
    Icon: React.ComponentType<{ className?: string }>
    /** When true, only OWNER/ADMIN see this item. */
    adminOnly?: boolean
}

/**
 * Top horizontal nav that's visible on every /settings/* page, mirroring
 * the tiles on the /settings hub page. Lets users jump between settings
 * areas without going back to the hub.
 *
 * AI providers + Webhooks aren't top-level — they live inside the
 * Integrations area's sub-nav.
 */
const ITEMS: NavItem[] = [
    { href: "/settings/profile", label: "Profile", Icon: User },
    { href: "/settings/workspace", label: "Workspace", Icon: SettingsIcon, adminOnly: true },
    { href: "/settings/branding", label: "Branding", Icon: Palette, adminOnly: true },
    { href: "/settings/team", label: "Team", Icon: Users, adminOnly: true },
    { href: "/settings/billing", label: "Billing", Icon: CreditCard, adminOnly: true },
    { href: "/settings/integrations", label: "Integrations", Icon: GitBranch, adminOnly: true },
    { href: "/settings/data", label: "Data", Icon: Database, adminOnly: true },
    { href: "/settings/reputation", label: "Reputation", Icon: Star, adminOnly: true },
]

export function SettingsSubNav() {
    const pathname = usePathname()
    const [isAdmin, setIsAdmin] = useState(true) // optimistic — hide later if not

    useEffect(() => {
        getCurrentUserRole()
            .then((role) => setIsAdmin(role === "OWNER" || role === "ADMIN"))
            .catch(() => setIsAdmin(false))
    }, [])

    return (
        <nav className="border-b bg-background sticky top-0 z-30 backdrop-blur-md bg-background/85">
            <div className="container mx-auto max-w-6xl px-4">
                <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar h-11">
                    <Link
                        href="/settings"
                        className="flex items-center gap-1.5 pr-3 mr-1 border-r text-[11px] font-semibold text-muted-foreground shrink-0 hover:text-foreground transition-colors"
                    >
                        <Sparkles className="w-3 h-3" />
                        Settings
                    </Link>
                    {ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
                        const active =
                            pathname === item.href || pathname.startsWith(item.href + "/")
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors shrink-0 ${
                                    active
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                }`}
                            >
                                <item.Icon className="w-3.5 h-3.5" />
                                {item.label}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </nav>
    )
}
