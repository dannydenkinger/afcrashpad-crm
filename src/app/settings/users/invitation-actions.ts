"use server"

import { z } from "zod"
import { tenantDb } from "@/lib/tenant-db"
import { adminDb } from "@/lib/firebase-admin"
import { requireAdmin } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const inviteUserSchema = z.object({
    email: z.string().email("Invalid email address"),
    role: z.enum(["ADMIN", "AGENT"]),
})

const invitationIdSchema = z.string().min(1).max(128)

// ── Server Actions ───────────────────────────────────────────────────────────

export async function inviteUser(email: string, role: string) {
    const parsed = inviteUserSchema.safeParse({ email, role })
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }
    email = parsed.data.email.toLowerCase()
    role = parsed.data.role

    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        // Check if this user is already an active member of this workspace
        // (users are global, so check the workspace_members join table).
        const globalUserSnap = await adminDb.collection("users")
            .where("email", "==", email)
            .limit(1)
            .get()
        if (!globalUserSnap.empty) {
            const existingUserId = globalUserSnap.docs[0].id
            const existingMember = await adminDb.collection("workspace_members")
                .where("userId", "==", existingUserId)
                .where("workspaceId", "==", workspaceId)
                .where("status", "==", "active")
                .limit(1)
                .get()
            if (!existingMember.empty) {
                return { success: false, error: "This user is already a member of this workspace." }
            }
        }

        // Check for existing pending invitation
        const existingInvites = await db.collection("workspace_invitations")
            .where("email", "==", email)
            .where("status", "==", "pending")
            .get()

        if (!existingInvites.empty) {
            return { success: false, error: "A pending invitation already exists for this email." }
        }

        // Fetch workspace name for the invitation
        const workspaceDoc = await adminDb.collection("workspaces").doc(workspaceId).get()
        const workspaceName = workspaceDoc.exists
            ? workspaceDoc.data()?.name || "Workspace"
            : "Workspace"

        const token = crypto.randomUUID()
        const now = new Date()
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

        await db.add("workspace_invitations", {
            email,
            role,
            token,
            status: "pending",
            invitedBy: session.user.id || "",
            invitedByName: session.user.name || session.user.email || "",
            workspaceName,
            createdAt: now,
            expiresAt,
        })

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        const inviteUrl = `${baseUrl}/invite/${token}`

        logAudit(workspaceId, {
            userId: session.user.id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "invitation",
            entityId: token,
            entityName: email,
            metadata: { role, inviteUrl },
        }).catch(() => {})

        revalidatePath("/settings")
        return { success: true, inviteUrl }
    } catch (error) {
        console.error("Error creating invitation:", error)
        return { success: false, error: "Failed to create invitation" }
    }
}

export async function revokeInvitation(invitationId: string) {
    const parsed = invitationIdSchema.safeParse(invitationId)
    if (!parsed.success) return { success: false, error: "Invalid invitation ID" }
    invitationId = parsed.data

    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const inviteDoc = await db.doc("workspace_invitations", invitationId).get()
        if (!inviteDoc.exists) {
            return { success: false, error: "Invitation not found" }
        }

        const inviteData = inviteDoc.data()
        await db.doc("workspace_invitations", invitationId).delete()

        logAudit(workspaceId, {
            userId: session.user.id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "delete",
            entity: "invitation",
            entityId: invitationId,
            entityName: inviteData?.email || "",
        }).catch(() => {})

        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Error revoking invitation:", error)
        return { success: false, error: "Failed to revoke invitation" }
    }
}

export async function getWorkspaceInvitations() {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required", invitations: [] }
    }

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const snap = await db.collection("workspace_invitations")
            .where("status", "==", "pending")
            .get()

        const now = new Date()
        const invitations = snap.docs.map((doc) => {
            const d = doc.data()
            const expiresAt = d.expiresAt?.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt)
            const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt)
            return {
                id: doc.id,
                email: d.email || "",
                role: d.role || "AGENT",
                token: d.token || "",
                status: expiresAt < now ? "expired" as const : "pending" as const,
                invitedByName: d.invitedByName || "",
                createdAt: createdAt.toISOString(),
                expiresAt: expiresAt.toISOString(),
            }
        })

        return { success: true, invitations }
    } catch (error) {
        console.error("Error fetching invitations:", error)
        return { success: false, error: "Failed to fetch invitations", invitations: [] }
    }
}

export async function resendInvitation(invitationId: string) {
    const parsed = invitationIdSchema.safeParse(invitationId)
    if (!parsed.success) return { success: false, error: "Invalid invitation ID" }
    invitationId = parsed.data

    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const inviteDoc = await db.doc("workspace_invitations", invitationId).get()
        if (!inviteDoc.exists) {
            return { success: false, error: "Invitation not found" }
        }

        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await db.doc("workspace_invitations", invitationId).update({
            expiresAt: newExpiresAt,
        })

        const inviteData = inviteDoc.data()
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        const inviteUrl = `${baseUrl}/invite/${inviteData?.token}`

        logAudit(workspaceId, {
            userId: session.user.id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "update",
            entity: "invitation",
            entityId: invitationId,
            entityName: inviteData?.email || "",
            metadata: { action: "resend" },
        }).catch(() => {})

        revalidatePath("/settings")
        return { success: true, inviteUrl }
    } catch (error) {
        console.error("Error resending invitation:", error)
        return { success: false, error: "Failed to resend invitation" }
    }
}
