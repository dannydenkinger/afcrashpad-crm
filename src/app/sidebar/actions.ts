"use server"

import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { getAuthSession } from "@/lib/auth-guard"
import { cached } from "@/lib/server-cache"

export interface SidebarData {
    role: string
    name: string | null
    imageUrl: string | null
    branding: { companyName?: string; primaryColor?: string; logoUrl?: string } | null
    overdueTaskCount: number
}

/**
 * Single consolidated fetch for all sidebar data.
 * Replaces 4 separate server action calls (getCurrentUserRole, getSidebarProfile,
 * getBrandingSettings, getOverdueTaskCount) with 1 call that runs them in parallel.
 * This reduces HTTP round trips from 4 to 1.
 */
export async function getSidebarData(): Promise<SidebarData> {
    const session = await getAuthSession()
    const email = session?.user?.email
    const workspaceId = session?.user?.workspaceId

    // Role comes from workspace_members via session (not from users collection)
    const sessionRole = session?.user?.role || "AGENT"

    // Run all queries in parallel — single round trip
    const [userResult, brandingResult, overdueResult] = await Promise.all([
        // User profile (name + image from users collection, role from session)
        email
            ? adminDb.collection('users').where('email', '==', email).limit(1).get()
                .then(snap => {
                    if (snap.empty) return { name: null, imageUrl: null }
                    const data = snap.docs[0].data()
                    return {
                        name: data?.name || null,
                        imageUrl: data?.profileImageUrl || null,
                    }
                })
                .catch(() => ({ name: null as string | null, imageUrl: null as string | null }))
            : Promise.resolve({ name: null as string | null, imageUrl: null as string | null }),

        // Branding settings (cached for 5 min — rarely changes)
        workspaceId
            ? cached(`${workspaceId}:branding`, async () => {
                const db = tenantDb(workspaceId)
                const doc = await db.settingsDoc("branding").get()
                if (!doc.exists) return null
                const data = doc.data()
                return {
                    companyName: data?.companyName || undefined,
                    primaryColor: data?.primaryColor || undefined,
                    logoUrl: data?.logoUrl || undefined,
                }
            }, 300_000)
            : Promise.resolve(null),

        // Overdue task count (workspace-scoped)
        workspaceId
            ? tenantDb(workspaceId).collection('tasks').where('completed', '==', false).get()
                .then(snapshot => {
                    const startOfToday = new Date()
                    startOfToday.setHours(0, 0, 0, 0)
                    let count = 0
                    snapshot.forEach(doc => {
                        const task = doc.data()
                        if (!task.dueDate) return
                        const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate)
                        if (dueDate < startOfToday) count++
                    })
                    return count
                })
                .catch(() => 0)
            : Promise.resolve(0),
    ])

    return {
        role: sessionRole,
        name: userResult.name,
        imageUrl: userResult.imageUrl,
        branding: brandingResult,
        overdueTaskCount: overdueResult,
    }
}
