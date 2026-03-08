"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"
import type { AssignmentRule, AssignmentRuleCondition } from "./types"

export async function getAssignmentRules(): Promise<{ success: boolean; rules?: AssignmentRule[]; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user?.email) return { success: false, error: "Unauthorized" }

        const snap = await adminDb.collection("assignment_rules").orderBy("createdAt", "desc").get()
        const rules: AssignmentRule[] = snap.docs.map(doc => {
            const data = doc.data()
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || null)
            return {
                id: doc.id,
                type: data.type || "round_robin",
                teamMembers: data.teamMembers || [],
                conditions: data.conditions || [],
                assignToUserId: data.assignToUserId || undefined,
                assignToUserName: data.assignToUserName || undefined,
                enabled: data.enabled ?? true,
                lastAssignedIndex: data.lastAssignedIndex ?? 0,
                createdAt,
            }
        })
        return { success: true, rules }
    } catch (error) {
        console.error("Failed to get assignment rules:", error)
        return { success: false, error: "Failed to get assignment rules" }
    }
}

export async function createAssignmentRule(data: {
    type: string
    teamMembers: { id: string; name: string; email: string }[]
    conditions: AssignmentRuleCondition[]
    assignToUserId?: string
    assignToUserName?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const ref = await adminDb.collection("assignment_rules").add({
            type: data.type,
            teamMembers: data.teamMembers,
            conditions: data.conditions,
            assignToUserId: data.assignToUserId || null,
            assignToUserName: data.assignToUserName || null,
            enabled: true,
            lastAssignedIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        revalidatePath("/settings")
        return { success: true, id: ref.id }
    } catch (error) {
        console.error("Failed to create assignment rule:", error)
        return { success: false, error: "Failed to create assignment rule" }
    }
}

export async function updateAssignmentRule(
    id: string,
    updates: {
        type?: string
        teamMembers?: { id: string; name: string; email: string }[]
        conditions?: AssignmentRuleCondition[]
        assignToUserId?: string
        assignToUserName?: string
        enabled?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection("assignment_rules").doc(id).update({
            ...updates,
            updatedAt: new Date(),
        })

        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to update assignment rule:", error)
        return { success: false, error: "Failed to update assignment rule" }
    }
}

export async function deleteAssignmentRule(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection("assignment_rules").doc(id).delete()
        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete assignment rule:", error)
        return { success: false, error: "Failed to delete assignment rule" }
    }
}
