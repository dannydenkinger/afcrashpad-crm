import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { cookies, headers } from "next/headers"
import { getAuthSession } from "@/lib/auth-guard"
import { findGrantByToken, isSupportAgentEmail } from "@/lib/support/grants"
import { SUPPORT_COOKIE } from "@/lib/support/session"
import { logSupportAction } from "@/lib/support/audit"

export const dynamic = "force-dynamic"

const schema = z.object({
    token: z.string().min(20).max(120),
})

export async function POST(req: NextRequest) {
    const session = await getAuthSession()
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Sign in first" }, { status: 401 })
    }
    if (!isSupportAgentEmail(session.user.email)) {
        return NextResponse.json(
            { error: "Your email isn't on the support-agent allowlist" },
            { status: 403 },
        )
    }
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }
    const found = await findGrantByToken(parsed.data.token, session.user.email)
    if (!found) {
        return NextResponse.json(
            { error: "Token is invalid, expired, revoked, or locked to a different agent" },
            { status: 401 },
        )
    }

    const jar = await cookies()
    const expiresAt = new Date(found.grant.expiresAt)
    jar.set({
        name: SUPPORT_COOKIE,
        value: parsed.data.token,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: expiresAt,
    })

    const h = await headers()
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null
    const ua = h.get("user-agent")

    await logSupportAction({
        grantId: found.grant.id,
        workspaceId: found.grant.workspaceId,
        agentUserId: session.user.id || "",
        agentEmail: session.user.email,
        action: "session_start",
        ip,
        userAgent: ua,
    })

    return NextResponse.json({
        success: true,
        workspaceId: found.grant.workspaceId,
        expiresAt: found.grant.expiresAt,
    })
}
