"use server"

import { tenantDb } from "@/lib/tenant-db"
import { revalidatePath } from "next/cache"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"
import type { Workflow, WorkflowCondition, WorkflowAction } from "./types"

export async function getWorkflows(): Promise<{ success: boolean; workflows?: Workflow[]; error?: string }> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snap = await db.collection("workflows").orderBy("createdAt", "desc").get()
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
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const ref = await db.add("workflows", {
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
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc("workflows", id).update({
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
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc("workflows", id).delete()
        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete workflow:", error)
        return { success: false, error: "Failed to delete workflow" }
    }
}
