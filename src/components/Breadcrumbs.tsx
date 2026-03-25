"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

const labels: Record<string, string> = {
    dashboard: "Dashboard",
    pipeline: "Pipeline",
    contacts: "Contacts",
    calendar: "Calendar",
    documents: "Documents",
    communications: "Communications",
    notifications: "Notifications",
    finance: "Finance",
    marketing: "Marketing",
    tools: "Tools",
    settings: "Settings",
    tasks: "Tasks",
    search: "Search",
    reporting: "Reporting",
    users: "Users",
    automations: "Automations",
    bases: "Bases",
    tags: "Tags",
    blog: "Blog",
    seo: "SEO",
    analytics: "Analytics",
    prepare: "Prepare",
    sign: "Sign",
    haro: "HARO",
    bookings: "Bookings",
    commissions: "Commissions",
    referrals: "Referrals",
    forecasting: "Forecasting",
    "system-properties": "System Properties",
    branding: "Branding",
}

export function Breadcrumbs() {
    const pathname = usePathname()
    const segments = pathname.split("/").filter(Boolean)

    // Don't show breadcrumbs on top-level pages (only 1 segment)
    if (segments.length <= 1) return null

    const crumbs = segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/")
        const label = labels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
        const isLast = index === segments.length - 1

        return { href, label, isLast }
    })

    return (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
                <Home className="h-3.5 w-3.5" />
            </Link>
            {crumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    {crumb.isLast ? (
                        <span className="text-foreground font-medium">{crumb.label}</span>
                    ) : (
                        <Link href={crumb.href} className="hover:text-foreground transition-colors">
                            {crumb.label}
                        </Link>
                    )}
                </span>
            ))}
        </nav>
    )
}
