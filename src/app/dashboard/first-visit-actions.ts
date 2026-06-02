"use server"

import { adminDb } from "@/lib/firebase-admin"
import { getAuthSession } from "@/lib/auth-guard"

/**
 * Tracks which onboarding hints the user has dismissed. Persisted in
 * `users.firstVisits` as a string array.
 */

export async function getVisitedPages(): Promise<string[]> {
    try {
        const session = await getAuthSession()
        if (!session?.user) return []
        const userId = session.user.id
        if (!userId) return []
        const doc = await adminDb.collection("users").doc(userId).get()
        const visits = doc.data()?.firstVisits
        if (Array.isArray(visits)) return visits
        return []
    } catch {
        return []
    }
}

export async function markPageVisited(pageKey: string): Promise<{ success: boolean }> {
    try {
        const session = await getAuthSession()
        if (!session?.user) return { success: false }
        const userId = session.user.id
        if (!userId) return { success: false }

        const ref = adminDb.collection("users").doc(userId)
        const snap = await ref.get()
        const current: string[] = Array.isArray(snap.data()?.firstVisits)
            ? snap.data()!.firstVisits
            : []
        if (current.includes(pageKey)) return { success: true }
        await ref.set(
            { firstVisits: [...current, pageKey] },
            { merge: true },
        )
        return { success: true }
    } catch {
        return { success: false }
    }
}
