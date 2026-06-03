"use server"

import { requireAuth } from "@/lib/auth-guard";
import { tenantDb } from "@/lib/tenant-db";
import { revalidatePath } from "next/cache";
import { calculateBAH } from "@/lib/calculators/bah";
import { calculateTDY, calculateTripCosts } from "@/lib/calculators/tdy";

/**
 * Finds the most recent opportunity for a contact, scoped to the workspace.
 * Uses two equality filters (workspaceId + contactId) — served by Firestore's
 * automatic single-field indexes via merge join, so no composite index is
 * needed — and sorts by createdAt in memory.
 */
async function findLatestOpportunity(workspaceId: string, contactId: string) {
    const snap = await tenantDb(workspaceId)
        .collection("opportunities")
        .where("contactId", "==", contactId)
        .get();
    if (snap.empty) return null;
    const sorted = snap.docs.slice().sort((a, b) => {
        const at = a.data().createdAt?.toMillis?.() ?? 0;
        const bt = b.data().createdAt?.toMillis?.() ?? 0;
        return bt - at;
    });
    return sorted[0].id;
}

// TODO(Phase 5 — deal-sheet re-layer): reconcile these AF-specific fields with
// Vesta's generalized opportunity/expense schema. Vesta stores deal financials
// as { monthlyCost, cleaningFee, otherFee, deposit }; AF used monthlyRent /
// perDiemRate. Until the DealDetailSheet finance tab is ported, we write the AF
// field names (harmless extra fields). opportunityValue is shared by both.

export async function syncBAHToRent(contactId: string, monthlyRate: number) {
    const session = await requireAuth();
    const ws = session.user.workspaceId!;
    try {
        const opportunityId = await findLatestOpportunity(ws, contactId);
        if (!opportunityId) {
            return { success: false, error: "No active opportunity found for this contact." };
        }
        await tenantDb(ws).doc("opportunities", opportunityId).update({
            monthlyRent: monthlyRate,
            updatedAt: new Date(),
        });
        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        console.error("Failed to sync BAH to Rent:", error);
        return { success: false, error: "Failed to sync data to CRM." };
    }
}

export async function syncTDYToPerDiem(contactId: string, perDiemRate: number) {
    const session = await requireAuth();
    const ws = session.user.workspaceId!;
    try {
        const opportunityId = await findLatestOpportunity(ws, contactId);
        if (!opportunityId) {
            return { success: false, error: "No active opportunity found for this contact." };
        }
        await tenantDb(ws).doc("opportunities", opportunityId).update({
            perDiemRate: perDiemRate,
            updatedAt: new Date(),
        });
        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        console.error("Failed to sync TDY to Per Diem:", error);
        return { success: false, error: "Failed to sync data to CRM." };
    }
}

export async function syncVALoanToDeal(contactId: string, loanAmount: number) {
    const session = await requireAuth();
    const ws = session.user.workspaceId!;
    try {
        const opportunityId = await findLatestOpportunity(ws, contactId);
        if (!opportunityId) {
            return { success: false, error: "No active opportunity found for this contact." };
        }
        await tenantDb(ws).doc("opportunities", opportunityId).update({
            opportunityValue: loanAmount,
            updatedAt: new Date(),
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
