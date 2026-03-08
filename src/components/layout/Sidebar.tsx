"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import NextImage from "next/image"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Calendar, Settings, Plane, ChevronLeft, ChevronRight, Megaphone, LayoutGrid, Wrench, MessageSquare, X, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSession } from "next-auth/react"
import { getCurrentUserRole, getSidebarProfile } from "@/app/settings/users/actions"
import { getVisibleNavItems, type UserRole } from "@/lib/role-permissions"
import { getBrandingSettings } from "@/app/settings/branding/actions"
import { Button } from "@/components/ui/button"

type NavItem = { name: string; href: string; icon: any } | { separator: string }

const navItems: NavItem[] = [
    // CRM
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Pipeline", href: "/pipeline", icon: LayoutGrid },
    { name: "Contacts", href: "/contacts", icon: Users },
    { separator: "Activity" },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Communications", href: "/communications", icon: MessageSquare },
    { separator: "Finance & Growth" },
    { name: "Finance", href: "/finance", icon: Wallet },
    { name: "Marketing", href: "/marketing", icon: Megaphone },
    { name: "Tools", href: "/tools", icon: Wrench },
    { separator: "Admin" },
    { name: "Settings", href: "/settings", icon: Settings },
]

interface SidebarProps {
    onNavigate?: () => void
    className?: string
    mobileCollapsed?: boolean
}

export function Sidebar({ onNavigate, className, mobileCollapsed }: SidebarProps) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [realRole, setRealRole] = useState<UserRole>("AGENT")
    const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
    const [displayName, setDisplayName] = useState<string | null>(null)
    const [branding, setBranding] = useState<{ logoUrl?: string; primaryColor?: string; companyName?: string } | null>(null)

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true)
            const saved = localStorage.getItem("sidebar-collapsed")
            if (saved) {
                setIsCollapsed(saved === "true")
            }
        }, 0)

        async function fetchRole() {
            if (session?.user?.id) {
                const role = await getCurrentUserRole()
                setRealRole(role as UserRole)
            }
        }
        fetchRole()

        async function fetchProfile() {
            const profile = await getSidebarProfile()
            if (profile.imageUrl) setProfileImageUrl(profile.imageUrl)
            if (profile.name) setDisplayName(profile.name)
        }
        fetchProfile()

        async function fetchBranding() {
            try {
                const b = await getBrandingSettings()
                if (b) setBranding(b)
            } catch { }
        }
        fetchBranding()

        return () => clearTimeout(timer)
    }, [session])

    useEffect(() => {
        if (mounted) {
            localStorage.setItem("sidebar-collapsed", String(isCollapsed))
        }
    }, [isCollapsed, mounted])

    const toggleCollapse = () => {
        const newValue = !isCollapsed
        setIsCollapsed(newValue)
        localStorage.setItem("sidebar-collapsed", String(newValue))
    }

    const showCollapsed = isCollapsed && !onNavigate
    const widthClass = showCollapsed ? "w-[72px] px-2 pt-10 pb-8" : "w-64 px-4 pt-4.5 pb-4.5"

    return (
        <div className={cn("relative flex flex-col h-full bg-background transition-all duration-300", widthClass, className)}>
            {/* Mobile: close button; Desktop: collapse toggle */}
            {onNavigate ? (
                <Button variant="ghost" size="icon" className="absolute right-2 top-6 h-10 w-10 md:hidden touch-manipulation" onClick={onNavigate} aria-label="Close menu">
                    <X className="h-5 w-5" />
                </Button>
            ) : (
                <button
                    onClick={toggleCollapse}
                    className="absolute -right-3 top-8 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground shadow-sm z-10 md:flex hidden"
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
            )}

            <div data-onboarding="welcome" className={cn("flex items-center mb-10 pr-12 md:pr-0", showCollapsed ? "justify-center" : "gap-3 px-2")}>
                {branding?.logoUrl ? (
                    <img src={branding.logoUrl} alt={branding.companyName || "Logo"} className="h-10 w-10 shrink-0 rounded-lg object-cover shadow" />
                ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow" style={branding?.primaryColor ? { backgroundColor: branding.primaryColor } : undefined}>
                        <Plane className="h-6 w-6" />
                    </div>
                )}
                {!showCollapsed && (
                    <div className="overflow-hidden">
                        <h2 className="text-lg font-semibold tracking-tight whitespace-nowrap">{branding?.companyName || "AFCrashpad"}</h2>
                        <p className="text-xs text-muted-foreground font-medium whitespace-nowrap">CRM Portal</p>
                    </div>
                )}
            </div>

            <nav className="flex-1 space-y-1" aria-label="Primary navigation">
                {getVisibleNavItems(realRole, navItems).map((item, idx) => {
                    if ("separator" in item) {
                        if (showCollapsed) {
                            return <div key={`sep-${idx}`} className="h-px bg-border/50 my-2 mx-2" />
                        }
                        return (
                            <div key={`sep-${idx}`} className="pt-4 pb-1 px-3">
                                <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">{item.separator}</span>
                            </div>
                        )
                    }

                    const isActive = pathname.startsWith(item.href)
                    const Icon = item.icon

                    const onboardingMap: Record<string, string> = {
                        "/dashboard": "dashboard",
                        "/pipeline": "pipeline",
                        "/contacts": "contacts",
                        "/settings": "settings",
                    }
                    const onboardingAttr = onboardingMap[item.href]

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            title={showCollapsed ? item.name : undefined}
                            onClick={onNavigate}
                            {...(onboardingAttr ? { "data-onboarding": onboardingAttr } : {})}
                            className={cn(
                                "flex items-center rounded-md font-medium transition-colors min-h-[44px] touch-manipulation",
                                showCollapsed ? "justify-center h-11 w-11 mx-auto" : "gap-3 px-3 py-2.5 text-sm",
                                isActive
                                    ? "bg-secondary text-secondary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                            )}
                        >
                            <Icon className={cn("shrink-0", showCollapsed ? "h-5 w-5" : "h-4 w-4")} />
                            {!showCollapsed && <span>{item.name}</span>}
                        </Link>
                    )
                })}
            </nav>

            <div className={cn("mt-auto flex items-center border-t pt-4 pb-2 min-h-[52px]", showCollapsed ? "justify-center" : "gap-3 px-2")}>
                <Avatar className="h-9 w-9 border shrink-0">
                    {(profileImageUrl || session?.user?.image) ? (
                        <NextImage
                            src={profileImageUrl || session!.user!.image!}
                            alt={session?.user?.name || "User avatar"}
                            width={36}
                            height={36}
                            className="aspect-square size-full rounded-full object-cover"
                        />
                    ) : null}
                    <AvatarFallback>{(displayName || session?.user?.name)?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                {!showCollapsed && (
                    <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-medium">
                            {displayName || session?.user?.name || "Loading..."}
                        </span>
                        <span className="truncate text-xs text-muted-foreground capitalize">
                            {realRole.toLowerCase()}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}
