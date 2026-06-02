"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TopNav } from "./TopNav"
import { MobileTopNav } from "./MobileTopNav"
import { MobileBottomNav } from "./MobileBottomNav"
import { cn } from "@/lib/utils"
import { NotificationPanel } from "@/components/NotificationPanel"
import { Toaster } from "@/components/ui/sonner"
import { PushNotificationListener } from "@/components/PushNotificationListener"
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { OfflineIndicator } from "@/components/OfflineIndicator"
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts"
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning"
import { QuickAddFAB } from "@/components/QuickAddFAB"
import { AssistantWidget } from "@/components/assistant/AssistantWidget"
import { FeedbackWelcomeModal } from "@/components/FeedbackWelcomeModal"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { WorkspaceDeletionBanner } from "./WorkspaceDeletionBanner"
import { PaymentStatusBanner } from "./PaymentStatusBanner"
import { SupportSessionBanner } from "./SupportSessionBanner"
import { useIsMobile } from "@/hooks/useIsMobile"
import { getNotifications } from "@/app/notifications/actions"

// Routes that render without the app shell (sidebar, topnav, etc.)
// Anything customer-facing (token-gated forms, signature pages, public
// booking, unsubscribe, payout claim, contact form embeds) lives outside
// the chrome — these are typically opened by leads/contacts, not by
// authenticated CRM users.
const STANDALONE_ROUTES = ["/", "/login", "/register", "/setup", "/privacy", "/terms", "/pricing", "/changelog", "/verify-email", "/suspended"]
const STANDALONE_ROUTE_PREFIXES = [
    "/sign/",
    "/invite/",
    "/form/",     // legacy redirect
    "/forms/",
    "/book/",     // legacy redirect
    "/booking/",
    "/payout/",
    "/unsub/",
    "/admin/",    // operator dashboard renders its own chrome
    "/playground/", // component-demo pages render standalone
]

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isMobile = useIsMobile()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
    const [mobileUnreadCount, setMobileUnreadCount] = useState(0)

    useKeyboardShortcuts()
    useGlobalShortcuts()

    // Fetch unread notification count for mobile (only when tab is visible)
    const fetchMobileNotifications = useCallback(async () => {
        if (!isMobile || document.hidden) return
        const res = await getNotifications()
        if (res.success) setMobileUnreadCount(res.unreadCount || 0)
    }, [isMobile])

    useEffect(() => {
        fetchMobileNotifications()
        if (!isMobile) return
        // Poll every 60s instead of 30s, and pause when tab is hidden
        const interval = setInterval(fetchMobileNotifications, 60000)
        const onVisibilityChange = () => { if (!document.hidden) fetchMobileNotifications() }
        document.addEventListener("visibilitychange", onVisibilityChange)
        return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisibilityChange) }
    }, [fetchMobileNotifications, isMobile])

    // Standalone pages render without the shell
    const isStandalone = STANDALONE_ROUTES.includes(pathname) || STANDALONE_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix))
    if (isStandalone) {
        return <div className="w-full min-h-screen">{children}</div>
    }

    // ─── Mobile Layout ──────────────────────────────────────────────
    if (isMobile) {
        return (
            <div className="flex flex-col h-dvh w-full bg-background text-foreground">
                <MobileTopNav onNotificationsClick={() => setNotificationPanelOpen(true)} unreadCount={mobileUnreadCount} />
                <SupportSessionBanner />
                <PaymentStatusBanner />
                <WorkspaceDeletionBanner />
                <main id="main-content" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-28" role="main">
                    <ErrorBoundary section="Page content">
                        {children}
                    </ErrorBoundary>
                </main>
                <MobileBottomNav />
                <NotificationPanel open={notificationPanelOpen} onClose={() => setNotificationPanelOpen(false)} />
                <Toaster />
                <PushNotificationListener />
                <PushNotificationPrompt />
                <OfflineIndicator />
                <SessionTimeoutWarning />
                <FeedbackWelcomeModal />
            </div>
        )
    }

    // ─── Desktop Layout ─────────────────────────────────────────────
    return (
        <div className="flex h-screen overflow-hidden">
            {/* Mobile sidebar backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
                    mobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
                )}
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden="true"
            />
            {/* Sidebar: drawer on mobile, normal on desktop */}
            <aside
                aria-label="Main navigation"
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col border-r bg-background transition-transform duration-300 ease-out md:relative md:translate-x-0 md:w-auto",
                    mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}
            >
                <ErrorBoundary section="Navigation">
                    <Sidebar
                        onNavigate={() => setMobileMenuOpen(false)}
                        className="h-full w-full"
                    />
                </ErrorBoundary>
            </aside>
            <div className="flex flex-1 flex-col h-full min-h-0 overflow-hidden w-full min-w-0">
                <TopNav onMenuClick={() => setMobileMenuOpen(true)} onNotificationsClick={() => setNotificationPanelOpen(true)} />
                <SupportSessionBanner />
                <PaymentStatusBanner />
                <WorkspaceDeletionBanner />
                <main id="main-content" className="flex-1 min-h-0 overflow-y-auto bg-muted/20 safe-bottom" role="main">
                    <ErrorBoundary section="Page content">
                        <div className="px-4 sm:px-6 lg:px-8 pt-2">
                            <Breadcrumbs />
                        </div>
                        {children}
                    </ErrorBoundary>
                </main>
            </div>
            <NotificationPanel open={notificationPanelOpen} onClose={() => setNotificationPanelOpen(false)} />
            <Toaster />
            <PushNotificationListener />
            <PushNotificationPrompt />
            <OfflineIndicator />
            <KeyboardShortcutsDialog />
            <SessionTimeoutWarning />
            <QuickAddFAB />
            <AssistantWidget />
            <FeedbackWelcomeModal />
        </div>
    )
}
