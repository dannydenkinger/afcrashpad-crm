"use server"

import { z } from "zod"
import { tenantDb } from "@/lib/tenant-db"
import { adminDb } from "@/lib/firebase-admin"
import { getAuthSession, requireAdmin, requireAuth } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { FieldValue } from "firebase-admin/firestore"
import { logAudit } from "@/lib/audit"

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const firestoreIdSchema = z.string().min(1).max(128)

const updateUserRoleSchema = z.object({
    userId: firestoreIdSchema,
    newRole: z.enum(["OWNER", "ADMIN", "AGENT"]),
})

const deleteUserSchema = z.object({ userId: firestoreIdSchema })

const updateProfileSchema = z.object({
    name: z.string().min(1).max(200),
    phone: z.string().max(50).or(z.literal("")),
})

const updateNotificationPreferencesSchema = z.object({
    prefs: z.record(z.string(), z.boolean()),
})

const saveFcmTokenSchema = z.object({
    token: z.string().min(1).max(500),
})

const removeFcmTokenSchema = z.object({
    token: z.string().min(1).max(500),
})

const createUserSchema = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    role: z.enum(["OWNER", "ADMIN", "AGENT"]),
})

export async function getCurrentUserRole() {
    const session = await getAuthSession()
    if (!session?.user) return "AGENT"
    return session.user.role || "AGENT"
}

export async function updateUserRole(userId: string, newRole: string) {
    const parsed = updateUserRoleSchema.safeParse({ userId, newRole })
    if (!parsed.success) throw new Error("Invalid input")
    userId = parsed.data.userId
    newRole = parsed.data.newRole

    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const userDoc = await db.doc('users', userId).get()
        const previousRole = userDoc.data()?.role || ""
        const targetUserName = userDoc.data()?.name || userDoc.data()?.email || ""

        const memberSnap = await adminDb.collection('workspace_members')
            .where('workspaceId', '==', workspaceId)
            .where('userId', '==', userId)
            .limit(1)
            .get()

        const batch = adminDb.batch()
        batch.update(db.doc('users', userId), {
            role: newRole,
            updatedAt: new Date(),
        })
        if (!memberSnap.empty) {
            batch.update(memberSnap.docs[0].ref, { role: newRole })
        }
        await batch.commit()

        logAudit(workspaceId, {
            userId: session.user.id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "update",
            entity: "user",
            entityId: userId,
            entityName: targetUserName,
            changes: { role: { from: previousRole, to: newRole } },
        }).catch(() => {})

        revalidatePath("/settings/users")
        return { success: true }
    } catch (error) {
        console.error("Error updating user role:", error)
        throw new Error("Failed to update user role")
    }
}

export async function deleteUser(userId: string) {
    const parsed = deleteUserSchema.safeParse({ userId })
    if (!parsed.success) throw new Error("Invalid input")
    userId = parsed.data.userId

    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const userDoc = await db.doc('users', userId).get()
        const deletedUserName = userDoc.data()?.name || userDoc.data()?.email || ""

        const memberSnap = await adminDb.collection('workspace_members')
            .where('workspaceId', '==', workspaceId)
            .where('userId', '==', userId)
            .get()

        const batch = adminDb.batch()
        batch.delete(db.doc('users', userId))
        memberSnap.docs.forEach(doc => batch.delete(doc.ref))
        await batch.commit()

        logAudit(workspaceId, {
            userId: session.user.id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "delete",
            entity: "user",
            entityId: userId,
            entityName: deletedUserName,
        }).catch(() => {})

        revalidatePath("/settings/users")
        return { success: true }
    } catch (error) {
        console.error("Error deleting user:", error)
        throw new Error("Failed to delete user")
    }
}

export async function updateProfile(name: string, phone: string) {
    const parsed = updateProfileSchema.safeParse({ name, phone })
    if (!parsed.success) throw new Error("Invalid input")
    name = parsed.data.name
    phone = parsed.data.phone

    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const userId = session.user.id!
        await db.doc('users', userId).update({
            name,
            phone,
            updatedAt: new Date()
        })
        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Error updating profile:", error)
        throw new Error("Failed to update profile")
    }
}

export async function getProfileImageUrl(): Promise<string | null> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const userDoc = await db.doc('users', session.user.id!).get()
        if (!userDoc.exists) return null
        return userDoc.data()?.profileImageUrl || null
    } catch {
        return null
    }
}

export async function getSidebarProfile(): Promise<{ name: string | null; imageUrl: string | null }> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const userDoc = await db.doc('users', session.user.id!).get()
        if (!userDoc.exists) return { name: null, imageUrl: null }
        const data = userDoc.data()
        return {
            name: data?.name || null,
            imageUrl: data?.profileImageUrl || null,
        }
    } catch {
        return { name: null, imageUrl: null }
    }
}

export async function disconnectGoogleCalendar() {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const userId = session.user.id

        const querySnapshot = await db.collection('calendar_integrations')
            .where('userId', '==', userId)
            .get();

        const batch = db.batch();
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Error disconnecting Google Calendar:", error);
        throw new Error("Failed to disconnect calendar");
    }
}

export async function getNotificationPreferences() {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        const userDoc = await db.doc('users', session.user.id!).get()
        if (!userDoc.exists) return null

        const prefs = userDoc.data()?.notificationPreferences
        return prefs || null
    } catch (err) {
        console.error("Error getting notification preferences:", err)
        return null
    }
}

export async function updateNotificationPreferences(prefs: Record<string, boolean>) {
    const parsed = updateNotificationPreferencesSchema.safeParse({ prefs })
    if (!parsed.success) throw new Error("Invalid input")
    prefs = parsed.data.prefs

    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    try {
        await db.doc('users', session.user.id!).update({
            notificationPreferences: prefs,
            updatedAt: new Date()
        })

        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Error updating notification preferences:", error)
        throw new Error("Failed to update notification preferences")
    }
}

export async function saveFcmToken(token: string) {
    const parsed = saveFcmTokenSchema.safeParse({ token })
    if (!parsed.success) throw new Error("Invalid input")
    token = parsed.data.token

    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    const userDoc = await db.doc('users', session.user.id!).get()
    if (!userDoc.exists) throw new Error("User not found")

    const existing: string[] = userDoc.data()?.fcmTokens || []

    if (!existing.includes(token)) {
        await db.doc('users', session.user.id!).update({ fcmTokens: FieldValue.arrayUnion(token) })
    }

    return { success: true }
}

export async function removeFcmToken(token: string) {
    const parsed = removeFcmTokenSchema.safeParse({ token })
    if (!parsed.success) throw new Error("Invalid input")
    token = parsed.data.token

    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    await db.doc('users', session.user.id!).update({
        fcmTokens: FieldValue.arrayRemove(token),
    })

    return { success: true }
}

export async function getPushNotificationStatus(): Promise<{
    pushEnabled: boolean
    pushPromptDismissed: boolean
}> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const userDoc = await db.doc('users', session.user.id!).get()
        if (!userDoc.exists) return { pushEnabled: false, pushPromptDismissed: false }

        const userData = userDoc.data()
        return {
            pushEnabled: userData?.notificationPreferences?.pushEnabled === true || (userData?.fcmTokens?.length || 0) > 0,
            pushPromptDismissed: userData?.pushPromptDismissed === true,
        }
    } catch {
        return { pushEnabled: false, pushPromptDismissed: false }
    }
}

export async function dismissPushPrompt() {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc('users', session.user.id!).update({
            pushPromptDismissed: true,
        })
    } catch {
        // Non-critical
    }
}

export async function createUser(data: { name: string, email: string, role: string }) {
    const parsed = createUserSchema.safeParse(data)
    if (!parsed.success) return { success: false, error: "Invalid input" }
    data = parsed.data

    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        // Check if user already exists in this workspace
        const existingUsers = await db.collection('users')
            .where('email', '==', data.email)
            .get();
            
        if (!existingUsers.empty) {
            return { success: false, error: "A user with this email already exists." }
        }

        const now = new Date()
        const newUserRef = await db.add('users', {
            name: data.name,
            email: data.email,
            role: data.role,
            createdAt: now,
            updatedAt: now,
        })

        // Also create a workspace_members entry
        try {
            await adminDb.collection('workspace_members').add({
                workspaceId,
                userId: newUserRef.id,
                role: data.role,
                status: 'active',
                joinedAt: now,
                invitedBy: session.user.id || null,
            })
        } catch (err) {
            console.error("Failed to create workspace_members entry:", err)
        }

        logAudit(workspaceId, {
            userId: session.user.id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "user",
            entityId: newUserRef.id,
            entityName: data.name,
            metadata: { email: data.email, role: data.role },
        }).catch(() => {})

        revalidatePath("/settings")
        return { success: true }
    } catch (error: any) {
        console.error("Error creating user:", error)
        return { success: false, error: "Failed to create user" }
    }
}
