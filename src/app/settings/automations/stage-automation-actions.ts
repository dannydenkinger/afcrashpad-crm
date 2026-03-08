"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/audit"
import { requireAdmin } from "@/lib/auth-guard"
import type { StageAutomationAction, StageAutomationRule } from "@/lib/stage-automation-types"

// ── Fetch all stage automation rules ─────────────────────────────────────────

export async function getStageAutomationRules(): Promise<{
    success: boolean
    rules?: StageAutomationRule[]
    error?: string
}> {
    try {
        const snap = await adminDb
            .collection("stage_automations")
            .orderBy("createdAt", "desc")
            .get()

        const rules: StageAutomationRule[] = snap.docs.map((doc) => {
            const d = doc.data()
            return {
                id: doc.id,
                stageId: d.stageId || "",
                stageName: d.stageName || "",
                pipelineId: d.pipelineId || "",
                pipelineName: d.pipelineName || "",
                actions: d.actions || [],
                enabled: d.enabled ?? true,
                createdAt: d.createdAt?.toDate?.().toISOString() ?? null,
                updatedAt: d.updatedAt?.toDate?.().toISOString() ?? null,
            }
        })

        return { success: true, rules }
    } catch (error) {
        console.error("Failed to fetch stage automation rules:", error)
        return { success: false, error: "Failed to fetch rules" }
    }
}

// ── Create a stage automation rule ───────────────────────────────────────────

export async function createStageAutomationRule(data: {
    stageId: string
    stageName: string
    pipelineId: string
    pipelineName: string
    actions: StageAutomationAction[]
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const session = await auth()
        if (!session?.user?.email) return { success: false, error: "Unauthorized" }

        if (!data.stageId || !data.actions?.length) {
            return { success: false, error: "Stage and at least one action are required" }
        }

        const ref = await adminDb.collection("stage_automations").add({
            stageId: data.stageId,
            stageName: data.stageName,
            pipelineId: data.pipelineId,
            pipelineName: data.pipelineName,
            actions: data.actions,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email,
            userName: session.user.name || "",
            action: "create",
            entity: "stage_automation",
            entityId: ref.id,
            entityName: `Stage automation: ${data.stageName}`,
            metadata: { stageId: data.stageId, actions: data.actions },
        }).catch(() => {})

        revalidatePath("/settings")
        return { success: true, id: ref.id }
    } catch (error) {
        console.error("Failed to create stage automation rule:", error)
        return { success: false, error: "Failed to create rule" }
    }
}

// ── Update a stage automation rule ───────────────────────────────────────────

export async function updateStageAutomationRule(
    id: string,
    data: {
        stageId?: string
        stageName?: string
        pipelineId?: string
        pipelineName?: string
        actions?: StageAutomationAction[]
        enabled?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const session = await auth()
        if (!session?.user?.email) return { success: false, error: "Unauthorized" }

        await adminDb.collection("stage_automations").doc(id).update({
            ...data,
            updatedAt: new Date(),
        })

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email,
            userName: session.user.name || "",
            action: "update",
            entity: "stage_automation",
            entityId: id,
            entityName: `Stage automation rule`,
            metadata: data,
        }).catch(() => {})

        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to update stage automation rule:", error)
        return { success: false, error: "Failed to update rule" }
    }
}

// ── Delete a stage automation rule ───────────────────────────────────────────

export async function deleteStageAutomationRule(
    id: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const session = await auth()
        if (!session?.user?.email) return { success: false, error: "Unauthorized" }

        await adminDb.collection("stage_automations").doc(id).delete()

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email,
            userName: session.user.name || "",
            action: "delete",
            entity: "stage_automation",
            entityId: id,
            entityName: "Stage automation rule",
        }).catch(() => {})

        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete stage automation rule:", error)
        return { success: false, error: "Failed to delete rule" }
    }
}

// ── Toggle enabled/disabled ──────────────────────────────────────────────────

export async function toggleStageAutomationRule(
    id: string,
    enabled: boolean
): Promise<{ success: boolean; error?: string }> {
    return updateStageAutomationRule(id, { enabled })
}
