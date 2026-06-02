import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import type { Activity, ActivitySource, ActivityType } from "@/types"

export interface LogActivityInput {
    workspaceId: string
    type: ActivityType
    source: ActivitySource
    subject: string
    contactId?: string | null
    body?: string
    metadata?: Record<string, unknown>
    sourceRef?: string
}

export async function logActivity(input: LogActivityInput): Promise<string> {
    if (!input.workspaceId) throw new Error("workspaceId required")
    if (!input.type) throw new Error("activity type required")
    if (!input.subject) throw new Error("activity subject required")

    const ref = await adminDb.collection("activities").add({
        workspaceId: input.workspaceId,
        type: input.type,
        source: input.source,
        contactId: input.contactId ?? null,
        subject: input.subject,
        body: input.body ?? null,
        metadata: input.metadata ?? null,
        sourceRef: input.sourceRef ?? null,
        createdAt: FieldValue.serverTimestamp(),
    })
    return ref.id
}

export async function listActivitiesForContact(
    workspaceId: string,
    contactId: string,
    limit = 50,
): Promise<Activity[]> {
    if (!workspaceId) throw new Error("workspaceId required")
    const snap = await adminDb
        .collection("activities")
        .where("workspaceId", "==", workspaceId)
        .where("contactId", "==", contactId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get()

    return snap.docs.map((doc) => {
        const data = doc.data()
        return {
            id: doc.id,
            workspaceId: data.workspaceId,
            type: data.type,
            source: data.source,
            contactId: data.contactId,
            subject: data.subject,
            body: data.body ?? undefined,
            metadata: data.metadata ?? undefined,
            sourceRef: data.sourceRef ?? undefined,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        }
    })
}

export async function listActivitiesForWorkspace(
    workspaceId: string,
    limit = 100,
): Promise<Activity[]> {
    if (!workspaceId) throw new Error("workspaceId required")
    const snap = await adminDb
        .collection("activities")
        .where("workspaceId", "==", workspaceId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get()

    return snap.docs.map((doc) => {
        const data = doc.data()
        return {
            id: doc.id,
            workspaceId: data.workspaceId,
            type: data.type,
            source: data.source,
            contactId: data.contactId,
            subject: data.subject,
            body: data.body ?? undefined,
            metadata: data.metadata ?? undefined,
            sourceRef: data.sourceRef ?? undefined,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        }
    })
}
