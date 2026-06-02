import { NextResponse } from "next/server"
import { google } from "googleapis"
import { getAuthSession } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"

/**
 * Handles the redirect back from Google after Gmail consent. Exchanges the
 * auth code for tokens, then persists them in the per-user/per-workspace
 * `gmail_integrations` doc so send/receive flows can find them.
 */
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/gmail/callback`,
)

export async function GET(request: Request) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    try {
        const session = await getAuthSession()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        const workspaceId = (session.user as { workspaceId?: string }).workspaceId
        const dbUserId = (session.user as { id?: string }).id
        const email = session.user.email
        if (!workspaceId || !dbUserId || !email) {
            return NextResponse.redirect(`${baseUrl}/settings/integrations?gmail=error`)
        }

        const url = new URL(request.url)
        const code = url.searchParams.get("code")
        const errorParam = url.searchParams.get("error")
        if (errorParam) {
            return NextResponse.redirect(`${baseUrl}/settings/integrations?gmail=denied`)
        }
        if (!code) return new NextResponse("Missing authorization code", { status: 400 })

        const { tokens } = await oauth2Client.getToken(code)

        const now = new Date().toISOString()
        const docId = `${workspaceId}_${dbUserId}`
        await adminDb.collection("gmail_integrations").doc(docId).set({
            userId: dbUserId,
            workspaceId,
            email,
            accessToken: tokens.access_token || null,
            refreshToken: tokens.refresh_token || null,
            accessTokenExpires: tokens.expiry_date || null,
            scope: tokens.scope || null,
            updatedAt: now,
            createdAt: now,
        }, { merge: true })

        return NextResponse.redirect(`${baseUrl}/settings/integrations?gmail=connected`)
    } catch (error) {
        console.error("Gmail OAuth callback error:", error)
        return NextResponse.redirect(`${baseUrl}/settings/integrations?gmail=error`)
    }
}
