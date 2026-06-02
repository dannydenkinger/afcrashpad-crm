import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { createConnectLink, getConnection } from "@/lib/zernio/sub-accounts"
import { isZernioConfigured, ZernioNotConfiguredError } from "@/lib/zernio/client"

export async function POST(req: NextRequest) {
    if (!isZernioConfigured()) {
        return NextResponse.json(
            { error: "Zernio is not configured on this server." },
            { status: 503 },
        )
    }
    try {
        const session = await requireAuth()
        const workspaceId = (session.user as { workspaceId: string }).workspaceId

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
        const redirectUrl = `${baseUrl.replace(/\/$/, "")}/api/social/callback`

        const existing = await getConnection(workspaceId)
        const { url, expiresAt } = await createConnectLink(
            workspaceId,
            redirectUrl,
            existing?.zernioAccountId,
        )
        return NextResponse.json({ url, expiresAt })
    } catch (err) {
        if (err instanceof ZernioNotConfiguredError) {
            return NextResponse.json({ error: err.message }, { status: 503 })
        }
        const message = err instanceof Error ? err.message : "Failed to create connect link"
        console.error("[Zernio] /api/social/connect error:", err)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
