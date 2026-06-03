/**
 * Provisions a new workspace with default data.
 *
 * Calls applySnapshotToWorkspace with the GENERIC snapshot — pipelines,
 * stages, tags, statuses, lead sources. Industry-specific bundles
 * (Real Estate Rental, Service Business, etc.) live in /lib/snapshots/
 * and can be applied later via /settings/workspace.
 */

import { adminDb } from "@/lib/firebase-admin"
import { GENERIC_SNAPSHOT } from "@/lib/snapshots/generic"
import { applySnapshotToWorkspace } from "@/lib/snapshots/apply"

export async function provisionWorkspace(
    workspaceId: string,
    workspaceName: string,
) {
    const now = new Date()

    // Apply the generic snapshot first — creates pipeline + stages + tags +
    // lead sources + statuses, and stamps templateSlug = "generic" on the
    // workspace doc.
    await applySnapshotToWorkspace(workspaceId, GENERIC_SNAPSHOT)

    // Settings docs that aren't covered by the snapshot system (workspace
    // metadata, integrations placeholders, branding seed).
    const batch = adminDb.batch()
    const settingsDefaults: Record<string, Record<string, unknown>> = {
        branding: { companyName: workspaceName, workspaceId },
        integrations: { setupCompleted: false, workspaceId },
        automations: { workspaceId },
        pipeline: { workspaceId },
        commission_rates: { workspaceId },
        follow_up_reminders: { workspaceId },
        referrals: { workspaceId },
    }
    for (const [key, data] of Object.entries(settingsDefaults)) {
        const settingsRef = adminDb
            .collection("settings")
            .doc(`${workspaceId}_${key}`)
        // merge:true so re-provisioning a workspace never clobbers existing
        // settings (branding, integration keys, pipeline config, etc.).
        batch.set(settingsRef, { ...data, createdAt: now }, { merge: true })
    }
    await batch.commit()
}
