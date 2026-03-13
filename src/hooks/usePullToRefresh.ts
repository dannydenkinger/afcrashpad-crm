"use client"

import { useRef, useEffect, useCallback, useState } from "react"

const THRESHOLD = 60

export function usePullToRefresh(onRefresh: () => Promise<void>) {
    const [refreshing, setRefreshing] = useState(false)
    const [pullDistance, setPullDistance] = useState(0)
    const touchStartY = useRef(0)
    const pulling = useRef(false)

    const handleTouchStart = useCallback((e: TouchEvent) => {
        // Only start pull if scrolled to top
        if (window.scrollY <= 0) {
            touchStartY.current = e.touches[0].clientY
            pulling.current = true
        }
    }, [])

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!pulling.current) return
        const deltaY = e.touches[0].clientY - touchStartY.current
        if (deltaY > 0) {
            // Dampen the pull with diminishing returns
            const dampened = Math.min(deltaY * 0.4, 120)
            setPullDistance(dampened)
        }
    }, [])

    const handleTouchEnd = useCallback(async () => {
        if (!pulling.current) return
        pulling.current = false

        if (pullDistance >= THRESHOLD && !refreshing) {
            setRefreshing(true)
            setPullDistance(THRESHOLD)
            try {
                await onRefresh()
            } finally {
                setRefreshing(false)
                setPullDistance(0)
            }
        } else {
            setPullDistance(0)
        }
    }, [pullDistance, refreshing, onRefresh])

    useEffect(() => {
        document.addEventListener("touchstart", handleTouchStart, { passive: true })
        document.addEventListener("touchmove", handleTouchMove, { passive: true })
        document.addEventListener("touchend", handleTouchEnd)

        return () => {
            document.removeEventListener("touchstart", handleTouchStart)
            document.removeEventListener("touchmove", handleTouchMove)
            document.removeEventListener("touchend", handleTouchEnd)
        }
    }, [handleTouchStart, handleTouchMove, handleTouchEnd])

    return { refreshing, pullDistance }
}
