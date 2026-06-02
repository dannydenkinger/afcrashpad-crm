"use server"

import { tenantDb } from "@/lib/tenant-db"
import { requireAuth } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { AVAILABLE_MERGE_FIELDS } from "./types"

// ── Document Templates ──

export async function getDocumentTemplates() {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snapshot = await db.collection("document_templates")
            .orderBy("createdAt", "desc")
            .get()

        const templates = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate().toISOString() : doc.data().updatedAt,
        }))

        return { success: true, templates }
    } catch (error) {
        console.error("Failed to fetch document templates:", error)
        return { success: false, error: "Failed to fetch templates", templates: [] }
    }
}

export async function createDocumentTemplate(
    name: string,
    description: string,
    content: string,
    category: string,
    mergeFields: string[]
) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        if (!name.trim()) return { success: false, error: "Name is required" }
        if (!content.trim()) return { success: false, error: "Content is required" }

        const docRef = await db.add("document_templates", {
            name: name.trim(),
            description: description.trim(),
            content: content.trim(),
            category: category.trim() || "General",
            mergeFields,
            createdBy: session.user.email || session.user.name || "Unknown",
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        revalidatePath("/contacts")
        return { success: true, id: docRef.id }
    } catch (error) {
        console.error("Failed to create document template:", error)
        return { success: false, error: "Failed to create template" }
    }
}

export async function updateDocumentTemplate(
    templateId: string,
    data: {
        name?: string
        description?: string
        content?: string
        category?: string
        mergeFields?: string[]
    }
) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const updateData: Record<string, unknown> = { updatedAt: new Date() }
        if (data.name !== undefined) updateData.name = data.name.trim()
        if (data.description !== undefined) updateData.description = data.description.trim()
        if (data.content !== undefined) updateData.content = data.content.trim()
        if (data.category !== undefined) updateData.category = data.category.trim()
        if (data.mergeFields !== undefined) updateData.mergeFields = data.mergeFields

        await db.doc("document_templates", templateId).update(updateData)

        revalidatePath("/contacts")
        return { success: true }
    } catch (error) {
        console.error("Failed to update document template:", error)
        return { success: false, error: "Failed to update template" }
    }
}

export async function deleteDocumentTemplate(templateId: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc("document_templates", templateId).delete()

        revalidatePath("/contacts")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete document template:", error)
        return { success: false, error: "Failed to delete template" }
    }
}

/**
 * Generate a document from a template by merging contact data into the template content.
 * Returns the merged HTML content.
 */
export async function generateDocumentFromTemplate(templateId: string, contactId: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        // Fetch the template
        const templateDoc = await db.doc("document_templates", templateId).get()
        if (!templateDoc.exists) return { success: false, error: "Template not found" }
        const template = templateDoc.data()!

        // Fetch the contact
        const contactDoc = await db.doc("contacts", contactId).get()
        if (!contactDoc.exists) return { success: false, error: "Contact not found" }
        const contact = contactDoc.data()!

        // Build the merge field map
        const mergeData: Record<string, string> = {
            contactName: contact.name || "",
            contactEmail: contact.email || "",
            contactPhone: contact.phone || "",
            businessName: contact.businessName || "",
            currentDate: new Date().toLocaleDateString(),
        }

        // Replace merge fields in template content: {{fieldName}} -> value
        let mergedContent = template.content as string
        for (const [key, value] of Object.entries(mergeData)) {
            mergedContent = mergedContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value)
        }

        // Save the generated document as a record on the contact
        const docName = `${template.name} - ${contact.name || "Unknown"}`
        await db.addToSubcollection("contacts", contactId, "documents", {
            name: docName,
            url: "",
            status: "LINK",
            folder: "Generated",
            generatedContent: mergedContent,
            templateId,
            templateName: template.name,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        revalidatePath("/contacts")
        return { success: true, content: mergedContent, name: docName }
    } catch (error) {
        console.error("Failed to generate document from template:", error)
        return { success: false, error: "Failed to generate document" }
    }
}
