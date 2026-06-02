"use server"

import { tenantDb } from "@/lib/tenant-db"
import { revalidatePath } from "next/cache"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"

/**
 * Required-document checklist items shown on every opportunity's Docs tab.
 * Each item has a stable id and a user-defined label. Opportunities store
 * { [id]: boolean } in their `requiredDocs` field, so removing an item
 * from the workspace list doesn't break already-checked deals — the
 * stored boolean simply stops rendering.
 *
 * Storage: Firestore collection `required_docs` (per tenant).
 */

export interface RequiredDoc {
    id: string
    label: string
    /** Sort order, ascending. Lower numbers render first. */
    order?: number
}

const DEFAULT_DOCS: { id: string; label: string }[] = [
    { id: "lease", label: "Signed Contract" },
    { id: "tc", label: "Terms & Conditions" },
    { id: "payment", label: "Payment Authorization" },
]

/**
 * Fetch the workspace's required-docs list. If the collection is empty,
 * seed it with the three legacy defaults (so existing opportunity data
 * keyed by "lease" / "tc" / "payment" keeps rendering correctly).
 */
export async function getRequiredDocs(): Promise<RequiredDoc[]> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snap = await db.collection("required_docs").orderBy("order", "asc").get()
        if (snap.empty) {
            // First-run seed with the legacy defaults so older deals
            // (with requiredDocs = { lease: true, tc: true, payment: true })
            // continue to render their checkmarks.
            await Promise.all(
                DEFAULT_DOCS.map((d, idx) =>
                    db.collectionRef("required_docs").doc(d.id).set({
                        label: d.label,
                        order: idx,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }),
                ),
            )
            return DEFAULT_DOCS.map((d, idx) => ({ ...d, order: idx }))
        }
        return snap.docs.map((d) => {
            const data = d.data()
            return {
                id: d.id,
                label: data.label || d.id,
                order: data.order ?? 0,
            }
        })
    } catch {
        return []
    }
}

export async function createRequiredDoc(label: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }
    if (!label.trim()) return { success: false, error: "Label is required" }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        // Pick the next sort order
        const existing = await db.collection("required_docs").orderBy("order", "desc").limit(1).get()
        const nextOrder = existing.empty ? 0 : ((existing.docs[0].data().order ?? 0) + 1)

        await db.add("required_docs", {
            label: label.trim(),
            order: nextOrder,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        revalidatePath("/settings")
        revalidatePath("/pipeline")
        return { success: true }
    } catch {
        return { success: false, error: "Failed to create required doc" }
    }
}

export async function updateRequiredDoc(id: string, label: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }
    if (!id || !label.trim()) return { success: false, error: "Label is required" }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc("required_docs", id).update({
            label: label.trim(),
            updatedAt: new Date(),
        })

        revalidatePath("/settings")
        revalidatePath("/pipeline")
        return { success: true }
    } catch {
        return { success: false, error: "Failed to update required doc" }
    }
}

export async function deleteRequiredDoc(id: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }
    if (!id) return { success: false, error: "Missing id" }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        // Tenant-isolation: confirm ownership before delete.
        const owned = await db.getOwned("required_docs", id)
        if (!owned) return { success: false, error: "Required doc not found" }

        await db.doc("required_docs", id).delete()

        revalidatePath("/settings")
        revalidatePath("/pipeline")
        return { success: true }
    } catch {
        return { success: false, error: "Failed to delete required doc" }
    }
}

export async function reorderRequiredDocs(orderedIds: string[]) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await Promise.all(
            orderedIds.map((id, idx) =>
                db.doc("required_docs", id).update({ order: idx, updatedAt: new Date() }),
            ),
        )

        revalidatePath("/settings")
        revalidatePath("/pipeline")
        return { success: true }
    } catch {
        return { success: false, error: "Failed to reorder" }
    }
}
