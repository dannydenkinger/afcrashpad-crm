"use server"

import { tenantDb } from "@/lib/tenant-db"
import { revalidatePath } from "next/cache"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"

function toISO(val: unknown): string | null {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (val instanceof Date) return val.toISOString();
    if (typeof (val as any).toDate === 'function') return (val as any).toDate().toISOString();
    return null;
}

export async function getContactStatuses() {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snapshot = await db.collection('contact_statuses').orderBy('order', 'asc').get();
        const items = snapshot.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                name: d.name,
                order: d.order ?? 999,
                createdAt: toISO(d.createdAt),
                updatedAt: toISO(d.updatedAt),
            };
        });
        return { success: true, items };
    } catch (error) {
        console.error("Failed to fetch contact statuses:", error);
        return { success: false, items: [] };
    }
}

export async function createContactStatus(name: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const existing = await db.collection('contact_statuses').where('name', '==', name).limit(1).get();
        if (!existing.empty) {
            return { success: false, error: "A status with this name already exists." };
        }

        const snapshot = await db.collection('contact_statuses').orderBy('order', 'desc').limit(1).get();
        const nextOrder = snapshot.empty ? 0 : (snapshot.docs[0].data().order ?? 0) + 1;

        await db.add('contact_statuses', {
            name,
            order: nextOrder,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        revalidatePath("/contacts");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Failed to create status" };
    }
}

export async function updateContactStatus(id: string, name: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc('contact_statuses', id).update({
            name,
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update status" };
    }
}

export async function deleteContactStatus(id: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc('contact_statuses', id).delete();

        revalidatePath("/settings");
        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete status" };
    }
}
