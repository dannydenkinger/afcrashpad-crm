import { adminDb } from "@/lib/firebase-admin"
import type { Snapshot } from "./types"

/**
 * Apply a snapshot to a workspace ADDITIVELY. Existing pipelines, tags,
 * statuses, etc. are left in place — only items the snapshot defines
 * that don't already exist (matched by name) are created.
 *
 * This is the safe path for users switching templates mid-flight: they
 * keep their data, they just gain the new industry's stuff alongside.
 *
 * Returns counts of what was created so the UI can show "added 3
 * pipelines, 5 tags, 4 statuses".
 */
export interface ApplySnapshotResult {
    pipelinesCreated: number
    stagesCreated: number
    tagsCreated: number
    statusesCreated: number
    leadSourcesCreated: number
    customFieldsCreated: number
    automationsCreated: number
    emailTemplatesCreated: number
}

export async function applySnapshotToWorkspace(
    workspaceId: string,
    snapshot: Snapshot,
): Promise<ApplySnapshotResult> {
    const now = new Date()
    const result: ApplySnapshotResult = {
        pipelinesCreated: 0,
        stagesCreated: 0,
        tagsCreated: 0,
        statusesCreated: 0,
        leadSourcesCreated: 0,
        customFieldsCreated: 0,
        automationsCreated: 0,
        emailTemplatesCreated: 0,
    }

    // ── Pipelines + stages ────────────────────────────────────────────────
    const existingPipelinesSnap = await adminDb
        .collection("pipelines")
        .where("workspaceId", "==", workspaceId)
        .get()
    const existingPipelineNames = new Set(
        existingPipelinesSnap.docs.map((d) => (d.data().name as string) ?? ""),
    )

    for (const pipeline of snapshot.pipelines) {
        if (existingPipelineNames.has(pipeline.name)) continue
        const pipelineRef = adminDb.collection("pipelines").doc()
        await pipelineRef.set({
            name: pipeline.name,
            workspaceId,
            createdAt: now,
            updatedAt: now,
        })
        result.pipelinesCreated += 1

        // Stages live in a subcollection of the pipeline doc
        const batch = adminDb.batch()
        for (const stage of pipeline.stages) {
            const stageRef = pipelineRef.collection("stages").doc()
            batch.set(stageRef, {
                ...stage,
                workspaceId,
                createdAt: now,
            })
            result.stagesCreated += 1
        }
        await batch.commit()
    }

    // ── Tags ──────────────────────────────────────────────────────────────
    const existingTagsSnap = await adminDb
        .collection("tags")
        .where("workspaceId", "==", workspaceId)
        .get()
    const existingTagNames = new Set(
        existingTagsSnap.docs.map((d) => (d.data().name as string) ?? ""),
    )
    const tagBatch = adminDb.batch()
    for (const tagName of snapshot.tags) {
        if (existingTagNames.has(tagName)) continue
        const tagRef = adminDb.collection("tags").doc()
        tagBatch.set(tagRef, { name: tagName, workspaceId, createdAt: now })
        result.tagsCreated += 1
    }
    if (result.tagsCreated > 0) await tagBatch.commit()

    // ── Lead sources ──────────────────────────────────────────────────────
    const existingSourcesSnap = await adminDb
        .collection("lead_sources")
        .where("workspaceId", "==", workspaceId)
        .get()
    const existingSourceNames = new Set(
        existingSourcesSnap.docs.map((d) => (d.data().name as string) ?? ""),
    )
    const sourceBatch = adminDb.batch()
    for (const sourceName of snapshot.leadSources) {
        if (existingSourceNames.has(sourceName)) continue
        const sourceRef = adminDb.collection("lead_sources").doc()
        sourceBatch.set(sourceRef, {
            name: sourceName,
            workspaceId,
            createdAt: now,
        })
        result.leadSourcesCreated += 1
    }
    if (result.leadSourcesCreated > 0) await sourceBatch.commit()

    // ── Contact statuses ──────────────────────────────────────────────────
    const existingStatusesSnap = await adminDb
        .collection("contact_statuses")
        .where("workspaceId", "==", workspaceId)
        .get()
    const existingStatusNames = new Set(
        existingStatusesSnap.docs.map((d) => (d.data().name as string) ?? ""),
    )
    const statusBatch = adminDb.batch()
    for (const status of snapshot.statuses) {
        if (existingStatusNames.has(status.name)) continue
        const statusRef = adminDb.collection("contact_statuses").doc()
        statusBatch.set(statusRef, { ...status, workspaceId, createdAt: now })
        result.statusesCreated += 1
    }
    if (result.statusesCreated > 0) await statusBatch.commit()

    // ── Custom fields ─────────────────────────────────────────────────────
    // Custom fields live in /custom_fields/{id} with {entity, key, name, type, options}.
    // Dedupe by entity+key so re-applying a snapshot doesn't duplicate.
    const existingCustomSnap = await adminDb
        .collection("custom_fields")
        .where("workspaceId", "==", workspaceId)
        .get()
    const existingKeyByEntity = new Set(
        existingCustomSnap.docs.map((d) => {
            const data = d.data()
            return `${data.entity}::${data.key}`
        }),
    )
    const customBatch = adminDb.batch()
    for (const field of snapshot.customFields) {
        const compositeKey = `${field.entity}::${field.key}`
        if (existingKeyByEntity.has(compositeKey)) continue
        const fieldRef = adminDb.collection("custom_fields").doc()
        customBatch.set(fieldRef, {
            ...field,
            workspaceId,
            createdAt: now,
            updatedAt: now,
        })
        result.customFieldsCreated += 1
    }
    if (result.customFieldsCreated > 0) await customBatch.commit()

    // ── Automations ───────────────────────────────────────────────────────
    // Created with enabled=false by default so the user reviews + flips on.
    if (snapshot.automations && snapshot.automations.length > 0) {
        const existingAutoSnap = await adminDb
            .collection("automations")
            .where("workspaceId", "==", workspaceId)
            .get()
        const existingAutoNames = new Set(
            existingAutoSnap.docs.map((d) => (d.data().name as string) ?? ""),
        )
        for (const auto of snapshot.automations) {
            if (existingAutoNames.has(auto.name)) continue
            const ref = adminDb.collection("automations").doc()
            await ref.set({
                workspaceId,
                name: auto.name,
                description: auto.description ?? null,
                enabled: auto.enabled ?? false,
                trigger: auto.trigger,
                nodes: auto.nodes,
                allowReEnroll: auto.allowReEnroll ?? false,
                stats: {
                    runsStarted: 0,
                    runsCompleted: 0,
                    runsErrored: 0,
                    contactsEnrolled: 0,
                },
                createdBy: null,
                createdAt: now,
                updatedAt: now,
            })
            result.automationsCreated += 1
        }
    }

    // ── Email templates ───────────────────────────────────────────────────
    if (snapshot.emailTemplates && snapshot.emailTemplates.length > 0) {
        const existingTemplatesSnap = await adminDb
            .collection("email_templates")
            .where("workspaceId", "==", workspaceId)
            .get()
        const existingTemplateNames = new Set(
            existingTemplatesSnap.docs.map((d) => (d.data().name as string) ?? ""),
        )
        for (const template of snapshot.emailTemplates) {
            if (existingTemplateNames.has(template.name)) continue
            const ref = adminDb.collection("email_templates").doc()
            await ref.set({
                workspaceId,
                name: template.name,
                subject: template.subject,
                description: template.description ?? "",
                renderedHtml: template.renderedHtml,
                designJson: null,
                createdBy: null,
                createdAt: now,
                updatedAt: now,
            })
            result.emailTemplatesCreated += 1
        }
    }

    // Stamp the snapshot slug onto the workspace doc so the UI can show
    // "current template" and pickers can highlight the active one.
    await adminDb.collection("workspaces").doc(workspaceId).update({
        templateSlug: snapshot.slug,
        templateAppliedAt: now,
    })

    return result
}
