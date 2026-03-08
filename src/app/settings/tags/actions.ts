"use server"

import { adminDb } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/auth-guard";

export async function getTags() {
    try {
        const snapshot = await adminDb.collection('tags').orderBy('name', 'asc').get();
        const tags = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return { success: true, tags };
    } catch (error) {
        console.error("Failed to fetch tags:", error);
        return { success: false, tags: [] };
    }
}

export async function createTag(name: string, color: string) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        // Check for duplicates since name should ideally be unique
        const existing = await adminDb.collection('tags').where('name', '==', name).limit(1).get();
        if (!existing.empty) {
            return { success: false, error: "A tag with this name already exists." };
        }

        await adminDb.collection('tags').add({
            name,
            color,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Failed to create tag" };
    }
}

export async function updateTag(id: string, name: string, color: string) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection('tags').doc(id).update({
            name,
            color,
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update tag" };
    }
}

export async function deleteTag(id: string) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection('tags').doc(id).delete();

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete tag" };
    }
}
