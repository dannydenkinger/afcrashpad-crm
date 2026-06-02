"use server"

import { z } from "zod"
import { adminDb } from "@/lib/firebase-admin"
import bcrypt from "bcryptjs"

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const tokenSchema = z.string().uuid("Invalid invitation token")

const acceptInvitationSchema = z.object({
    token: z.string().uuid("Invalid invitation token"),
    userData: z
        .object({
            name: z.string().min(1, "Name is required").max(200),
            password: z.string().min(8, "Password must be at least 8 characters"),
        })
        .optional(),
})

// ── Types ────────────────────────────────────────────────────────────────────

export interface InvitationData {
    id: string
    email: string
    role: string
    workspaceName: string
    workspaceId: string
    invitedByName: string
    status: "pending" | "accepted" | "expired"
    expiresAt: string
    /** True when a user account already exists for this email — UI should
     *  show a "join" CTA instead of the create-account form. */
    existingUser: boolean
    /** When existingUser is true, this is the existing display name so the
     *  UI can show "Join as Jane Doe" rather than asking again. */
    existingUserName?: string
}

// ── Server Actions ───────────────────────────────────────────────────────────

export async function getInvitationByToken(
    token: string
): Promise<{ success: boolean; invitation?: InvitationData; error?: string }> {
    const parsed = tokenSchema.safeParse(token)
    if (!parsed.success) {
        return { success: false, error: "Invalid invitation token" }
    }
    token = parsed.data

    try {
        // Global query — no auth needed, search across all workspaces
        const snap = await adminDb
            .collection("workspace_invitations")
            .where("token", "==", token)
            .limit(1)
            .get()

        if (snap.empty) {
            return { success: false, error: "Invitation not found or has already been used." }
        }

        const doc = snap.docs[0]
        const data = doc.data()

        // Check if already accepted
        if (data.status === "accepted") {
            return { success: false, error: "This invitation has already been accepted." }
        }

        // Check expiry
        const expiresAt = data.expiresAt?.toDate
            ? data.expiresAt.toDate()
            : new Date(data.expiresAt)

        if (expiresAt < new Date()) {
            return { success: false, error: "This invitation has expired. Please ask the admin to send a new one." }
        }

        // Look up the global user record (if any) so the UI can show
        // "Join as Jane" instead of asking for name + password again.
        let existingUser = false
        let existingUserName: string | undefined = undefined
        if (data.email) {
            const userSnap = await adminDb
                .collection("users")
                .where("email", "==", data.email)
                .limit(1)
                .get()
            if (!userSnap.empty) {
                const u = userSnap.docs[0].data()
                // Only treat as "existing" if they have a working password —
                // accounts that were pre-created without one (legacy invites)
                // still need the password form.
                if (u.passwordHash) {
                    existingUser = true
                    existingUserName = (u.name as string) || undefined
                }
            }
        }

        return {
            success: true,
            invitation: {
                id: doc.id,
                email: data.email || "",
                role: data.role || "AGENT",
                workspaceName: data.workspaceName || "Workspace",
                workspaceId: data.workspaceId || "",
                invitedByName: data.invitedByName || "",
                status: "pending",
                expiresAt: expiresAt.toISOString(),
                existingUser,
                existingUserName,
            },
        }
    } catch (error) {
        console.error("Error looking up invitation:", error)
        return { success: false, error: "Failed to look up invitation." }
    }
}

export async function acceptInvitation(
    token: string,
    userData?: { name: string; password: string }
): Promise<{ success: boolean; error?: string }> {
    const parsed = acceptInvitationSchema.safeParse({ token, userData })
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }
    token = parsed.data.token
    userData = parsed.data.userData

    try {
        // Look up the invitation
        const snap = await adminDb
            .collection("workspace_invitations")
            .where("token", "==", token)
            .limit(1)
            .get()

        if (snap.empty) {
            return { success: false, error: "Invitation not found." }
        }

        const inviteDoc = snap.docs[0]
        const inviteData = inviteDoc.data()

        if (inviteData.status === "accepted") {
            return { success: false, error: "This invitation has already been accepted." }
        }

        const expiresAt = inviteData.expiresAt?.toDate
            ? inviteData.expiresAt.toDate()
            : new Date(inviteData.expiresAt)

        if (expiresAt < new Date()) {
            return { success: false, error: "This invitation has expired." }
        }

        const workspaceId = inviteData.workspaceId
        const email = inviteData.email
        const role = inviteData.role || "AGENT"
        const now = new Date()

        // Check if user already exists (by email, globally)
        const existingUserSnap = await adminDb
            .collection("users")
            .where("email", "==", email)
            .limit(1)
            .get()

        let userId: string

        if (!existingUserSnap.empty) {
            // Existing user — just add them to the workspace
            userId = existingUserSnap.docs[0].id
            const existingUserData = existingUserSnap.docs[0].data()

            // Check if they already have a membership in this workspace
            const existingMemberSnap = await adminDb
                .collection("workspace_members")
                .where("workspaceId", "==", workspaceId)
                .where("userId", "==", userId)
                .limit(1)
                .get()

            if (!existingMemberSnap.empty) {
                // Already a member — mark invitation as accepted and return
                await inviteDoc.ref.update({
                    status: "accepted",
                    acceptedAt: now,
                })
                return { success: false, error: "You are already a member of this workspace." }
            }

            // If user has no password yet (pre-created) and userData is provided, set their password
            if (!existingUserData.passwordHash && userData) {
                const passwordHash = await bcrypt.hash(userData.password, 12)
                await existingUserSnap.docs[0].ref.update({
                    name: userData.name,
                    passwordHash,
                    updatedAt: now,
                })
            }
        } else {
            // New user — must have userData
            if (!userData) {
                return {
                    success: false,
                    error: "Please provide your name and password to create an account.",
                }
            }

            const passwordHash = await bcrypt.hash(userData.password, 12)

            const newUserRef = await adminDb.collection("users").add({
                name: userData.name,
                email,
                passwordHash,
                createdAt: now,
                updatedAt: now,
            })

            userId = newUserRef.id
        }

        // Create workspace_members entry
        await adminDb.collection("workspace_members").add({
            workspaceId,
            userId,
            role,
            status: "active",
            joinedAt: now,
            invitedBy: inviteData.invitedBy || null,
        })

        // Also create a workspace-scoped user doc so they appear in tenant queries
        // Check if one already exists in the workspace
        const wsUserSnap = await adminDb
            .collection("users")
            .where("email", "==", email)
            .where("workspaceId", "==", workspaceId)
            .limit(1)
            .get()

        if (wsUserSnap.empty) {
            // Determine the user's name
            let userName = email.split("@")[0]
            if (userData?.name) {
                userName = userData.name
            } else if (!existingUserSnap.empty) {
                userName = existingUserSnap.docs[0].data().name || userName
            }

            await adminDb.collection("users").add({
                name: userName,
                email,
                role,
                workspaceId,
                createdAt: now,
                updatedAt: now,
            })
        }

        // Update invitation status
        await inviteDoc.ref.update({
            status: "accepted",
            acceptedAt: now,
            acceptedByUserId: userId,
        })

        // Update workspace member count
        try {
            const wsDoc = await adminDb.collection("workspaces").doc(workspaceId).get()
            if (wsDoc.exists) {
                const currentCount = wsDoc.data()?.memberCount || 0
                await wsDoc.ref.update({ memberCount: currentCount + 1 })
            }
        } catch {
            // Non-critical
        }

        return { success: true }
    } catch (error) {
        console.error("Error accepting invitation:", error)
        return { success: false, error: "Failed to accept invitation. Please try again." }
    }
}
