"use client"

import { useState, useEffect } from "react"
import { getBrandingSettings } from "@/app/settings/branding/actions"
import type { BrandingSettings } from "@/app/settings/branding/types"

/**
 * Hook that fetches and caches branding settings.
 */
export function useBranding() {
    const [branding, setBranding] = useState<BrandingSettings | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                const data = await getBrandingSettings()
                if (!cancelled) setBranding(data)
            } catch {
                // use defaults
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
    }, [])

    return {
        branding,
        loading,
        companyName: branding?.companyName || "AFCrashpad",
        primaryColor: branding?.primaryColor,
        logoUrl: branding?.logoUrl,
    }
}
