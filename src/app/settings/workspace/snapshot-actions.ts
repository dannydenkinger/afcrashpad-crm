"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { logAudit } from "@/lib/audit"
import { applySnapshotToWorkspace } from "@/lib/snapshots/apply"
import { getSnapshot, SNAPSHOTS } from "@/lib/snapshots"

export interface ApplySnapshotActionResult {
    success: boolean
    error?: string
    snapshot?: string
    pipelinesCreated?: number
    stagesCreated?: number
    tagsCreated?: number
    statusesCreated?: number
    leadSourcesCreated?: number
    customFieldsCreated?: number
    automationsCreated?: number
    emailTemplatesCreated?: number
}

/**
 * Apply an industry snapshot to the current workspace. Additive — won't
 * delete or rename anything that already exists.
 */
export async function applySnapshotAction(
    slug: string,
): Promise<ApplySnapshotActionResult> {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId

    const snapshot = getSnapshot(slug)
    if (!snapshot) {
        return { success: false, error: `Unknown template: ${slug}` }
    }

    try {
        const result = await applySnapshotToWorkspace(workspaceId, snapshot)

        logAudit(workspaceId, {
            userId: session.user.id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "update",
            entity: "settings",
            entityId: "workspace_template",
            entityName: `Template: ${snapshot.name}`,
            metadata: { slug, ...result },
        }).catch(() => {})

        revalidatePath("/settings/workspace")
        return { success: true, snapshot: snapshot.name, ...result }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to apply"
        return { success: false, error: message }
    }
}

/**
 * List available snapshots + the workspace's currently-applied one.
 */
export async function listSnapshotsAction() {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    const wsDoc = await adminDb.collection("workspaces").doc(workspaceId).get()
    const currentSlug = (wsDoc.data()?.templateSlug as string | undefined) ?? "generic"

    return {
        snapshots: SNAPSHOTS.map((s) => ({
            slug: s.slug,
            name: s.name,
            description: s.description,
            category: s.category ?? "Other",
            pipelineCount: s.pipelines.length,
            stageCount: s.pipelines.reduce((sum, p) => sum + p.stages.length, 0),
            tagCount: s.tags.length,
            customFieldCount: s.customFields.length,
            automationCount: s.automations?.length ?? 0,
            emailTemplateCount: s.emailTemplates?.length ?? 0,
        })),
        currentSlug,
    }
}
