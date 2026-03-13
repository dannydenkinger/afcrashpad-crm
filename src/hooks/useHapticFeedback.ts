"use client"

import { useCallback } from "react"

type HapticStyle = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error"

const VIBRATION_PATTERNS: Record<HapticStyle, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    selection: 5,
    success: [10, 30, 10],
    warning: [15, 20, 15],
    error: [20, 10, 20, 10, 20],
}

export function useHapticFeedback() {
    const trigger = useCallback((style: HapticStyle = "light") => {
        if (typeof window === "undefined") return
        if (!("vibrate" in navigator)) return

        const pattern = VIBRATION_PATTERNS[style]
        try {
            navigator.vibrate(pattern)
        } catch {
            // Vibration API not supported or blocked
        }
    }, [])

    return { trigger }
}
