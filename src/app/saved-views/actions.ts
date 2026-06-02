"use server"

import { tenantDb } from "@/lib/tenant-db"
import { requireAuth } from "@/lib/auth-guard"

export type SavedViewPage = "contacts" | "pipeline" | "tasks"

interface SavedViewData {
    page: SavedViewPage
    name: string
    filters: Record<string, unknown>
}

export async function getSavedViews(page: SavedViewPage) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const userId = session.user.id || session.user.email
        const snapshot = await db
            .collection("saved_views")
            .where("userId", "==", userId)
            .where("page", "==", page)
            .orderBy("createdAt", "desc")
            .get()

        const views = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }))

        return { success: true, views }
    } catch (error: any) {
        console.error("Failed to get saved views:", error)
        return { success: false, error: error.message, views: [] }
    }
}

export async function createSavedView(data: SavedViewData) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const userId = session.user.id || session.user.email

        const docRef = await db.add("saved_views", {
            userId,
            page: data.page,
            name: data.name,
            filters: JSON.stringify(data.filters),
            createdAt: new Date().toISOString(),
        })

        return { success: true, id: docRef.id }
    } catch (error: any) {
        console.error("Failed to create saved view:", error)
        return { success: false, error: error.message }
    }
}

export async function deleteSavedView(id: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const userId = session.user.id || session.user.email

        // Verify ownership
        const doc = await db.doc("saved_views", id).get()
        if (!doc.exists || doc.data()?.userId !== userId) {
            return { success: false, error: "Not found" }
        }

        await db.doc("saved_views", id).delete()
        return { success: true }
    } catch (error: any) {
        console.error("Failed to delete saved view:", error)
        return { success: false, error: error.message }
    }
}

export async function updateSavedViewName(id: string, name: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const userId = session.user.id || session.user.email

        const doc = await db.doc("saved_views", id).get()
        if (!doc.exists || doc.data()?.userId !== userId) {
            return { success: false, error: "Not found" }
        }

        await db.doc("saved_views", id).update({ name })
        return { success: true }
    } catch (error: any) {
        console.error("Failed to update saved view:", error)
        return { success: false, error: error.message }
    }
}
