import { google } from "googleapis"
import { JWT } from "google-auth-library"

const clientEmail = process.env.GA_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL
const rawKey = process.env.GA_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY
const privateKey = rawKey?.replace(/\\n/g, "\n")
const siteUrl = process.env.GSC_SITE_URL // e.g. "https://afcrashpad.com" or "sc-domain:afcrashpad.com"

let _auth: JWT | null = null

function getAuth() {
    if (!clientEmail || !privateKey) return null
    if (!_auth) {
        _auth = new JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
        })
    }
    return _auth
}

export async function getSearchAnalytics(days: number = 28) {
    const auth = getAuth()
    if (!auth || !siteUrl) return null

    try {
        const searchconsole = google.searchconsole({ version: "v1", auth })

        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        const formatDate = (d: Date) => d.toISOString().split("T")[0]

        // Fetch daily click/impression data
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

export async function getGSCPages(days: number = 28) {
    const auth = getAuth()
    if (!auth || !siteUrl) return null

    try {
        const searchconsole = google.searchconsole({ version: "v1", auth })
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
