"use client"

import { useState } from "react"
import { Sidebar } from "./Sidebar"
import { TopNav } from "./TopNav"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: React.ReactNode }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <>
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
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col border-r bg-background transition-transform duration-300 ease-out md:relative md:translate-x-0 md:w-auto",
                    mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}
            >
                <Sidebar
                    onNavigate={() => setMobileMenuOpen(false)}
                    className="h-full w-full"
                />
            </aside>
            <div className="flex flex-1 flex-col h-full min-h-0 overflow-hidden w-full min-w-0">
                <TopNav onMenuClick={() => setMobileMenuOpen(true)} />
                <main className="flex-1 min-h-0 overflow-y-auto bg-muted/20">
                    {children}
                </main>
            </div>
        </>
    )
}
