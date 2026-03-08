import { NextResponse } from "next/server"
import { google } from "googleapis"
import { auth } from "@/auth"
import { adminDb } from "@/lib/firebase-admin"

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google-calendar/callback`
)

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        const url = new URL(request.url)
        const code = url.searchParams.get("code")

        if (!code) return new NextResponse("Missing authorization code", { status: 400 })

        // Exchange the authorization code for access and refresh tokens
        const { tokens } = await oauth2Client.getToken(code)

        if (!tokens.refresh_token) {
            // Google only hands out refresh tokens on the FIRST prompt=consent flow.
            // If we don't get one, it means they need to disconnect and reconnect, or we missed it.
            // No refresh token returned - user may have already authorized. Ensure prompt='consent' is used.
        }

        const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get();
        if (usersSnap.empty) return new NextResponse("Unauthorized user", { status: 401 });
        const dbUserId = usersSnap.docs[0].id;

        // Store tokens in our dedicated CalendarIntegration table
        const querySnapshot = await adminDb.collection('calendar_integrations')
            .where('userId', '==', dbUserId)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            await adminDb.collection('calendar_integrations').add({
                userId: dbUserId,
                provider: "google",
                refreshToken: tokens.refresh_token,
                accessToken: tokens.access_token,
                expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        } else {
            const updateData: any = {
                accessToken: tokens.access_token,
                expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
                updatedAt: new Date()
            };
            
            if (tokens.refresh_token) {
                updateData.refreshToken = tokens.refresh_token;
            }
            
            await querySnapshot.docs[0].ref.update(updateData);
        }

        // Redirect back to the Integrations Settings page 
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?tab=integrations&success=true`)

    } catch (error) {
        console.error("Google Auth callback error:", error)
        // Redirect with error
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?tab=integrations&error=true`)
    }
}
