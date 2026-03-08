"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"
import type { FollowUpConfig } from "./types"

export async function getFollowUpConfig(): Promise<{ success: boolean; config?: FollowUpConfig; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user?.email) return { success: false, error: "Unauthorized" }

        const doc = await adminDb.collection("settings").doc("follow_up_reminders").get()
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
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection("settings").doc("follow_up_reminders").set(
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
