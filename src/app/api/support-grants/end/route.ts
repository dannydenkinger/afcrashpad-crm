import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getAuthSession } from "@/lib/auth-guard"
import { SUPPORT_COOKIE } from "@/lib/support/session"
import { logSupportAction } from "@/lib/support/audit"

export const dynamic = "force-dynamic"

export async function POST() {
    const session = await getAuthSession()
    const u = (session?.user as unknown as Record<string, unknown> | undefined) || {}
    const grantId = u.supportGrantId as string | undefined
    const workspaceId = u.actAsWorkspaceId as string | undefined

    const jar = await cookies()
    jar.delete(SUPPORT_COOKIE)

    if (grantId && workspaceId && session?.user?.email) {
        await logSupportAction({
            grantId,
            workspaceId,
            agentUserId: session.user.id || "",
            agentEmail: session.user.email,
            action: "session_end",
        })
    }

    return NextResponse.json({ success: true })
}
