"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"
import type { Workflow, WorkflowCondition, WorkflowAction } from "./types"

export async function getWorkflows(): Promise<{ success: boolean; workflows?: Workflow[]; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user?.email) return { success: false, error: "Unauthorized" }

        const snap = await adminDb.collection("workflows").orderBy("createdAt", "desc").get()
        const workflows: Workflow[] = snap.docs.map(doc => {
            const data = doc.data()
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || null)
            return {
                id: doc.id,
                name: data.name || "",
                trigger: data.trigger || "",
                conditions: data.conditions || [],
                actions: data.actions || [],
                enabled: data.enabled ?? true,
                createdAt,
            }
        })
        return { success: true, workflows }
    } catch (error) {
        console.error("Failed to get workflows:", error)
        return { success: false, error: "Failed to get workflows" }
    }
}

export async function createWorkflow(data: {
    name: string
    trigger: string
    conditions: WorkflowCondition[]
    actions: WorkflowAction[]
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const ref = await adminDb.collection("workflows").add({
            name: data.name,
            trigger: data.trigger,
            conditions: data.conditions,
            actions: data.actions,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        revalidatePath("/settings")
        return { success: true, id: ref.id }
    } catch (error) {
        console.error("Failed to create workflow:", error)
        return { success: false, error: "Failed to create workflow" }
    }
}

export async function updateWorkflow(
    id: string,
    updates: {
        name?: string
        trigger?: string
        conditions?: WorkflowCondition[]
        actions?: WorkflowAction[]
        enabled?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection("workflows").doc(id).update({
            ...updates,
            updatedAt: new Date(),
        })

        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to update workflow:", error)
        return { success: false, error: "Failed to update workflow" }
    }
}

export async function deleteWorkflow(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection("workflows").doc(id).delete()
        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete workflow:", error)
        return { success: false, error: "Failed to delete workflow" }
    }
}
