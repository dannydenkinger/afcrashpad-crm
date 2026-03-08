"use server"

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Soft-delete: marks a document with deletedAt/deletedBy instead of removing it.
 * The document stays in Firestore until permanentlyDelete is called after the undo window.
 */
export async function softDelete(collection: string, docId: string, userId: string) {
    const ref = adminDb.collection(collection).doc(docId);
    const doc = await ref.get();
    if (!doc.exists) return { success: false, error: "Document not found" };

    await ref.update({
        deletedAt: new Date(),
        deletedBy: userId,
    });

    return { success: true };
}

/**
 * Restore: removes the soft-delete markers so the item reappears.
 */
export async function restoreItem(collection: string, docId: string) {
    const ref = adminDb.collection(collection).doc(docId);
    const doc = await ref.get();
    if (!doc.exists) return { success: false, error: "Document not found" };

    await ref.update({
        deletedAt: FieldValue.delete(),
        deletedBy: FieldValue.delete(),
    });

    return { success: true };
}

/**
 * Permanently delete a document from Firestore.
 * Called after the undo window has passed.
 */
export async function permanentlyDelete(collection: string, docId: string) {
    const ref = adminDb.collection(collection).doc(docId);
    await ref.delete();
    return { success: true };
}
