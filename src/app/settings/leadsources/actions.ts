"use server"

import { tenantDb } from "@/lib/tenant-db"
import { revalidatePath } from "next/cache"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"

export async function getLeadSources() {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snapshot = await db.collection('lead_sources').orderBy('name', 'asc').get();
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
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        // Check for duplicates
        const existing = await db.collection('lead_sources').where('name', '==', name).limit(1).get();
        if (!existing.empty) {
            return { success: false, error: "A lead source with this name already exists." };
        }

        await db.add('lead_sources', {
            name,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        revalidatePath("/contacts");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Failed to create lead source" };
    }
}

export async function updateLeadSource(id: string, name: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc('lead_sources', id).update({
            name,
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update lead source" };
    }
}

export async function deleteLeadSource(id: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc('lead_sources', id).delete();

        revalidatePath("/settings");
        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete lead source" };
    }
}
