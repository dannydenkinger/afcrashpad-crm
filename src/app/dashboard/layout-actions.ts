"use server"

import { adminDb } from "@/lib/firebase-admin"
import { requireAuth } from "@/lib/auth-guard"
import type { GridLayoutItem } from "./widget-registry"

/**
 * Per-user dashboard layouts. Stored on the user doc so layouts follow
 * the user across browsers / devices.
 *
 * Shape on Firestore:
 *   users/{userId}.dashboardLayouts = SavedLayoutsDoc
 *
 * Backwards compatibility: older documents may have `dashboardLayout`
 * (singular, from the previous fixed-id-grid implementation). On read,
 * if the new field is missing but the legacy field is present, we
 * synthesize a single "My dashboard" entry from it. First save flushes
 * the new shape and the legacy field stops being read.
 */

export interface DashboardLayout {
    id: string                 // Stable id for this layout (slug-style).
    name: string               // Human-readable, editable.
    items: GridLayoutItem[]    // react-grid-layout positions.
    createdAt?: string         // ISO; omitted on the in-memory default.
    updatedAt?: string
}

export interface SavedLayoutsDoc {
    /** All saved layouts in display order. */
    layouts: DashboardLayout[]
    /** ID of the layout shown on first load. */
    defaultLayoutId: string | null
}

const EMPTY_DOC: SavedLayoutsDoc = { layouts: [], defaultLayoutId: null }

// ─── Read ───────────────────────────────────────────────────────────────

export async function getDashboardLayouts(): Promise<SavedLayoutsDoc> {
    try {
        const session = await requireAuth()
        const userId = (session.user as { id: string }).id
        if (!userId) return EMPTY_DOC
        const doc = await adminDb.collection("users").doc(userId).get()
        const data = doc.data()
        const v2 = data?.dashboardLayouts as SavedLayoutsDoc | undefined
        if (v2 && Array.isArray(v2.layouts)) {
            return v2
        }
        // Legacy migration: older fixed-grid layout shape — best effort.
        const legacy = data?.dashboardLayout as { order?: string[] } | undefined
        if (legacy?.order && legacy.order.length > 0) {
            return {
                layouts: [
                    {
                        id: "legacy",
                        name: "My dashboard",
                        items: legacy.order.map((id, idx) => ({
                            i: id,
                            x: (idx * 4) % 12,
                            y: Math.floor(idx / 3) * 5,
                            w: 4,
                            h: 5,
                        })),
                    },
                ],
                defaultLayoutId: "legacy",
            }
        }
        return EMPTY_DOC
    } catch {
        return EMPTY_DOC
    }
}

// ─── Write ──────────────────────────────────────────────────────────────

export async function saveDashboardLayouts(
    payload: SavedLayoutsDoc,
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await requireAuth()
        const userId = (session.user as { id: string }).id
        if (!userId) return { success: false, error: "No user" }

        // Defensive: clean shape, drop any non-serializable junk.
        const cleaned: SavedLayoutsDoc = {
            layouts: (payload.layouts || []).map((l) => ({
                id: l.id,
                name: l.name,
                items: (l.items || []).map((it) => ({
                    i: String(it.i),
                    x: Number(it.x),
                    y: Number(it.y),
                    w: Number(it.w),
                    h: Number(it.h),
                })),
                createdAt: l.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })),
            defaultLayoutId: payload.defaultLayoutId ?? null,
        }

        await adminDb.collection("users").doc(userId).set(
            {
                dashboardLayouts: cleaned,
                dashboardLayoutUpdatedAt: new Date(),
            },
            { merge: true },
        )
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save layouts"
        return { success: false, error: message }
    }
}
