"use server"

import { tenantDb } from "@/lib/tenant-db";
import { requireAuth } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

export async function getContactDocuments(contactId: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snapshot = await db.subcollection('contacts', contactId, 'documents')
            .orderBy('createdAt', 'desc')
            .get();

        const documents = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            folder: doc.data().folder || "General",
            createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate().toISOString() : doc.data().updatedAt
        }));

        return { success: true, documents };
    } catch (error) {
        console.error("Failed to fetch documents:", error);
        return { success: false, documents: [] };
    }
}

export async function addDocument(contactId: string, name: string, url: string, status: string = "LINK", folder: string = "General") {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.addToSubcollection('contacts', contactId, 'documents', {
            name,
            url,
            status,
            folder,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to add document" };
    }
}

export async function updateDocumentStatus(contactId: string, id: string, status: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.subcollection('contacts', contactId, 'documents').doc(id).update({
            status,
            updatedAt: new Date()
        });

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update document status" };
    }
}

export async function deleteDocument(contactId: string, id: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.subcollection('contacts', contactId, 'documents').doc(id).delete();

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete document" };
    }
}

// ── Folder Management ──

export async function getDocumentFolders(contactId: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snapshot = await db.subcollection('contacts', contactId, 'documents').get();
        const folderSet = new Set<string>();
        folderSet.add("General");

        snapshot.docs.forEach(doc => {
            const folder = doc.data().folder || "General";
            folderSet.add(folder);
        });

        // Count documents per folder
        const folderCounts: Record<string, number> = {};
        for (const folder of folderSet) {
            folderCounts[folder] = 0;
        }
        snapshot.docs.forEach(doc => {
            const folder = doc.data().folder || "General";
            folderCounts[folder] = (folderCounts[folder] || 0) + 1;
        });

        return {
            success: true,
            folders: Array.from(folderSet).map(name => ({
                name,
                count: folderCounts[name] || 0,
            })),
        };
    } catch (error) {
        console.error("Failed to fetch document folders:", error);
        return { success: false, folders: [] };
    }
}

export async function createFolder(contactId: string, folderName: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        if (!folderName.trim()) return { success: false, error: "Folder name is required" };

        // Folders are implicit (derived from documents' folder field).
        // We store a metadata doc so empty folders persist.
        await db.subcollection('contacts', contactId, 'document_folders').doc(folderName.trim()).set({
            name: folderName.trim(),
            createdAt: new Date(),
        });

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to create folder" };
    }
}

export async function moveToFolder(contactId: string, documentId: string, folderName: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.subcollection('contacts', contactId, 'documents').doc(documentId).update({
            folder: folderName,
            updatedAt: new Date(),
        });

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to move document" };
    }
}
