"use server"

import { adminDb } from "@/lib/firebase-admin"
import { requireAuth } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"

export interface MembershipState {
    workspaceId: string
    workspaceName: string
    role: "OWNER" | "ADMIN" | "AGENT"
    isOnlyOwner: boolean
    transferCandidates: { id: string; name: string; email: string; role: string }[]
    otherWorkspaces: { id: string; name: string; role: string }[]
}

/**
 * Read enough state for the profile danger-zone page to decide which
 * actions to surface (leave / transfer / delete).
 */
export async function getMembershipState(): Promise<MembershipState> {
    const session = await requireAuth()
    const userId = session.user.id!
    const workspaceId = session.user.workspaceId!

    const wsDoc = await adminDb.collection("workspaces").doc(workspaceId).get()
    const workspaceName = String(wsDoc.data()?.name || "Workspace")

    // All workspace_members rows for the *current* workspace, so we can
    // (a) find candidates to transfer ownership to, and
    // (b) check whether the current user is the only OWNER.
    const membersSnap = await adminDb
        .collection("workspace_members")
        .where("workspaceId", "==", workspaceId)
        .where("status", "==", "active")
        .get()

    let myRole: "OWNER" | "ADMIN" | "AGENT" = "AGENT"
    let ownerCount = 0
    const candidateUserIds: string[] = []

    for (const doc of membersSnap.docs) {
        const d = doc.data()
        const role = (d.role || "AGENT") as "OWNER" | "ADMIN" | "AGENT"
        if (d.userId === userId) {
            myRole = role
        } else {
            candidateUserIds.push(d.userId)
        }
        if (role === "OWNER") ownerCount++
    }

    // Pull candidate user docs (names + emails).
    const candidateDocs = candidateUserIds.length
        ? await Promise.all(
              candidateUserIds.map((id) =>
                  adminDb.collection("users").doc(id).get(),
              ),
          )
        : []
    const memberRoleById = new Map<string, string>()
    membersSnap.docs.forEach((d) => {
        const data = d.data()
        memberRoleById.set(data.userId, data.role || "AGENT")
    })
    const transferCandidates = candidateDocs
        .filter((d) => d.exists)
        .map((d) => ({
            id: d.id,
            name: d.data()?.name || "",
            email: d.data()?.email || "",
            role: memberRoleById.get(d.id) || "AGENT",
        }))

    // Other workspaces this user can fall back to.
    const otherMemberSnap = await adminDb
        .collection("workspace_members")
        .where("userId", "==", userId)
        .where("status", "==", "active")
        .get()
    const otherWorkspaceIds = otherMemberSnap.docs
        .map((d) => d.data().workspaceId as string)
        .filter((id) => id !== workspaceId)

    const otherWorkspaceDocs = otherWorkspaceIds.length
        ? await Promise.all(
              otherWorkspaceIds.map((id) =>
                  adminDb.collection("workspaces").doc(id).get(),
              ),
          )
        : []
    const roleByWorkspaceId = new Map<string, string>()
    otherMemberSnap.docs.forEach((d) => {
        const data = d.data()
        if (data.workspaceId !== workspaceId) {
            roleByWorkspaceId.set(data.workspaceId, data.role || "AGENT")
        }
    })
    const otherWorkspaces = otherWorkspaceDocs
        .filter((d) => d.exists)
        .map((d) => ({
            id: d.id,
            name: d.data()?.name || "Workspace",
            role: roleByWorkspaceId.get(d.id) || "AGENT",
        }))

    return {
        workspaceId,
        workspaceName,
        role: myRole,
        isOnlyOwner: myRole === "OWNER" && ownerCount === 1,
        transferCandidates,
        otherWorkspaces,
    }
}

/**
 * Promote another active member to OWNER and demote the current user to
 * ADMIN. After this, the original OWNER can leave the workspace or
 * delete their account.
 */
export async function transferOwnership(
    targetUserId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await requireAuth()
    const myUserId = session.user.id!
    const workspaceId = session.user.workspaceId!
    if (session.user.role !== "OWNER") {
        return { success: false, error: "Only the OWNER can transfer ownership" }
    }
    if (targetUserId === myUserId) {
        return { success: false, error: "Pick a different person" }
    }

    const memberSnap = await adminDb
        .collection("workspace_members")
        .where("workspaceId", "==", workspaceId)
        .where("status", "==", "active")
        .get()
    const myMember = memberSnap.docs.find((d) => d.data().userId === myUserId)
    const targetMember = memberSnap.docs.find((d) => d.data().userId === targetUserId)
    if (!myMember) return { success: false, error: "You're not a member of this workspace" }
    if (!targetMember) {
        return { success: false, error: "Target user isn't a member of this workspace" }
    }

    const batch = adminDb.batch()
    batch.update(targetMember.ref, { role: "OWNER" })
    batch.update(myMember.ref, { role: "ADMIN" })
    await batch.commit()

    // Mirror role to user docs (some code paths read role from the user doc).
    const userBatch = adminDb.batch()
    userBatch.set(adminDb.collection("users").doc(targetUserId), { role: "OWNER" }, { merge: true })
    userBatch.set(adminDb.collection("users").doc(myUserId), { role: "ADMIN" }, { merge: true })
    await userBatch.commit()

    logAudit(workspaceId, {
        userId: myUserId,
        userEmail: session.user.email || "",
        userName: session.user.name || "",
        action: "settings_change",
        entity: "workspace",
        entityId: workspaceId,
        entityName: "Ownership transfer",
        metadata: { newOwnerUserId: targetUserId, kind: "ownership_transfer" },
    }).catch(() => {})

    return { success: true }
}

/**
 * Remove the current user from the workspace they're operating in.
 * Refuses if they're the only OWNER — they need to transfer first.
 */
export async function leaveWorkspace(): Promise<{ success: boolean; error?: string }> {
    const session = await requireAuth()
    const userId = session.user.id!
    const workspaceId = session.user.workspaceId!

    const memberSnap = await adminDb
        .collection("workspace_members")
        .where("workspaceId", "==", workspaceId)
        .where("status", "==", "active")
        .get()
    const myMember = memberSnap.docs.find((d) => d.data().userId === userId)
    if (!myMember) return { success: false, error: "You're not a member of this workspace" }

    const ownerCount = memberSnap.docs.filter((d) => d.data().role === "OWNER").length
    if (myMember.data().role === "OWNER" && ownerCount === 1) {
        return {
            success: false,
            error: "You're the only OWNER — transfer ownership or delete the workspace first.",
        }
    }

    await myMember.ref.delete()

    logAudit(workspaceId, {
        userId,
        userEmail: session.user.email || "",
        userName: session.user.name || "",
        action: "delete",
        entity: "workspace_member",
        entityId: myMember.id,
        entityName: session.user.email || "",
        metadata: { kind: "self_leave" },
    }).catch(() => {})

    return { success: true }
}

/**
 * Permanently delete the current user's global account.
 *
 * Preconditions:
 *   - User must not be the only OWNER of any workspace they're in.
 *
 * Cleanup performed:
 *   - users/<id>
 *   - workspace_members where userId
 *   - gmail_integrations where userId (workspaceId-scoped doc IDs)
 *   - calendar_integrations where userId
 *
 * Audit and email logs are intentionally retained for compliance and
 * delivery records.
 */
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
    const session = await requireAuth()
    const userId = session.user.id!
    const userEmail = session.user.email || ""

    // Block if user is the only OWNER of any workspace.
    const memberships = await adminDb
        .collection("workspace_members")
        .where("userId", "==", userId)
        .where("status", "==", "active")
        .get()
    for (const m of memberships.docs) {
        if (m.data().role !== "OWNER") continue
        const wsId = m.data().workspaceId
        const owners = await adminDb
            .collection("workspace_members")
            .where("workspaceId", "==", wsId)
            .where("status", "==", "active")
            .where("role", "==", "OWNER")
            .get()
        if (owners.size === 1) {
            return {
                success: false,
                error: "You're the only OWNER of one of your workspaces. Transfer ownership or delete the workspace first.",
            }
        }
    }

    // Delete user doc.
    await adminDb.collection("users").doc(userId).delete()

    // Delete all workspace_members rows for this user.
    if (!memberships.empty) {
        const batch = adminDb.batch()
        memberships.docs.forEach((doc) => batch.delete(doc.ref))
        await batch.commit()
    }

    // Delete gmail + calendar integrations owned by this user.
    const [gmailSnap, calendarSnap] = await Promise.all([
        adminDb
            .collection("gmail_integrations")
            .where("userId", "==", userId)
            .get(),
        adminDb
            .collection("calendar_integrations")
            .where("userId", "==", userId)
            .get(),
    ])
    if (!gmailSnap.empty || !calendarSnap.empty) {
        const batch = adminDb.batch()
        gmailSnap.docs.forEach((doc) => batch.delete(doc.ref))
        calendarSnap.docs.forEach((doc) => batch.delete(doc.ref))
        await batch.commit()
    }

    // Audit (last write before they're gone).
    for (const m of memberships.docs) {
        const wsId = m.data().workspaceId
        logAudit(wsId, {
            userId,
            userEmail,
            userName: session.user.name || userEmail,
            action: "delete",
            entity: "user",
            entityId: userId,
            entityName: userEmail,
            metadata: { kind: "self_delete_account" },
        }).catch(() => {})
    }

    return { success: true }
}
