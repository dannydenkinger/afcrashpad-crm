import { adminDb } from "@/lib/firebase-admin"
import type { EmailTemplate } from "@/types"

function tsToISO(ts: unknown): string {
    if (!ts) return ""
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
        return (ts as { toDate: () => Date }).toDate().toISOString()
    }
    if (ts instanceof Date) return ts.toISOString()
    return typeof ts === "string" ? ts : ""
}

function mapTemplate(id: string, data: Record<string, unknown>): EmailTemplate {
    // Read from `designJson` first; fall back to legacy `topolJson` for
    // docs created before the GrapesJS migration.
    const design =
        (data.designJson as Record<string, unknown> | null | undefined) ??
        (data.topolJson as Record<string, unknown> | null | undefined) ??
        null
    return {
        id,
        workspaceId: (data.workspaceId as string) ?? "",
        name: (data.name as string) ?? "",
        description: (data.description as string) ?? undefined,
        subject: (data.subject as string) ?? "",
        designJson: design,
        renderedHtml: (data.renderedHtml as string) ?? "",
        createdBy: (data.createdBy as string) ?? null,
        createdAt: tsToISO(data.createdAt),
        updatedAt: tsToISO(data.updatedAt),
    }
}

export async function listTemplates(workspaceId: string): Promise<EmailTemplate[]> {
    if (!workspaceId) throw new Error("workspaceId required")
    const snap = await adminDb
        .collection("email_templates")
        .where("workspaceId", "==", workspaceId)
        .orderBy("updatedAt", "desc")
        .limit(200)
        .get()
    return snap.docs.map((d) => mapTemplate(d.id, d.data()))
}

export async function getTemplate(
    workspaceId: string,
    id: string,
): Promise<EmailTemplate | null> {
    if (!workspaceId) throw new Error("workspaceId required")
    const doc = await adminDb.collection("email_templates").doc(id).get()
    if (!doc.exists) return null
    const data = doc.data()!
    if (data.workspaceId !== workspaceId) return null
    return mapTemplate(doc.id, data)
}

export interface CreateTemplateInput {
    workspaceId: string
    name: string
    subject: string
    renderedHtml: string
    designJson?: Record<string, unknown> | null
    description?: string
    createdBy?: string | null
}

export async function createTemplate(input: CreateTemplateInput): Promise<EmailTemplate> {
    if (!input.workspaceId) throw new Error("workspaceId required")
    if (!input.name) throw new Error("name required")

    const now = new Date()
    const ref = await adminDb.collection("email_templates").add({
        workspaceId: input.workspaceId,
        name: input.name,
        subject: input.subject ?? "",
        description: input.description ?? null,
        renderedHtml: input.renderedHtml ?? "",
        designJson: input.designJson ?? null,
        createdBy: input.createdBy ?? null,
        createdAt: now,
        updatedAt: now,
    })
    const snap = await ref.get()
    return mapTemplate(ref.id, snap.data()!)
}

export interface UpdateTemplateInput {
    name?: string
    subject?: string
    description?: string
    renderedHtml?: string
    designJson?: Record<string, unknown> | null
}

export async function updateTemplate(
    workspaceId: string,
    id: string,
    patch: UpdateTemplateInput,
): Promise<EmailTemplate> {
    const ref = adminDb.collection("email_templates").doc(id)
    const doc = await ref.get()
    if (!doc.exists) throw new Error("Template not found")
    const existing = doc.data()!
    if (existing.workspaceId !== workspaceId) throw new Error("Forbidden")

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.name !== undefined) updates.name = patch.name
    if (patch.subject !== undefined) updates.subject = patch.subject
    if (patch.description !== undefined) updates.description = patch.description
    if (patch.renderedHtml !== undefined) updates.renderedHtml = patch.renderedHtml
    if (patch.designJson !== undefined) updates.designJson = patch.designJson

    await ref.update(updates)
    const updated = await ref.get()
    return mapTemplate(ref.id, updated.data()!)
}

export async function deleteTemplate(workspaceId: string, id: string): Promise<void> {
    const ref = adminDb.collection("email_templates").doc(id)
    const doc = await ref.get()
    if (!doc.exists) return
    if (doc.data()?.workspaceId !== workspaceId) throw new Error("Forbidden")
    await ref.delete()
}
