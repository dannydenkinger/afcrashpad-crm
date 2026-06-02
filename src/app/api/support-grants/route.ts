import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth-guard"
import { createGrant, listGrantsForWorkspace } from "@/lib/support/grants"

export const dynamic = "force-dynamic"

const createSchema = z.object({
    duration: z.enum(["1h", "8h", "24h", "7d"]),
    scope: z.enum(["full", "read"]).optional(),
    supportEmail: z.string().email().optional(),
})

export async function GET() {
    const session = await requireAuth()
    if (session.user.role !== "OWNER" && session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // Use the originalWorkspaceId if we're already inside a support
    // session ourselves (defensive — owners shouldn't typically have
    // a support session active, but be safe).
    const workspaceId =
        ((session.user as unknown as Record<string, unknown>).originalWorkspaceId as string) ||
        session.user.workspaceId
    const grants = await listGrantsForWorkspace(workspaceId)
    return NextResponse.json({ grants })
}

export async function POST(req: NextRequest) {
    const session = await requireAuth()
    if (session.user.role !== "OWNER") {
        return NextResponse.json(
            { error: "Only the workspace owner can grant support access" },
            { status: 403 },
        )
    }
    if ((session.user as unknown as Record<string, unknown>).supportGrantId) {
        return NextResponse.json(
            { error: "Cannot create a grant from inside a support session" },
            { status: 403 },
        )
    }

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { grant, token } = await createGrant({
        workspaceId: session.user.workspaceId,
        grantedByUserId: session.user.id!,
        grantedByEmail: session.user.email!,
        grantedByName: session.user.name || "",
        duration: parsed.data.duration,
        scope: parsed.data.scope,
        supportEmail: parsed.data.supportEmail || null,
    })

    return NextResponse.json({ grant, token })
}
