"use server"

import { z } from "zod"
import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { FieldValue } from "firebase-admin/firestore"
import { requireAdmin } from "@/lib/auth-guard"
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
    const session = await auth()
    if (!session?.user?.email) return "AGENT"

    try {
        const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get()
        if (!usersSnap.empty) {
            return usersSnap.docs[0].data()?.role || "AGENT"
        }
    } catch (err) {
        console.error("Error getting user role:", err)
    }
    
    return "AGENT"
}

export async function updateUserRole(userId: string, newRole: string) {
    const parsed = updateUserRoleSchema.safeParse({ userId, newRole })
    if (!parsed.success) throw new Error("Invalid input")
    userId = parsed.data.userId
    newRole = parsed.data.newRole

    try {
        await requireAdmin()
    } catch {
        throw new Error("Admin access required")
    }

    try {
        const userDoc = await adminDb.collection('users').doc(userId).get()
        const previousRole = userDoc.data()?.role || ""
        const targetUserName = userDoc.data()?.name || userDoc.data()?.email || ""

        await adminDb.collection('users').doc(userId).update({
            role: newRole,
            updatedAt: new Date()
        })

        const session = await auth()
        if (session?.user) {
            logAudit({
                userId: (session.user as any).id || "",
                userEmail: session.user.email || "",
                userName: session.user.name || "",
                action: "update",
                entity: "user",
                entityId: userId,
                entityName: targetUserName,
                changes: { role: { from: previousRole, to: newRole } },
            }).catch(() => {})
        }

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

    try {
        await requireAdmin()
    } catch {
        throw new Error("Admin access required")
    }

    try {
        const userDoc = await adminDb.collection('users').doc(userId).get()
        const deletedUserName = userDoc.data()?.name || userDoc.data()?.email || ""

        await adminDb.collection('users').doc(userId).delete()

        const session = await auth()
        if (session?.user) {
            logAudit({
                userId: (session.user as any).id || "",
                userEmail: session.user.email || "",
                userName: session.user.name || "",
                action: "delete",
                entity: "user",
                entityId: userId,
                entityName: deletedUserName,
            }).catch(() => {})
        }

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

    const session = await auth()
    if (!session?.user?.email) throw new Error("Unauthorized")

    try {
        const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get()
        if (usersSnap.empty) throw new Error("User not found in DB")
        
        await adminDb.collection('users').doc(usersSnap.docs[0].id).update({
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
        const session = await auth()
        if (!session?.user?.email) return null
        const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get()
        if (usersSnap.empty) return null
        return usersSnap.docs[0].data().profileImageUrl || null
    } catch {
        return null
    }
}

export async function getSidebarProfile(): Promise<{ name: string | null; imageUrl: string | null }> {
    try {
        const session = await auth()
        if (!session?.user?.email) return { name: null, imageUrl: null }
        const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get()
        if (usersSnap.empty) return { name: null, imageUrl: null }
        const data = usersSnap.docs[0].data()
        return {
            name: data.name || null,
            imageUrl: data.profileImageUrl || null,
        }
    } catch {
        return { name: null, imageUrl: null }
    }
}

export async function disconnectGoogleCalendar() {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    try {
        const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get()
        if (usersSnap.empty) throw new Error("User not found in DB")

        const dbUserId = usersSnap.docs[0].id;

        const querySnapshot = await adminDb.collection('calendar_integrations')
            .where('userId', '==', dbUserId)
            .get();

        const batch = adminDb.batch();
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
    const session = await auth()
    if (!session?.user?.email) return null

    try {
        const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get()
        if (usersSnap.empty) return null

        const prefs = usersSnap.docs[0].data()?.notificationPreferences
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

    const session = await auth()
    if (!session?.user?.email) throw new Error("Unauthorized")

    try {
        const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get()
        if (usersSnap.empty) throw new Error("User not found")

        await adminDb.collection('users').doc(usersSnap.docs[0].id).update({
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

    const session = await auth()
    if (!session?.user?.email) throw new Error("Unauthorized")

    const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get()
    if (usersSnap.empty) throw new Error("User not found")

    const userRef = adminDb.collection('users').doc(usersSnap.docs[0].id)
    const existing: string[] = usersSnap.docs[0].data().fcmTokens || []

    if (!existing.includes(token)) {
        await userRef.update({ fcmTokens: FieldValue.arrayUnion(token) })
    }

    return { success: true }
}

export async function removeFcmToken(token: string) {
    const parsed = removeFcmTokenSchema.safeParse({ token })
    if (!parsed.success) throw new Error("Invalid input")
    token = parsed.data.token

    const session = await auth()
    if (!session?.user?.email) throw new Error("Unauthorized")

    const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get()
    if (usersSnap.empty) throw new Error("User not found")

    await adminDb.collection('users').doc(usersSnap.docs[0].id).update({
        fcmTokens: FieldValue.arrayRemove(token),
    })

    return { success: true }
}

export async function createUser(data: { name: string, email: string, role: string }) {
    const parsed = createUserSchema.safeParse(data)
    if (!parsed.success) return { success: false, error: "Invalid input" }
    data = parsed.data

    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        // Check if user already exists
        const existingUsers = await adminDb.collection('users')
            .where('email', '==', data.email)
            .get();
            
        if (!existingUsers.empty) {
            return { success: false, error: "A user with this email already exists." }
        }

        // We use doc() with no args to generate a new ID, but typically Firebase Auth users
        // will log in with Google and NextAuth will create the user document with its own ID.
        // For pre-created users, we can just create a document and NextAuth firestore adapter
        // should link it if the email matches.
        const newUserRef = await adminDb.collection('users').add({
            name: data.name,
            email: data.email,
            role: data.role,
            createdAt: new Date(),
            updatedAt: new Date()
        })

        const session = await auth()
        if (session?.user) {
            logAudit({
                userId: (session.user as any).id || "",
                userEmail: session.user.email || "",
                userName: session.user.name || "",
                action: "create",
                entity: "user",
                entityId: newUserRef.id,
                entityName: data.name,
                metadata: { email: data.email, role: data.role },
            }).catch(() => {})
        }

        revalidatePath("/settings")
        return { success: true }
    } catch (error: any) {
        console.error("Error creating user:", error)
        return { success: false, error: "Failed to create user" }
    }
}
