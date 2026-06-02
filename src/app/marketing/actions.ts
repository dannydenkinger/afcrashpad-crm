"use server"

import { getTrafficMetrics, getTrafficSources, getCoreMetrics } from "@/lib/ga4";
import { requireAuth } from "@/lib/auth-guard";
import { getIntegrationStatus } from "@/lib/integration-status";

export async function fetchMarketingData(days: number = 7) {
    const session = await requireAuth();
    const workspaceId = session.user.workspaceId;

    const status = await getIntegrationStatus();
    if (!status.ga4) {
        return { traffic: null, sources: null, kpis: null, connected: false };
    }

    const trafficData = await getTrafficMetrics(workspaceId, days);
    const sourcesData = await getTrafficSources(workspaceId, 30);
    const coreMetrics = await getCoreMetrics(workspaceId, days);

    return {
        traffic: trafficData,
        sources: sourcesData,
        kpis: coreMetrics,
        connected: true,
    };
}
