"use server"

import { adminDb } from "@/lib/firebase-admin"
import { requireAuth } from "@/lib/auth-guard"
import { tenantDb } from "@/lib/tenant-db"
import { FieldValue } from "firebase-admin/firestore"
import { cookies } from "next/headers"

/**
 * Reset the post-signup welcome screen so it re-runs on next visit to
 * /setup. Clears both the workspace-level `setupCompleted` flag and
 * the per-user `setup_completed` cookie.
 */
export async function resetWelcomeScreen(): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId!
        const db = tenantDb(workspaceId)

        await db.settingsDoc("integrations").set(
            {
                setupCompleted: false,
                setupCompletedAt: FieldValue.delete(),
                updatedAt: new Date().toISOString(),
                workspaceId,
            },
            { merge: true },
        )

        const cookieStore = await cookies()
        cookieStore.delete("setup_completed")

        return { success: true }
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to reset welcome screen"
        return { success: false, error: msg }
    }
}

/**
 * Re-show the sidebar setup checklist — clears dismissed flag and any
 * skipped tasks. Completed tasks remain checked (since completion is
 * computed from real data, not state).
 */
export async function resetChecklist(): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await requireAuth()
        const userId = session.user.id!
        await adminDb.collection("users").doc(userId).set(
            {
                setupChecklist: {
                    dismissed: false,
                    skipped: [],
                },
            },
            { merge: true },
        )
        return { success: true }
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to reset checklist"
        return { success: false, error: msg }
    }
}

/**
 * Clear all dismissed first-visit hints so they re-appear on each page.
 */
export async function resetPageHints(): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await requireAuth()
        const userId = session.user.id!
        await adminDb.collection("users").doc(userId).set(
            { firstVisits: [] },
            { merge: true },
        )
        return { success: true }
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to reset hints"
        return { success: false, error: msg }
    }
}

/**
 * Resets everything onboarding-related in one call.
 */
export async function restartAllOnboarding(): Promise<{ success: boolean; error?: string }> {
    const a = await resetWelcomeScreen()
    if (!a.success) return a
    const b = await resetChecklist()
    if (!b.success) return b
    const c = await resetPageHints()
    if (!c.success) return c
    return { success: true }
}
