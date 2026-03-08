"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface ShortcutConfig {
    onNewDeal?: () => void
    onNewContact?: () => void
    onNewTask?: () => void
    onCloseSheet?: () => void
}

/**
 * Global keyboard shortcuts:
 * - Escape: Close any open sheet/dialog (calls onCloseSheet if provided)
 * - N then D: New deal (if onNewDeal provided)
 * - N then C: New contact (if onNewContact provided)
 * - N then T: New task (if onNewTask provided)
 * - G then D: Go to dashboard
 * - G then P: Go to pipeline
 * - G then C: Go to contacts
 * - G then K: Go to calendar
 * - G then S: Go to settings
 * - ?: Show shortcuts help (dispatches custom event)
 */
export function useKeyboardShortcuts(config: ShortcutConfig = {}) {
    const router = useRouter()

    useEffect(() => {
        let pendingPrefix: string | null = null
        let prefixTimeout: ReturnType<typeof setTimeout> | null = null

        const clearPrefix = () => {
            pendingPrefix = null
            if (prefixTimeout) clearTimeout(prefixTimeout)
        }

        const handler = (e: KeyboardEvent) => {
            // Don't fire when typing in inputs, textareas, or contenteditable
            const target = e.target as HTMLElement
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT" ||
                target.isContentEditable
            ) {
                // Still allow Escape in inputs
                if (e.key === "Escape" && config.onCloseSheet) {
                    config.onCloseSheet()
                }
                return
            }

            // Don't fire with modifier keys (except for Cmd+K which is handled by CommandPalette)
            if (e.metaKey || e.ctrlKey || e.altKey) return

            // Escape: close sheet
            if (e.key === "Escape") {
                config.onCloseSheet?.()
                clearPrefix()
                return
            }

            // ? key: show shortcuts help
            if (e.key === "?") {
                window.dispatchEvent(new CustomEvent("crm:show-shortcuts"))
                clearPrefix()
                return
            }

            const key = e.key.toLowerCase()

            // Handle second key of a two-key combo
            if (pendingPrefix) {
                const prefix = pendingPrefix
                clearPrefix()

                if (prefix === "g") {
                    e.preventDefault()
                    switch (key) {
                        case "d": router.push("/dashboard"); return
                        case "p": router.push("/pipeline"); return
                        case "c": router.push("/contacts"); return
                        case "k": router.push("/calendar"); return
                        case "s": router.push("/settings"); return
                        case "n": router.push("/notifications"); return
                        case "t": router.push("/tasks"); return
                        case "f": router.push("/finance"); return
                        case "m": router.push("/marketing"); return
                    }
                }

                if (prefix === "n") {
                    e.preventDefault()
                    switch (key) {
                        case "d": config.onNewDeal?.(); return
                        case "c": config.onNewContact?.(); return
                        case "t": config.onNewTask?.(); return
                    }
                }
                return
            }

            // Handle first key of a two-key combo
            if (key === "g" || key === "n") {
                pendingPrefix = key
                prefixTimeout = setTimeout(clearPrefix, 800)
                return
            }
        }

        window.addEventListener("keydown", handler)
        return () => {
            window.removeEventListener("keydown", handler)
            clearPrefix()
        }
    }, [router, config])
}
