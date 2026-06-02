"use server"

import { tenantDb } from "@/lib/tenant-db"
import { requireAuth } from "@/lib/auth-guard"

/**
 * Lightweight per-workspace check for whether a given integration is set up.
 * Used by dashboards to show "Connect X" prompts instead of empty charts when
 * the underlying integration hasn't been wired up yet.
 *
 * Mirrors the field shapes in /settings/integrations/page.tsx.
 */
export async function getIntegrationStatus() {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    const doc = await db.settingsDoc("integrations").get()
    const data = doc.exists ? (doc.data() as Record<string, any>) : null

    const ga4Configured =
        !!data?.google?.refreshToken &&
        (!!data?.google?.ga4PropertyId || !!process.env.GA4_PROPERTY_ID)
    const gscConfigured =
        !!data?.google?.refreshToken && !!data?.google?.gscSiteUrl
    const wordpressConfigured =
        !!data?.wordpress?.url && !!data?.wordpress?.appPassword

    return {
        ga4: ga4Configured,
        gsc: gscConfigured,
        wordpress: wordpressConfigured,
    }
}
