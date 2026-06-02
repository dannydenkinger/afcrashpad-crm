"use server"

import { tenantDb } from "@/lib/tenant-db";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Soft-delete: marks a document with deletedAt/deletedBy instead of removing it.
 * The document stays in Firestore until permanentlyDelete is called after the undo window.
 *
 * Tenant-isolation: getOwned() returns null if the doc isn't in this workspace,
 * so a caller passing a foreign docId can't soft-delete the wrong record.
 */
export async function softDelete(workspaceId: string, collection: string, docId: string, userId: string) {
    const db = tenantDb(workspaceId);
    const owned = await db.getOwned(collection, docId);
    if (!owned) return { success: false, error: "Document not found" };

    await db.doc(collection, docId).update({
        deletedAt: new Date(),
        deletedBy: userId,
    });

    return { success: true };
}

/**
 * Restore: removes the soft-delete markers so the item reappears.
 */
export async function restoreItem(workspaceId: string, collection: string, docId: string) {
    const db = tenantDb(workspaceId);
    const owned = await db.getOwned(collection, docId);
    if (!owned) return { success: false, error: "Document not found" };

    await db.doc(collection, docId).update({
        deletedAt: FieldValue.delete(),
        deletedBy: FieldValue.delete(),
    });

    return { success: true };
}

/**
 * Permanently delete a document from Firestore.
 * Called after the undo window has passed.
 */
export async function permanentlyDelete(workspaceId: string, collection: string, docId: string) {
    const db = tenantDb(workspaceId);
    const owned = await db.getOwned(collection, docId);
    if (!owned) return { success: false, error: "Document not found" };

    await db.doc(collection, docId).delete();
    return { success: true };
}
