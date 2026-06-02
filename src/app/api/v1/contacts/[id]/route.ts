/**
 * GET    /api/v1/contacts/{id}   — fetch one
 * PATCH  /api/v1/contacts/{id}   — update fields (only provided fields change)
 * DELETE /api/v1/contacts/{id}   — soft fail if not yours; 204 on success
 */

import { NextRequest } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { fireTrigger } from "@/lib/automations/triggers"
import {
    badRequest,
    forbidden,
    noContent,
    notFound,
    ok,
    withApiKey,
} from "@/lib/api/v1"
import { mapContact, type ContactPayload } from "@/lib/api/v1-contact-map"

export const dynamic = "force-dynamic"

interface Ctx {
    params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, ctx: Ctx) {
    const { id } = await ctx.params
    return withApiKey(req, async (apiCtx) => {
        const doc = await adminDb.collection("contacts").doc(id).get()
        if (!doc.exists) return notFound()
        const data = doc.data()!
        if (data.workspaceId !== apiCtx.workspaceId) return forbidden()
        return ok({ contact: mapContact(doc.id, data) })
    })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
    const { id } = await ctx.params
    return withApiKey<Partial<ContactPayload> & { customFields?: Record<string, unknown> }>(
        req,
        async (apiCtx, body) => {
            const ref = adminDb.collection("contacts").doc(id)
            const doc = await ref.get()
            if (!doc.exists) return notFound()
            if (doc.data()?.workspaceId !== apiCtx.workspaceId) return forbidden()

            const updates: Record<string, unknown> = { updatedAt: new Date() }
            const allowed = [
                "name",
                "email",
                "phone",
                "status",
                "businessName",
            ] as const
            for (const k of allowed) {
                if (body[k] !== undefined) {
                    updates[k] =
                        k === "email" && typeof body[k] === "string"
                            ? (body[k] as string).trim().toLowerCase()
                            : body[k]
                }
            }
            if (body.customFields && typeof body.customFields === "object") {
                updates.customFields = body.customFields
            }

            if (Object.keys(updates).length === 1) {
                return badRequest("No updatable fields supplied")
            }

            await ref.update(updates)

            // Fire contact_field_updated for each changed field — matches the
            // behavior of the in-app updateContact action
            for (const k of Object.keys(updates)) {
                if (k === "updatedAt") continue
                fireTrigger({
                    workspaceId: apiCtx.workspaceId,
                    type: "contact_field_updated",
                    contactId: id,
                    contactEmail:
                        typeof updates.email === "string"
                            ? (updates.email as string)
                            : undefined,
                    match: { fieldPath: k },
                    payload: { fieldPath: k, newValue: updates[k] },
                }).catch(() => {})
            }

            const updated = await ref.get()
            return ok({ contact: mapContact(updated.id, updated.data()!) })
        },
        { parseJson: true },
    )
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
    const { id } = await ctx.params
    return withApiKey(req, async (apiCtx) => {
        const ref = adminDb.collection("contacts").doc(id)
        const doc = await ref.get()
        if (!doc.exists) return notFound()
        if (doc.data()?.workspaceId !== apiCtx.workspaceId) return forbidden()
        await ref.delete()
        return noContent()
    })
}
