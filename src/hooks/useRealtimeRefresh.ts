"use client"

import { useEffect, useRef, useCallback } from "react"

/**
 * Hook that calls `onRefresh` when:
 * 1. A push notification arrives (via "crm:data-update" custom event)
 * 2. The browser tab regains focus (after being hidden for > 30s)
 *
 * This gives a lightweight "real-time" feel without WebSockets.
 */
export function useRealtimeRefresh(onRefresh: () => void) {
    const lastRefresh = useRef(Date.now())
    const MIN_INTERVAL = 10_000 // Don't refresh more than once per 10s

    const throttledRefresh = useCallback(() => {
        const now = Date.now()
        if (now - lastRefresh.current < MIN_INTERVAL) return
        lastRefresh.current = now
        onRefresh()
    }, [onRefresh])

    useEffect(() => {
        // Refresh when push notification arrives
        const handleDataUpdate = () => throttledRefresh()
        window.addEventListener("crm:data-update", handleDataUpdate)

        // Refresh when tab regains focus (if it was hidden > 30s)
        let hiddenAt = 0
        const handleVisibility = () => {
            if (document.hidden) {
                hiddenAt = Date.now()
            } else if (hiddenAt && Date.now() - hiddenAt > 30_000) {
                throttledRefresh()
            }
        }
        document.addEventListener("visibilitychange", handleVisibility)

        return () => {
            window.removeEventListener("crm:data-update", handleDataUpdate)
            document.removeEventListener("visibilitychange", handleVisibility)
        }
    }, [throttledRefresh])
}
