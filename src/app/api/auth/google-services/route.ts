import { NextResponse } from "next/server"
import { google } from "googleapis"
import { getAuthSession } from "@/lib/auth-guard"

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google-services/callback`
)

export async function GET() {
    try {
        const session = await getAuthSession()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/calendar.events',
                'https://www.googleapis.com/auth/calendar.readonly',
                'https://www.googleapis.com/auth/analytics.readonly',
                'https://www.googleapis.com/auth/webmasters.readonly',
            ],
            prompt: 'consent',
            state: 'setup', // Used by callback to know where to redirect
        })

        return NextResponse.redirect(url)
    } catch (error) {
        console.error("Google Services OAuth init error:", error)
        return new NextResponse("Internal API Error", { status: 500 })
    }
}
