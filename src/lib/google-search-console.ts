import { google } from "googleapis"
import { tenantDb } from "@/lib/tenant-db"

// ── Per-workspace lazy cache ──
const _authCache = new Map<string, { auth: InstanceType<typeof google.auth.OAuth2>; siteUrl: string | null }>()

/**
 * Resolve a Search Console auth client + site URL from per-workspace
 * OAuth settings.
 *
 * Multi-tenant safety: there's deliberately NO env-var fallback for
 * `siteUrl` or service-account credentials. A fallback would silently
 * route workspaces without OAuth to whatever site URL the operator put
 * in env — a cross-tenant data leak. Workspaces without OAuth get
 * nulls; the dashboard renders the "Connect Google" empty state.
 */
async function getAuth(workspaceId: string) {
    // Check cache
    const cached = _authCache.get(workspaceId)
    if (cached) {
        return { auth: cached.auth, siteUrl: cached.siteUrl || undefined }
    }

    let auth: InstanceType<typeof google.auth.OAuth2> | null = null
    let oauthSiteUrl: string | null = null

    try {
        const db = tenantDb(workspaceId)
        const doc = await db.settingsDoc("integrations").get()
        const data = doc.data()
        if (data?.google?.refreshToken) {
            const oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
            )
            oauth2Client.setCredentials({
                refresh_token: data.google.refreshToken,
                access_token: data.google.accessToken,
                expiry_date: data.google.expiresAt ? data.google.expiresAt * 1000 : undefined,
            })
            auth = oauth2Client
            oauthSiteUrl = data.google.gscSiteUrl || null
        }
    } catch (err) {
        console.error("Failed to init GSC client for workspace:", err)
    }

    if (auth) {
        _authCache.set(workspaceId, { auth, siteUrl: oauthSiteUrl })
    }

    return { auth, siteUrl: oauthSiteUrl || undefined }
}

export async function getSearchAnalytics(workspaceId: string, days: number = 28) {
    const { auth, siteUrl } = await getAuth(workspaceId)
    if (!auth || !siteUrl) return null

    try {
        const searchconsole = google.searchconsole({ version: "v1", auth: auth as any })

        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        const formatDate = (d: Date) => d.toISOString().split("T")[0]

        const [dailyResponse, queryResponse] = await Promise.all([
            searchconsole.searchanalytics.query({
                siteUrl,
                requestBody: {
                    startDate: formatDate(startDate),
                    endDate: formatDate(endDate),
                    dimensions: ["date"],
                    rowLimit: 500,
                },
            }),
            searchconsole.searchanalytics.query({
                siteUrl,
                requestBody: {
                    startDate: formatDate(startDate),
                    endDate: formatDate(endDate),
                    dimensions: ["query"],
                    rowLimit: 50,
                    type: "web",
                },
            }),
        ])

        const dailyData = (dailyResponse.data.rows || []).map((row) => ({
            date: row.keys?.[0] || "",
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0,
        }))

        const topQueries = (queryResponse.data.rows || []).map((row) => ({
            query: row.keys?.[0] || "",
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0,
        }))

        const totalClicks = dailyData.reduce((sum, d) => sum + d.clicks, 0)
        const totalImpressions = dailyData.reduce((sum, d) => sum + d.impressions, 0)
        const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0
        const avgPosition =
            dailyData.length > 0
                ? dailyData.reduce((sum, d) => sum + d.position, 0) / dailyData.length
                : 0

        return {
            totalClicks,
            totalImpressions,
            avgCTR,
            avgPosition,
            dailyData,
            topQueries,
        }
    } catch (error) {
        console.error("Error fetching GSC data:", error)
        return null
    }
}

export async function getGSCPages(workspaceId: string, days: number = 28) {
    const { auth, siteUrl } = await getAuth(workspaceId)
    if (!auth || !siteUrl) return null

    try {
        const searchconsole = google.searchconsole({ version: "v1", auth: auth as any })
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        const formatDate = (d: Date) => d.toISOString().split("T")[0]

        const response = await searchconsole.searchanalytics.query({
            siteUrl,
            requestBody: {
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
                dimensions: ["page"],
                rowLimit: 25,
                type: "web",
            },
        })

        return (response.data.rows || []).map((row) => ({
            page: row.keys?.[0] || "",
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0,
        }))
    } catch (error) {
        console.error("Error fetching GSC pages:", error)
        return null
    }
}
