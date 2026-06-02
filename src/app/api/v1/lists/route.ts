/**
 * GET /api/v1/lists  — list contact lists in this workspace
 */

import { NextRequest } from "next/server"
import { listLists } from "@/lib/lists/contact-lists"
import { ok, withApiKey } from "@/lib/api/v1"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    return withApiKey(req, async (ctx) => {
        const lists = await listLists(ctx.workspaceId)
        return ok({
            data: lists.map((l) => ({
                id: l.id,
                name: l.name,
                description: l.description ?? null,
                type: l.type,
                contactCount: l.contactCount,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt,
            })),
        })
    })
}
