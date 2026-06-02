"use server"

import { tenantDb } from "@/lib/tenant-db"
import { revalidatePath } from "next/cache"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"

export async function getTags() {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snapshot = await db.collection('tags').orderBy('name', 'asc').get();
        const tags = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || "",
                color: data.color || "",
                createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? null,
                updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? null,
            };
        });
        return { success: true, tags };
    } catch (error) {
        console.error("Failed to fetch tags:", error);
        return { success: false, tags: [] };
    }
}

export async function createTag(name: string, color: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        // Check for duplicates since name should ideally be unique
        const existing = await db.collection('tags').where('name', '==', name).limit(1).get();
        if (!existing.empty) {
            return { success: false, error: "A tag with this name already exists." };
        }

        await db.add('tags', {
            name,
            color,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        revalidatePath("/contacts");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Failed to create tag" };
    }
}

export async function updateTag(id: string, name: string, color: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc('tags', id).update({
            name,
            color,
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        revalidatePath("/contacts");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update tag" };
    }
}

export async function deleteTag(id: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc('tags', id).delete();

        revalidatePath("/settings");
        revalidatePath("/contacts");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete tag" };
    }
}
