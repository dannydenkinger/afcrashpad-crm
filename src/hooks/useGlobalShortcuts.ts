"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

/**
 * Global Cmd+N shortcut that navigates to create a new item
 * based on the current page context:
 * - /pipeline → /pipeline?action=new-deal
 * - /contacts → /contacts?action=new-contact
 * - /tasks → /tasks?action=new-task
 * - /communications → /communications?action=new
 * - Otherwise → /pipeline?action=new-deal (default: new deal)
 */
export function useGlobalShortcuts() {
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Only handle Cmd+N / Ctrl+N
            if (!(e.metaKey || e.ctrlKey) || e.key !== "n") return

            // Don't intercept when typing in inputs
            const target = e.target as HTMLElement
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT" ||
                target.isContentEditable
            ) {
                return
            }

            e.preventDefault()

            // Route based on current page context
            if (pathname.startsWith("/pipeline")) {
                router.push("/pipeline?action=new-deal")
            } else if (pathname.startsWith("/contacts")) {
                router.push("/contacts?action=new-contact")
            } else if (pathname.startsWith("/tasks")) {
                router.push("/tasks?action=new-task")
            } else if (pathname.startsWith("/communications")) {
                router.push("/communications?action=new")
            } else {
                // Default: create a new deal
                router.push("/pipeline?action=new-deal")
            }
        }

        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [router, pathname])
}
