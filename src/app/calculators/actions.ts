"use server"

import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { calculateBAH } from "@/lib/calculators/bah";
import { calculateTDY, calculateTripCosts } from "@/lib/calculators/tdy";

/**
 * Finds the most recent opportunity for a contact.
 */
async function findLatestOpportunity(contactId: string) {
    const oppsSnapshot = await adminDb.collection('opportunities')
        .where('contactId', '==', contactId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    
    return !oppsSnapshot.empty ? oppsSnapshot.docs[0].id : null;
}

export async function syncBAHToRent(contactId: string, monthlyRate: number) {
    await requireAuth();
    try {
        const opportunityId = await findLatestOpportunity(contactId);
        if (!opportunityId) {
            return { success: false, error: "No active opportunity found for this contact." };
        }

        await adminDb.collection('opportunities').doc(opportunityId).update({
            monthlyRent: monthlyRate,
            updatedAt: new Date()
        });

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        console.error("Failed to sync BAH to Rent:", error);
        return { success: false, error: "Failed to sync data to CRM." };
    }
}

export async function syncTDYToPerDiem(contactId: string, perDiemRate: number) {
    await requireAuth();
    try {
        const opportunityId = await findLatestOpportunity(contactId);
        if (!opportunityId) {
            return { success: false, error: "No active opportunity found for this contact." };
        }

        await adminDb.collection('opportunities').doc(opportunityId).update({
            perDiemRate: perDiemRate,
            updatedAt: new Date()
        });

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        console.error("Failed to sync TDY to Per Diem:", error);
        return { success: false, error: "Failed to sync data to CRM." };
    }
}

export async function syncVALoanToDeal(contactId: string, loanAmount: number) {
    await requireAuth();
    try {
        const opportunityId = await findLatestOpportunity(contactId);
        if (!opportunityId) {
            return { success: false, error: "No active opportunity found for this contact." };
        }

        await adminDb.collection('opportunities').doc(opportunityId).update({
            opportunityValue: loanAmount,
            updatedAt: new Date()
        });

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        console.error("Failed to sync VA Loan to Deal Value:", error);
        return { success: false, error: "Failed to sync data to CRM." };
    }
}

/**
 * Server Actions to bypass CORS for external calculators
 */
export async function calculateBAHAction(zip: string, payGrade: string, hasDependents: boolean) {
    return await calculateBAH(zip, payGrade, hasDependents);
}

export async function calculateTDYAction(params: {
    zip?: string;
    city?: string;
    state?: string;
    year: number;
}) {
    return await calculateTDY(params);
}

export async function calculateTripCostsAction(rate: any, startDate: string, endDate: string) {
    return calculateTripCosts(rate, startDate, endDate);
}
