/**
 * GET  /api/v1/contacts        — list (cursor-paginated, max 100/page)
 * POST /api/v1/contacts        — create
 *
 * Query params:
 *   limit   1..100 (default 25)
 *   cursor  doc id from `nextCursor` of previous page
 *   email   exact-match filter
 *   tag     exact tag id
 *
 * Body for POST:
 *   { name?, email, phone?, status?, businessName?, customFields? }
 */

import { NextRequest } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { fireTrigger } from "@/lib/automations/triggers"
import {
    badRequest,
    created,
    ok,
    withApiKey,
} from "@/lib/api/v1"
import { mapContact, type ContactPayload } from "@/lib/api/v1-contact-map"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    return withApiKey(req, async (ctx) => {
        const sp = req.nextUrl.searchParams
        const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "25", 10) || 25))
        const cursor = sp.get("cursor") || ""
        const email = (sp.get("email") || "").trim().toLowerCase()
        const tag = (sp.get("tag") || "").trim()

        let query = adminDb
            .collection("contacts")
            .where("workspaceId", "==", ctx.workspaceId)
            .orderBy("createdAt", "desc") as FirebaseFirestore.Query

        if (email) {
            query = query.where("email", "==", email)
        }
        if (cursor) {
            // Defense-in-depth: only accept a cursor that points at a contact
            // in this workspace. Without this, a caller could seed pagination
            // with a foreign contact's createdAt value (data is still
            // workspace-scoped by the where() above, so this is mostly noise
            // protection, but it's the right hygiene).
            const cursorDoc = await adminDb.collection("contacts").doc(cursor).get()
            if (cursorDoc.exists && cursorDoc.data()?.workspaceId === ctx.workspaceId) {
                query = query.startAfter(cursorDoc)
            }
        }
        const snap = await query.limit(limit + 1).get()

        let docs = snap.docs.slice(0, limit)
        if (tag) {
            docs = docs.filter((d) =>
                ((d.data().tags as Array<{ tagId: string }>) ?? []).some(
                    (t) => t.tagId === tag,
                ),
            )
        }
        const contacts = docs.map((d) => mapContact(d.id, d.data()))
        const hasMore = snap.docs.length > limit
        const nextCursor = hasMore ? snap.docs[limit - 1].id : null

        return ok({ data: contacts, nextCursor, hasMore })
    })
}

export async function POST(req: NextRequest) {
    return withApiKey<Partial<ContactPayload> & { customFields?: Record<string, unknown> }>(
        req,
        async (ctx, body) => {
            const email = (body.email || "").trim().toLowerCase()
            const name = (body.name || "").trim()
            if (!email && !name) {
                return badRequest("Either name or email is required")
            }
            if (email && !email.includes("@")) {
                return badRequest("Invalid email")
            }

            const now = new Date()
            const data: Record<string, unknown> = {
                workspaceId: ctx.workspaceId,
                name: name || email,
                email: email || null,
                phone: body.phone ?? null,
                status: body.status ?? "Lead",
                businessName: body.businessName ?? null,
                tags: [],
                source: "api",
                createdBy: ctx.userId,
                createdAt: now,
                updatedAt: now,
            }
            if (body.customFields && typeof body.customFields === "object") {
                data.customFields = body.customFields
            }
            const ref = await adminDb.collection("contacts").add(data)

            // Fire contact_created trigger so automations enroll new API contacts
            fireTrigger({
                workspaceId: ctx.workspaceId,
                type: "contact_created",
                contactId: ref.id,
                contactEmail: email || undefined,
                payload: { source: "api" },
            }).catch(() => {})

            const snap = await ref.get()
            return created({ contact: mapContact(ref.id, snap.data()!) })
        },
        { parseJson: true },
    )
}
