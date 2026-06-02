"use server"

import { requireAuth } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { z } from "zod"
import { requirePlan } from "@/lib/billing/plans-server"

const createWorkspaceSchema = z.object({
    name: z.string().min(1).max(80).trim(),
})

/**
 * Any signed-in user can create a new workspace. They become its OWNER.
 * No admin check — this is a self-serve action like signing up for a new
 * account. Caller is responsible for switching the session to the new
 * workspace afterward (via NextAuth's `update({ workspaceId })`).
 */
export async function createWorkspace(input: { name: string }) {
    const parsed = createWorkspaceSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }
    const session = await requireAuth()
    const userId = session.user.id
    if (!userId) return { success: false, error: "Not authenticated" }

    // Multiple workspaces is Max-only. The user's currently-active
    // workspace must be on Max for them to create another one.
    try {
        await requirePlan(
            session.user.workspaceId!,
            "max",
            "Multiple workspaces",
        )
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Max plan required",
        }
    }

    try {
        const now = new Date()
        const slugBase = parsed.data.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 60)
        // Slugs are global; append a short suffix if taken.
        let slug = slugBase || "workspace"
        const slugSnap = await adminDb.collection("workspaces")
            .where("slug", "==", slug)
            .limit(1)
            .get()
        if (!slugSnap.empty) {
            slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`
        }

        const workspaceRef = await adminDb.collection("workspaces").add({
            name: parsed.data.name,
            slug,
            ownerId: userId,
            plan: "free",
            status: "active",
            memberCount: 1,
            contactCount: 0,
            email_credit_balance: 0,
            marketing_tier: "none",
            createdAt: now,
            updatedAt: now,
        })

        // Make this user the OWNER. Stamp lastActiveAt so the next sign-in
        // also lands here (matches the auth-callback workspace-pick logic).
        await adminDb.collection("workspace_members").add({
            workspaceId: workspaceRef.id,
            userId,
            role: "OWNER",
            status: "active",
            joinedAt: now,
            lastActiveAt: now,
            invitedBy: null,
        })

        // Seed defaults (pipelines, stages, statuses, tags). Non-fatal if it
        // fails — the workspace is usable, defaults can be added by the user.
        try {
            const { provisionWorkspace } = await import("@/lib/workspace-defaults")
            await provisionWorkspace(workspaceRef.id, parsed.data.name)
        } catch (err) {
            console.error("[createWorkspace] Failed to provision defaults:", err)
        }

        return { success: true, workspaceId: workspaceRef.id }
    } catch (err) {
        console.error("[createWorkspace] error:", err)
        return { success: false, error: err instanceof Error ? err.message : "Failed to create workspace" }
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
