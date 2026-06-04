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

// ── Special Accommodations ────────────────────────────────────────────────────
// AFCrashpad-specific options (Spouse, Traveling with Pet, Dependents, …) shown
// in the pipeline deal pickers. Stored in the `special_accommodations`
// collection with a `name` + auto-incremented `order`.
//
// NOTE: a READ-only `getSpecialAccommodations()` already lives in
// src/app/pipeline/actions.ts and drives the pipeline picker (it returns the
// ordered {id,name}[] list). To avoid a duplicate export and to keep the picker
// untouched, the admin reader here is named `getSpecialAccommodationItems()`.
// Both read the same `special_accommodations` collection.

export async function getSpecialAccommodationItems() {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snapshot = await db.collection('special_accommodations').orderBy('order', 'asc').get();
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
        console.error("Failed to fetch special accommodations:", error);
        return { success: false, items: [] };
    }
}

export async function createSpecialAccommodation(name: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const existing = await db.collection('special_accommodations').where('name', '==', name).limit(1).get();
        if (!existing.empty) {
            return { success: false, error: "An accommodation with this name already exists." };
        }

        const snapshot = await db.collection('special_accommodations').orderBy('order', 'desc').limit(1).get();
        const nextOrder = snapshot.empty ? 0 : (snapshot.docs[0].data().order ?? 0) + 1;

        await db.add('special_accommodations', {
            name,
            order: nextOrder,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Failed to create accommodation" };
    }
}

export async function updateSpecialAccommodation(id: string, name: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc('special_accommodations', id).update({
            name,
            updatedAt: new Date()
        });

        revalidatePath("/settings");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update accommodation" };
    }
}

export async function deleteSpecialAccommodation(id: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc('special_accommodations', id).delete();

        revalidatePath("/settings");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete accommodation" };
    }
}
