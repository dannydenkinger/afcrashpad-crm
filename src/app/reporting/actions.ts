"use server"

import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/auth";

export async function getReportingData() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        // 1. Total Closed Profit (assuming 'Booked' or similar stage means closed)
        // First we need to find the IDs of stages that mean "closed/booked"
        const stagesSnap = await adminDb.collectionGroup('stages').get();
        const bookedStageIds = stagesSnap.docs
            .filter(doc => ['Booked', 'Closed', 'Signed', 'Closed Won'].includes(doc.data().name))
            .map(doc => doc.id);

        let totalProfit = 0;
        let bookedCount = 0;
        let totalOpportunitiesCount = 0;

        const oppsSnap = await adminDb.collection('opportunities').get();
        totalOpportunitiesCount = oppsSnap.size;

        oppsSnap.forEach(doc => {
            const data = doc.data();
            if (data.status === "closed_won" || bookedStageIds.includes(data.pipelineStageId)) {
                bookedCount++;
                totalProfit += (data.estimatedProfit || 0);
            }
        });

        const avgProfit = bookedCount > 0 ? totalProfit / bookedCount : 0;

        // 2. Conversion Rate (Total Opportunities vs Booked)
        const conversionRate = totalOpportunitiesCount > 0 ? (bookedCount / totalOpportunitiesCount) * 100 : 0;

        // 3. SEO Keywords & Base Performance (aggregate from contacts)
        const contactsSnap = await adminDb.collection('contacts').get();
        
        const keywordCounts: Record<string, number> = {};
        const baseCounts: Record<string, number> = {};

        contactsSnap.forEach(doc => {
            const data = doc.data();
            if (data.sourceKeyword) {
                keywordCounts[data.sourceKeyword] = (keywordCounts[data.sourceKeyword] || 0) + 1;
            }
            if (data.militaryBase) {
                baseCounts[data.militaryBase] = (baseCounts[data.militaryBase] || 0) + 1;
            }
        });

        const topKeywords = Object.entries(keywordCounts)
            .map(([keyword, count]) => ({ keyword, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const basePerformance = Object.entries(baseCounts)
            .map(([base, count]) => ({ base, count }))
            .sort((a, b) => b.count - a.count);

        return {
            success: true,
            data: {
                totalProfit,
                avgProfit,
                bookedCount,
                conversionRate,
                topKeywords,
                basePerformance
            }
        };
    } catch (error) {
        console.error("Reporting data error:", error);
        return { success: false, error: "Failed to fetch reporting data" };
    }
}
