"use client"
import React, { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import NextImage from "next/image"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Calendar, Settings, Plane, ChevronLeft, ChevronRight, Megaphone, LayoutGrid, Wrench, MessageSquare, X, Wallet, LogOut, CheckSquare, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSession, signOut } from "next-auth/react"
import { getVisibleNavItems, type UserRole } from "@/lib/role-permissions"
import { getSidebarData } from "@/app/sidebar/actions"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type NavItem = { name: string; href: string; icon: any } | { separator: string }

const navItems: NavItem[] = [
    // CRM
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Pipeline", href: "/pipeline", icon: LayoutGrid },
    { name: "Contacts", href: "/contacts", icon: Users },
    { separator: "Activity" },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Documents", href: "/documents", icon: FileText },
    { name: "Communications", href: "/communications", icon: MessageSquare },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
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

function SidebarInner({ onNavigate, className, mobileCollapsed }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { data: session } = useSession()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [realRole, setRealRole] = useState<UserRole>("AGENT")
    const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
    const [displayName, setDisplayName] = useState<string | null>(null)
    const [branding, setBranding] = useState<{ logoUrl?: string; primaryColor?: string; companyName?: string } | null>(null)
    const [overdueCount, setOverdueCount] = useState(0)
    const gPressedRef = useRef(false)

    // G-key navigation shortcuts
    useEffect(() => {
        const navMap: Record<string, string> = {
            d: "/dashboard", p: "/pipeline", c: "/contacts",
            a: "/calendar", t: "/tasks", f: "/finance", s: "/settings",
        }
        let gTimeout: ReturnType<typeof setTimeout>

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't intercept when typing in inputs
            const tag = (e.target as HTMLElement).tagName
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable) return

            if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
                gPressedRef.current = true
                clearTimeout(gTimeout)
                gTimeout = setTimeout(() => { gPressedRef.current = false }, 1000)
                return
            }

            if (gPressedRef.current && navMap[e.key]) {
                e.preventDefault()
                gPressedRef.current = false
                router.push(navMap[e.key])
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => { window.removeEventListener("keydown", handleKeyDown); clearTimeout(gTimeout) }
    }, [router])

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true)
            const saved = localStorage.getItem("sidebar-collapsed")
            if (saved) {
                setIsCollapsed(saved === "true")
            }
        }, 0)

        // Single consolidated fetch for all sidebar data (1 round trip instead of 4)
        getSidebarData().then(data => {
            setRealRole(data.role as UserRole)
            if (data.name) setDisplayName(data.name)
            if (data.imageUrl) setProfileImageUrl(data.imageUrl)
            if (data.branding) setBranding(data.branding)
            setOverdueCount(data.overdueTaskCount)
        }).catch(() => {})

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
                                <span className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider">{item.separator}</span>
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

                    const shortcutMap: Record<string, string> = {
                        "/dashboard": "G then D",
                        "/pipeline": "G then P",
                        "/contacts": "G then C",
                        "/calendar": "G then A",
                        "/tasks": "G then T",
                        "/finance": "G then F",
                        "/settings": "G then S",
                    }
                    const shortcutHint = shortcutMap[item.href]

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            title={showCollapsed ? item.name : (shortcutHint ? `${item.name} (${shortcutHint})` : undefined)}
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
                            {!showCollapsed && item.name === "Tasks" && overdueCount > 0 && (
                                <span className="ml-auto text-xs font-bold bg-rose-500 text-white rounded-full h-5 min-w-[20px] flex items-center justify-center px-1.5">
                                    {overdueCount}
                                </span>
                            )}
                        </Link>
                    )
                })}
            </nav>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className={cn("mt-auto flex items-center border-t pt-4 pb-2 min-h-[52px] w-full cursor-pointer rounded-md hover:bg-secondary/50 transition-colors", showCollapsed ? "justify-center" : "gap-3 px-2")}>
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
                            <div className="flex flex-col overflow-hidden text-left">
                                <span className="truncate text-sm font-medium">
                                    {displayName || session?.user?.name || "Loading..."}
                                </span>
                                <span className="truncate text-xs text-muted-foreground capitalize">
                                    {realRole.toLowerCase()}
                                </span>
                            </div>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-48">
                    <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="text-destructive focus:text-destructive">
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

export const Sidebar = React.memo(SidebarInner)
