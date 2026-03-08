"use server"

import { adminDb } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";

export async function getLeadSources() {
    try {
        const snapshot = await adminDb.collection('lead_sources').orderBy('name', 'asc').get();
        const sources = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return { success: true, sources };
    } catch (error) {
        console.error("Failed to fetch lead sources:", error);
        return { success: false, sources: [] };
    }
}

export async function createLeadSource(name: string) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        // Check for duplicates
        const existing = await adminDb.collection('lead_sources').where('name', '==', name).limit(1).get();
        if (!existing.empty) {
            return { success: false, error: "A lead source with this name already exists." };
        }

        await adminDb.collection('lead_sources').add({
            name,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Failed to create lead source" };
    }
}

export async function updateLeadSource(id: string, name: string) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection('lead_sources').doc(id).update({
            name,
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update lead source" };
    }
}

export async function deleteLeadSource(id: string) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection('lead_sources').doc(id).delete();

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete lead source" };
    }
}
