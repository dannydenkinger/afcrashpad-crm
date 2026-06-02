import { NextResponse } from "next/server"
import { google } from "googleapis"
import { getAuthSession } from "@/lib/auth-guard"
import { tenantDb } from "@/lib/tenant-db"

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google-services/callback`
)

export async function GET(request: Request) {
    try {
        const session = await getAuthSession()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })
        const workspaceId = (session.user as any).workspaceId
        if (!workspaceId) return new NextResponse("No workspace found", { status: 403 })
        const db = tenantDb(workspaceId)

        const url = new URL(request.url)
        const code = url.searchParams.get("code")

        if (!code) return new NextResponse("Missing authorization code", { status: 400 })

        // Exchange authorization code for tokens
        const { tokens } = await oauth2Client.getToken(code)

        const now = new Date()

        // Store unified Google tokens in settings/integrations (workspace-scoped)
        const integrationsRef = db.settingsDoc('integrations')
        await integrationsRef.set({
            google: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
                scopes: tokens.scope?.split(' ') || [],
                connectedAt: now.toISOString(),
            },
            workspaceId,
            updatedAt: now.toISOString(),
        }, { merge: true })

        // Also store in calendar_integrations for backward compatibility
        const usersSnap = await db.collection('users').where('email', '==', session.user.email).limit(1).get()
        if (!usersSnap.empty) {
            const dbUserId = usersSnap.docs[0].id
            const calIntSnap = await db.collection('calendar_integrations')
                .where('userId', '==', dbUserId)
                .limit(1)
                .get()

            const calData: Record<string, unknown> = {
                accessToken: tokens.access_token,
                expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
                updatedAt: now,
            }
            if (tokens.refresh_token) {
                calData.refreshToken = tokens.refresh_token
            }

            if (calIntSnap.empty) {
                await db.add('calendar_integrations', {
                    userId: dbUserId,
                    provider: "google",
                    refreshToken: tokens.refresh_token,
                    ...calData,
                    createdAt: now,
                })
            } else {
                await calIntSnap.docs[0].ref.update(calData)
            }
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        return NextResponse.redirect(`${baseUrl}/setup?step=2&connected=true`)

    } catch (error) {
        console.error("Google Services OAuth callback error:", error)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        return NextResponse.redirect(`${baseUrl}/setup?step=2&error=google_auth_failed`)
    }
}
