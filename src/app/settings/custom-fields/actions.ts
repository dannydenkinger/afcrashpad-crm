"use server"

import { z } from "zod"
import { adminDb } from "@/lib/firebase-admin"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
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
    const session = await auth()
    if (!session?.user?.email) return []

    try {
        let query: FirebaseFirestore.Query = adminDb.collection("custom_fields").orderBy("order", "asc")
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
    await requireAdmin()

    const parsed = customFieldSchema.safeParse(data)
    if (!parsed.success) throw new Error("Invalid input: " + parsed.error.message)

    // Get the next order value
    const existing = await adminDb.collection("custom_fields")
        .where("entityType", "==", parsed.data.entityType)
        .orderBy("order", "desc")
        .limit(1)
        .get()

    const nextOrder = existing.empty ? 0 : (existing.docs[0].data().order || 0) + 1

    const ref = await adminDb.collection("custom_fields").add({
        ...parsed.data,
        order: nextOrder,
        createdAt: new Date(),
    })

    const session = await auth()
    if (session?.user) {
        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "custom_field",
            entityId: ref.id,
            entityName: parsed.data.name,
        }).catch(() => {})
    }

    revalidatePath("/settings")
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
    await requireAdmin()

    const parsed = updateCustomFieldSchema.safeParse(data)
    if (!parsed.success) throw new Error("Invalid input: " + parsed.error.message)

    const { id, ...fields } = parsed.data

    await adminDb.collection("custom_fields").doc(id).update({
        ...fields,
        updatedAt: new Date(),
    })

    const session = await auth()
    if (session?.user) {
        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "update",
            entity: "custom_field",
            entityId: id,
            entityName: fields.name,
        }).catch(() => {})
    }

    revalidatePath("/settings")
    return { success: true }
}

export async function deleteCustomField(id: string) {
    await requireAdmin()

    if (!id || id.length > 128) throw new Error("Invalid field ID")

    const doc = await adminDb.collection("custom_fields").doc(id).get()
    const fieldName = doc.data()?.name || ""

    await adminDb.collection("custom_fields").doc(id).delete()

    const session = await auth()
    if (session?.user) {
        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "delete",
            entity: "custom_field",
            entityId: id,
            entityName: fieldName,
        }).catch(() => {})
    }

    revalidatePath("/settings")
    return { success: true }
}
