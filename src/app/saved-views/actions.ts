"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"

interface SavedViewData {
    page: "contacts" | "pipeline"
    name: string
    filters: Record<string, unknown>
}

export async function getSavedViews(page: "contacts" | "pipeline") {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const userId = (session.user as any).id || session.user.email
        const snapshot = await adminDb
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
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const userId = (session.user as any).id || session.user.email

        const docRef = await adminDb.collection("saved_views").add({
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
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const userId = (session.user as any).id || session.user.email

        // Verify ownership
        const doc = await adminDb.collection("saved_views").doc(id).get()
        if (!doc.exists || doc.data()?.userId !== userId) {
            return { success: false, error: "Not found" }
        }

        await adminDb.collection("saved_views").doc(id).delete()
        return { success: true }
    } catch (error: any) {
        console.error("Failed to delete saved view:", error)
        return { success: false, error: error.message }
    }
}

export async function updateSavedViewName(id: string, name: string) {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const userId = (session.user as any).id || session.user.email

        const doc = await adminDb.collection("saved_views").doc(id).get()
        if (!doc.exists || doc.data()?.userId !== userId) {
            return { success: false, error: "Not found" }
        }

        await adminDb.collection("saved_views").doc(id).update({ name })
        return { success: true }
    } catch (error: any) {
        console.error("Failed to update saved view:", error)
        return { success: false, error: error.message }
    }
}
