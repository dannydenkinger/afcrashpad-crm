import { BetaAnalyticsDataClient } from "@google-analytics/data";

const propertyId = process.env.GA_PROPERTY_ID;
// Fall back to Firebase service account if GA-specific credentials aren't set
// (avoids needing two large private keys, which exceeds Netlify's 4KB env var limit)
const clientEmail = process.env.GA_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
const rawKey = process.env.GA_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
const privateKey = rawKey?.replace(/\\n/g, "\n");

// Lazy init to avoid errors when GA vars are missing (e.g. Netlify 4KB limit)
let _gaClient: BetaAnalyticsDataClient | null = null;
function getGaClient(): BetaAnalyticsDataClient | null {
    if (!clientEmail || !privateKey) return null;
    if (!_gaClient) _gaClient = new BetaAnalyticsDataClient({ credentials: { client_email: clientEmail, private_key: privateKey } });
    return _gaClient;
}

export async function getTrafficMetrics(days: number = 7) {
    const gaClient = getGaClient();
    if (!propertyId || !gaClient) {
        return null;
    }
    try {
        const [response] = await gaClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [
                {
                    startDate: `${days}daysAgo`,
                    endDate: "today",
                },
            ],
            dimensions: [
                {
                    name: "date",
                },
            ],
            metrics: [
                {
                    name: "sessions",
                },
                {
                    name: "activeUsers",
                },
                {
                    name: "conversions",
                },
            ],
            orderBys: [
                {
                    dimension: {
                        dimensionName: "date",
                    },
                },
            ],
        });

        return response.rows?.map(row => ({
            date: row.dimensionValues?.[0]?.value,
            sessions: parseInt(row.metricValues?.[0]?.value || "0"),
            users: parseInt(row.metricValues?.[1]?.value || "0"),
            conversions: parseInt(row.metricValues?.[2]?.value || "0"),
        })) || [];
    } catch (error) {
        console.error("Error fetching GA4 metrics:", error);
        return null;
    }
}

export async function getTrafficSources(days: number = 30) {
    const gaClient = getGaClient();
    if (!propertyId || !gaClient) return null;
    try {
        const [response] = await gaClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [
                {
                    startDate: `${days}daysAgo`,
                    endDate: "today",
                },
            ],
            dimensions: [
                {
                    name: "sessionSource",
                },
            ],
            metrics: [
                {
                    name: "sessions",
                },
            ],
        });

        return response.rows?.map(row => ({
            source: row.dimensionValues?.[0]?.value,
            value: parseInt(row.metricValues?.[0]?.value || "0"),
        })) || [];
    } catch (error) {
        console.error("Error fetching GA4 sources:", error);
        return null;
    }
}

export async function getCoreMetrics(days: number = 7) {
    const gaClient = getGaClient();
    if (!propertyId || !gaClient) return null;
    try {
        const [response] = await gaClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
            metrics: [
                { name: "activeUsers" },
                { name: "averageSessionDuration" },
                { name: "sessions" },
                { name: "conversions" },
            ],
        });

        const row = response.rows?.[0];
        if (!row) return null;

        // Fetch organic traffic for percentage calculation
        const [organicResponse] = await gaClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            metrics: [{ name: "sessions" }],
        });

        let organicSessions = 0;
        let totalSessions = 0;

        organicResponse.rows?.forEach(r => {
            const count = parseInt(r.metricValues?.[0]?.value || "0");
            totalSessions += count;
            if (r.dimensionValues?.[0]?.value === "Organic Search") {
                organicSessions += count;
            }
        });

        return {
            totalUsers: parseInt(row.metricValues?.[0]?.value || "0"),
            avgSessionDuration: parseFloat(row.metricValues?.[1]?.value || "0"),
            totalSessions: parseInt(row.metricValues?.[2]?.value || "0"),
            totalConversions: parseInt(row.metricValues?.[3]?.value || "0"),
            organicPercentage: totalSessions > 0 ? (organicSessions / totalSessions) * 100 : 0,
        };
    } catch (error) {
        console.error("Error fetching core GA4 metrics:", error);
        return null;
    }
}
