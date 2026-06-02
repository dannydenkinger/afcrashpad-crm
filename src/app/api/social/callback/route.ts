import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { completeConnection } from "@/lib/zernio/sub-accounts"

/**
 * Zernio redirects the user back here after they complete the connect flow.
 * The sub-account ID is passed as a query parameter. We persist it and then
 * bounce the user back to the social settings page.
 *
 * Expected query params (Zernio docs):
 *   sub_account_id  - the Zernio sub-account ID (mirrors our workspace)
 *   external_id     - workspaceId we originally sent
 *   status          - "success" | "error"
 */
export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const subAccountId = url.searchParams.get("sub_account_id")
    const externalId = url.searchParams.get("external_id")
    const status = url.searchParams.get("status")
    const error = url.searchParams.get("error")

    const settingsUrl = new URL("/settings/integrations/zernio", url.origin)

    if (status === "error" || error) {
        settingsUrl.searchParams.set("error", error || "connect_failed")
        return NextResponse.redirect(settingsUrl)
    }
    if (!subAccountId) {
        settingsUrl.searchParams.set("error", "missing_sub_account_id")
        return NextResponse.redirect(settingsUrl)
    }

    try {
        const session = await requireAuth()
        const workspaceId = (session.user as { workspaceId: string }).workspaceId

        // Defense in depth: the OAuth link was created with external_id=workspaceId.
        // If Zernio echoes back a different external_id, the user may have landed
        // on a callback meant for a different workspace — refuse to bind it here.
        if (externalId && externalId !== workspaceId) {
            settingsUrl.searchParams.set("error", "workspace_mismatch")
            return NextResponse.redirect(settingsUrl)
        }

        await completeConnection(workspaceId, subAccountId)
        settingsUrl.searchParams.set("connected", "1")
        return NextResponse.redirect(settingsUrl)
    } catch (err) {
        console.error("[Zernio] callback error:", err)
        settingsUrl.searchParams.set(
            "error",
            err instanceof Error ? err.message : "callback_failed",
        )
        return NextResponse.redirect(settingsUrl)
    }
}
