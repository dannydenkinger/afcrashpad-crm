"use client"

import { useState, useEffect } from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Returns whether the viewport is mobile-sized.
 * Defaults to `false` during SSR and first client render to avoid hydration mismatches.
 * The value updates after mount via useEffect, so the first paint always matches the server.
 */
export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
        const handler = () => setIsMobile(mql.matches)
        // Set correct value after hydration
        handler()
        mql.addEventListener("change", handler)
        return () => mql.removeEventListener("change", handler)
    }, [])

    return isMobile
}
