"use server"

import { adminDb } from "@/lib/firebase-admin"
import { requireAuth } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"
import { FieldValue } from "firebase-admin/firestore"

/**
 * Schedule workspace deletion. Soft-delete with a 30-day grace period —
 * the workspace stays accessible (read-only banner) until an operator
 * runs the purge cron. This satisfies GDPR/CCPA on-demand deletion
 * requirements: the deletion is recorded immediately and the user gets
 * an undo window.
 *
 * Owner-only. Requires the user to type the workspace name as
 * confirmation client-side; we double-check here on the server.
 */
export async function requestWorkspaceDeletion(
    typedConfirmation: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await requireAuth()
    if (session.user.role !== "OWNER") {
        return { success: false, error: "Only the workspace owner can request deletion" }
    }
    const workspaceId = session.user.workspaceId!
    const userId = session.user.id!
    const userEmail = session.user.email!

    const wsRef = adminDb.collection("workspaces").doc(workspaceId)
    const wsSnap = await wsRef.get()
    if (!wsSnap.exists) return { success: false, error: "Workspace not found" }

    const data = wsSnap.data()!
    const expectedName = String(data.name || "").trim()
    if (typedConfirmation.trim() !== expectedName) {
        return {
            success: false,
            error: `Confirmation didn't match — type the workspace name exactly ("${expectedName}")`,
        }
    }

    if (data.deletionScheduledAt) {
        return { success: false, error: "Workspace deletion is already scheduled" }
    }

    const now = new Date()
    const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    await wsRef.update({
        deletionScheduledAt: now,
        deletionPurgeAt: purgeAt,
        deletionRequestedBy: userId,
        deletionRequestedByEmail: userEmail,
        updatedAt: FieldValue.serverTimestamp(),
    })

    await logAudit(workspaceId, {
        userId,
        userEmail,
        userName: session.user.name || userEmail,
        action: "settings_change",
        entity: "workspace",
        entityId: workspaceId,
        entityName: expectedName,
        metadata: {
            kind: "deletion_requested",
            purgeAt: purgeAt.toISOString(),
        },
    })

    return { success: true }
}

export async function cancelWorkspaceDeletion(): Promise<{ success: boolean; error?: string }> {
    const session = await requireAuth()
    if (session.user.role !== "OWNER") {
        return { success: false, error: "Only the workspace owner can cancel deletion" }
    }
    const workspaceId = session.user.workspaceId!
    const userId = session.user.id!
    const userEmail = session.user.email!

    const wsRef = adminDb.collection("workspaces").doc(workspaceId)
    const wsSnap = await wsRef.get()
    if (!wsSnap.exists) return { success: false, error: "Workspace not found" }
    const data = wsSnap.data()!

    if (!data.deletionScheduledAt) {
        return { success: false, error: "No deletion is scheduled" }
    }

    await wsRef.update({
        deletionScheduledAt: FieldValue.delete(),
        deletionPurgeAt: FieldValue.delete(),
        deletionRequestedBy: FieldValue.delete(),
        deletionRequestedByEmail: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
    })

    await logAudit(workspaceId, {
        userId,
        userEmail,
        userName: session.user.name || userEmail,
        action: "settings_change",
        entity: "workspace",
        entityId: workspaceId,
        entityName: String(data.name || "Workspace"),
        metadata: { kind: "deletion_canceled" },
    })

    return { success: true }
}

export async function getDeletionStatus(): Promise<{
    scheduled: boolean
    purgeAt: string | null
    requestedByEmail: string | null
    workspaceName: string
}> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId!
    const wsSnap = await adminDb.collection("workspaces").doc(workspaceId).get()
    if (!wsSnap.exists) {
        return { scheduled: false, purgeAt: null, requestedByEmail: null, workspaceName: "" }
    }
    const data = wsSnap.data()!
    const purgeAt = data.deletionPurgeAt?.toDate
        ? data.deletionPurgeAt.toDate().toISOString()
        : null
    return {
        scheduled: !!data.deletionScheduledAt,
        purgeAt,
        requestedByEmail: data.deletionRequestedByEmail || null,
        workspaceName: String(data.name || "Workspace"),
    }
}
