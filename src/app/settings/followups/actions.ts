"use server"

import { tenantDb } from "@/lib/tenant-db"
import { revalidatePath } from "next/cache"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"
import type { FollowUpConfig } from "./types"

export async function getFollowUpConfig(): Promise<{ success: boolean; config?: FollowUpConfig; error?: string }> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const doc = await db.settingsDoc("follow_up_reminders").get()
        if (!doc.exists) {
            return {
                success: true,
                config: {
                    enabled: false,
                    daysThreshold: 7,
                    pipelineIds: [],
                },
            }
        }

        const data = doc.data()!
        return {
            success: true,
            config: {
                enabled: data.enabled ?? false,
                daysThreshold: data.daysThreshold ?? 7,
                pipelineIds: data.pipelineIds || [],
            },
        }
    } catch (error) {
        console.error("Failed to get follow-up config:", error)
        return { success: false, error: "Failed to get follow-up config" }
    }
}

export async function updateFollowUpConfig(updates: {
    enabled?: boolean
    daysThreshold?: number
    pipelineIds?: string[]
}): Promise<{ success: boolean; error?: string }> {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.settingsDoc("follow_up_reminders").set(
            { ...updates, updatedAt: new Date() },
            { merge: true }
        )

        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to update follow-up config:", error)
        return { success: false, error: "Failed to update follow-up config" }
    }
}
