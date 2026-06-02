/**
 * POST /api/v1/contacts/{id}/tags    — add tags to a contact (idempotent)
 * Body: { tagIds: string[] }
 */

import { NextRequest } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { fireTrigger } from "@/lib/automations/triggers"
import {
    badRequest,
    forbidden,
    notFound,
    ok,
    withApiKey,
} from "@/lib/api/v1"

export const dynamic = "force-dynamic"

interface Ctx {
    params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, ctx: Ctx) {
    const { id } = await ctx.params
    return withApiKey<{ tagIds?: string[] }>(
        req,
        async (apiCtx, body) => {
            const tagIds = Array.isArray(body.tagIds) ? body.tagIds : []
            if (tagIds.length === 0) return badRequest("tagIds[] required")

            const ref = adminDb.collection("contacts").doc(id)
            const doc = await ref.get()
            if (!doc.exists) return notFound()
            const data = doc.data()!
            if (data.workspaceId !== apiCtx.workspaceId) return forbidden()

            const existing = (data.tags as Array<{ tagId: string }>) ?? []
            const have = new Set(existing.map((t) => t.tagId))
            const newlyAdded: string[] = []

            // Resolve each new tag from the workspace's tags collection
            const resolved: Array<{ tagId: string; name?: string; color?: string }> = []
            for (const tagId of tagIds) {
                if (have.has(tagId)) continue
                const tagDoc = await adminDb.collection("tags").doc(tagId).get()
                if (!tagDoc.exists) continue
                resolved.push({
                    tagId,
                    name: (tagDoc.data()?.name as string) ?? tagId,
                    color: (tagDoc.data()?.color as string) ?? "#94a3b8",
                })
                newlyAdded.push(tagId)
            }

            if (newlyAdded.length > 0) {
                await ref.update({
                    tags: [...existing, ...resolved],
                    updatedAt: new Date(),
                })
            }

            // Fire tag_added for each newly attached tag
            for (const tagId of newlyAdded) {
                fireTrigger({
                    workspaceId: apiCtx.workspaceId,
                    type: "tag_added",
                    contactId: id,
                    match: { tagId },
                }).catch(() => {})
            }

            return ok({
                added: newlyAdded,
                alreadyPresent: tagIds.filter((t) => have.has(t)),
            })
        },
        { parseJson: true },
    )
}
