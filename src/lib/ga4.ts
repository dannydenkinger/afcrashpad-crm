import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { tenantDb } from "@/lib/tenant-db";
import { google } from "googleapis";

// ── Per-workspace lazy cache ──
const _gaClients = new Map<string, { client: BetaAnalyticsDataClient; propertyId: string | null }>();

/**
 * Build a GA4 client from per-workspace OAuth tokens.
 *
 * Multi-tenant safety: there's deliberately NO env-var fallback for
 * `propertyId` or service-account credentials. Falling back would mean
 * workspaces that haven't connected GA would silently query whatever
 * property the operator put in env — i.e., a cross-tenant data leak.
 * If the workspace hasn't connected GA, we return a null client and
 * the dashboard shows the "Connect Google" empty state.
 */
async function getGaClient(workspaceId: string): Promise<{ client: BetaAnalyticsDataClient | null; propertyId: string | undefined }> {
    // Check cache
    const cached = _gaClients.get(workspaceId);
    if (cached) {
        return { client: cached.client, propertyId: cached.propertyId || undefined };
    }

    // OAuth from workspace settings — only path
    let gaClient: BetaAnalyticsDataClient | null = null;
    let oauthPropertyId: string | null = null;

    try {
        const db = tenantDb(workspaceId);
        const doc = await db.settingsDoc("integrations").get();
        const data = doc.data();
        if (data?.google?.refreshToken) {
            const oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
            );
            oauth2Client.setCredentials({
                refresh_token: data.google.refreshToken,
                access_token: data.google.accessToken,
                expiry_date: data.google.expiresAt ? data.google.expiresAt * 1000 : undefined,
            });
            gaClient = new BetaAnalyticsDataClient({ authClient: oauth2Client as any });
            oauthPropertyId = data.google.ga4PropertyId || null;
        }
    } catch (err) {
        console.error("Failed to init GA4 client for workspace:", err);
    }

    if (gaClient) {
        _gaClients.set(workspaceId, { client: gaClient, propertyId: oauthPropertyId });
    }

    return { client: gaClient, propertyId: oauthPropertyId || undefined };
}

export async function getTrafficMetrics(workspaceId: string, days: number = 7) {
    const { client: gaClient, propertyId } = await getGaClient(workspaceId);
    if (!propertyId || !gaClient) return null;

    try {
        const [response] = await gaClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
            dimensions: [{ name: "date" }],
            metrics: [
                { name: "sessions" },
                { name: "activeUsers" },
                { name: "conversions" },
            ],
            orderBys: [{ dimension: { dimensionName: "date" } }],
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

export async function getTrafficSources(workspaceId: string, days: number = 30) {
    const { client: gaClient, propertyId } = await getGaClient(workspaceId);
    if (!propertyId || !gaClient) return null;

    try {
        const [response] = await gaClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
            dimensions: [{ name: "sessionSource" }],
            metrics: [{ name: "sessions" }],
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

export async function getCoreMetrics(workspaceId: string, days: number = 7) {
    const { client: gaClient, propertyId } = await getGaClient(workspaceId);
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
