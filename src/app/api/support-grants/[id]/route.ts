import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { revokeGrant } from "@/lib/support/grants"

export const dynamic = "force-dynamic"

export async function DELETE(
    _req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
) {
    const session = await requireAuth()
    if (session.user.role !== "OWNER" && session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { id } = await ctx.params
    const workspaceId =
        ((session.user as unknown as Record<string, unknown>).originalWorkspaceId as string) ||
        session.user.workspaceId
    const res = await revokeGrant(id, workspaceId, session.user.email!)
    if (!res.success) {
        return NextResponse.json({ error: res.error || "Failed" }, { status: 400 })
    }
    return NextResponse.json({ success: true })
}
