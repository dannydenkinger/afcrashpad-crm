"use server"

import { requireAuth } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { z } from "zod"

const createWorkspaceSchema = z.object({
    name: z.string().min(1).max(80).trim(),
})

/**
 * Single-org mode: creating additional workspaces is DISABLED. AFCrashpad runs
 * as one fixed workspace (DEFAULT_WORKSPACE_ID); the WorkspaceSwitcher "create"
 * UI is removed. Kept as a no-op so any lingering caller fails safely instead
 * of minting a workspace that would fragment the single-org data.
 */
export async function createWorkspace(input: { name: string }) {
    const parsed = createWorkspaceSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }
    return {
        success: false,
        error: "Creating additional workspaces is disabled in single-org mode.",
    }
}

export async function getUserWorkspaces() {
    const session = await requireAuth()
    const userId = session.user.id

    // Get all active memberships for this user
    const memberSnap = await adminDb.collection("workspace_members")
        .where("userId", "==", userId)
        .where("status", "==", "active")
        .get()

    if (memberSnap.empty) return []

    // Batch-fetch workspace docs
    const wsRefs = memberSnap.docs.map(d =>
        adminDb.collection("workspaces").doc(d.data().workspaceId)
    )
    const wsDocs = await adminDb.getAll(...wsRefs)

    const memberRoles = new Map(
        memberSnap.docs.map(d => [d.data().workspaceId, d.data().role])
    )

    return wsDocs
        .filter(d => d.exists)
        .map(d => ({
            id: d.id,
            name: d.data()?.name || "Unnamed Workspace",
            role: memberRoles.get(d.id) || "AGENT",
        }))
}

export async function getWorkspaceInfo(workspaceId: string) {
    await requireAuth()
    const doc = await adminDb.collection("workspaces").doc(workspaceId).get()
    if (!doc.exists) return null
    const data = doc.data()
    return {
        id: doc.id,
        name: data?.name,
        slug: data?.slug,
        plan: data?.plan,
        memberCount: data?.memberCount,
        createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
        defaultMargin: typeof data?.defaultMargin === "number" ? data.defaultMargin : null,
    }
}

const updateWorkspaceSettingsSchema = z.object({
    name: z.string().min(1).max(80).trim().optional(),
    defaultMargin: z.number().min(0).max(100).nullable().optional(),
})

/**
 * OWNER/ADMIN can rename the workspace and set a default profit margin.
 * Default margin is used as the seed value for new opportunities and as the
 * fallback for "Expected Profit" calculations on the deal-detail finance tab.
 */
export async function updateWorkspaceSettings(input: {
    name?: string
    defaultMargin?: number | null
}) {
    const parsed = updateWorkspaceSettingsSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }
    const session = await requireAuth()
    const role = (session.user as { role?: string }).role
    if (role !== "OWNER" && role !== "ADMIN") {
        return { success: false, error: "Only owners and admins can change workspace settings" }
    }
    const workspaceId = session.user.workspaceId
    if (!workspaceId) return { success: false, error: "No workspace selected" }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.name !== undefined) updates.name = parsed.data.name
    if (parsed.data.defaultMargin !== undefined) {
        updates.defaultMargin = parsed.data.defaultMargin
    }

    try {
        await adminDb.collection("workspaces").doc(workspaceId).update(updates)
        return { success: true }
    } catch (err) {
        console.error("[updateWorkspaceSettings] error:", err)
        return { success: false, error: "Failed to update workspace" }
    }
}
