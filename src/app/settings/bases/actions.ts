"use server"

import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";

export async function getBases() {
    try {
        const snapshot = await adminDb.collection('military_bases').orderBy('name', 'asc').get();
        const bases = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const periodsSnap = await doc.ref.collection('periods').orderBy('startDate', 'asc').get();
            const periods = periodsSnap.docs.map(pDoc => ({
                id: pDoc.id,
                ...pDoc.data()
            }));

            bases.push({
                id: doc.id,
                name: data.name,
                zipCode: data.zipCode || "",
                periods
            });
        }

        return { success: true, bases };
    } catch (error) {
        console.error("Failed to fetch bases:", error);
        return { success: false, bases: [], error: "Failed to fetch bases" };
    }
}

export async function createBase(data: { name: string; zipCode: string; periods: { startDate: string; endDate: string; rate: number }[] }) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const baseRef = adminDb.collection('military_bases').doc();
        const batch = adminDb.batch();

        batch.set(baseRef, {
            name: data.name,
            zipCode: data.zipCode,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        for (const period of data.periods) {
            const periodRef = baseRef.collection('periods').doc();
            batch.set(periodRef, {
                ...period
            });
        }

        await batch.commit();

        revalidatePath("/settings");
        return { success: true, base: { id: baseRef.id, name: data.name } };
    } catch (error: any) {
        console.error("Failed to create base:", error);
        return { success: false, error: error.message || "Failed to create base" };
    }
}

export async function updateBase(id: string, data: { name: string; zipCode: string; periods: { startDate: string; endDate: string; rate: number }[] }) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const baseRef = adminDb.collection('military_bases').doc(id);
        const batch = adminDb.batch();

        batch.update(baseRef, {
            name: data.name,
            zipCode: data.zipCode,
            updatedAt: new Date()
        });

        // Delete existing periods
        const periodsSnap = await baseRef.collection('periods').get();
        periodsSnap.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Add new periods
        for (const period of data.periods) {
            const periodRef = baseRef.collection('periods').doc();
            batch.set(periodRef, {
                ...period
            });
        }

        await batch.commit();

        revalidatePath("/settings");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update base:", error);
        return { success: false, error: error.message || "Failed to update base" };
    }
}

export async function deleteBase(id: string) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const baseRef = adminDb.collection('military_bases').doc(id);
        
        // Delete subcollections
        const periodsSnap = await baseRef.collection('periods').get();
        const batch = adminDb.batch();
        periodsSnap.forEach(doc => {
            batch.delete(doc.ref);
        });
        batch.delete(baseRef);
        await batch.commit();

        revalidatePath("/settings");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete base:", error);
        return { success: false, error: error.message || "Failed to delete base" };
    }
}
