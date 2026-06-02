"use server"

import { z } from "zod"
import { tenantDb } from "@/lib/tenant-db"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/audit"
import type { CustomField } from "./types"

// ── Schemas ──────────────────────────────────────────────────────────────

const customFieldSchema = z.object({
    name: z.string().min(1).max(100),
    type: z.enum(["text", "number", "date", "dropdown", "checkbox", "url", "email"]),
    entityType: z.enum(["contact", "deal"]),
    required: z.boolean().default(false),
    options: z.array(z.string()).default([]),
})

const updateCustomFieldSchema = customFieldSchema.extend({
    id: z.string().min(1).max(128),
})

export async function getCustomFields(entityType?: "contact" | "deal"): Promise<CustomField[]> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        let query: FirebaseFirestore.Query = db.collection("custom_fields").orderBy("order", "asc")
        if (entityType) {
            query = query.where("entityType", "==", entityType)
        }
        const snapshot = await query.get()
        return snapshot.docs.map((doc) => {
            const data = doc.data()
            return {
                id: doc.id,
                name: data.name,
                type: data.type,
                entityType: data.entityType,
                required: data.required || false,
                options: data.options || [],
                order: data.order || 0,
                createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
            }
        })
    } catch (err) {
        console.error("Error fetching custom fields:", err)
        return []
    }
}

export async function createCustomField(data: {
    name: string
    type: string
    entityType: string
    required: boolean
    options: string[]
}) {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    const parsed = customFieldSchema.safeParse(data)
    if (!parsed.success) throw new Error("Invalid input: " + parsed.error.message)

    // Get the next order value
    const existing = await db.collection("custom_fields")
        .where("entityType", "==", parsed.data.entityType)
        .orderBy("order", "desc")
        .limit(1)
        .get()

    const nextOrder = existing.empty ? 0 : (existing.docs[0].data().order || 0) + 1

    const ref = await db.add("custom_fields", {
        ...parsed.data,
        order: nextOrder,
        createdAt: new Date(),
    })

    logAudit(workspaceId, {
        userId: session.user.id || "",
        userEmail: session.user.email || "",
        userName: session.user.name || "",
        action: "create",
        entity: "custom_field",
        entityId: ref.id,
        entityName: parsed.data.name,
    }).catch(() => {})

    revalidatePath("/settings")
    revalidatePath("/contacts")
    revalidatePath("/pipeline")
    return { success: true, id: ref.id }
}

export async function updateCustomField(data: {
    id: string
    name: string
    type: string
    entityType: string
    required: boolean
    options: string[]
}) {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    const parsed = updateCustomFieldSchema.safeParse(data)
    if (!parsed.success) throw new Error("Invalid input: " + parsed.error.message)

    const { id, ...fields } = parsed.data

    await db.doc("custom_fields", id).update({
        ...fields,
        updatedAt: new Date(),
    })

    logAudit(workspaceId, {
        userId: session.user.id || "",
        userEmail: session.user.email || "",
        userName: session.user.name || "",
        action: "update",
        entity: "custom_field",
        entityId: id,
        entityName: fields.name,
    }).catch(() => {})

    revalidatePath("/settings")
    revalidatePath("/contacts")
    revalidatePath("/pipeline")
    return { success: true }
}

export async function deleteCustomField(id: string) {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    if (!id || id.length > 128) throw new Error("Invalid field ID")

    const doc = await db.doc("custom_fields", id).get()
    const fieldName = doc.data()?.name || ""

    await db.doc("custom_fields", id).delete()

    logAudit(workspaceId, {
        userId: session.user.id || "",
        userEmail: session.user.email || "",
        userName: session.user.name || "",
        action: "delete",
        entity: "custom_field",
        entityId: id,
        entityName: fieldName,
    }).catch(() => {})

    revalidatePath("/settings")
    revalidatePath("/contacts")
    revalidatePath("/pipeline")
    return { success: true }
}
