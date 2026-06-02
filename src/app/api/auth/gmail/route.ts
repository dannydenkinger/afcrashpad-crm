import { NextResponse } from "next/server"
import { google } from "googleapis"
import { getAuthSession } from "@/lib/auth-guard"

/**
 * Starts the Gmail OAuth handshake. Used by the "Connect Gmail" button on
 * the Integrations page. We deliberately request Gmail scopes here rather
 * than at sign-in — it gives the user a real opt-in moment and keeps the
 * sign-in consent screen down to basic identity scopes.
 *
 * `prompt: "consent"` forces Google to issue a fresh refresh_token even if
 * the user previously granted these scopes; otherwise Gmail's own token
 * may go stale and we'd silently lose send/receive ability.
 */
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/gmail/callback`,
)

export async function GET() {
    try {
        const session = await getAuthSession()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        const url = oauth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: [
                "https://www.googleapis.com/auth/gmail.send",
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/gmail.modify",
            ],
        })
        return NextResponse.redirect(url)
    } catch (error) {
        console.error("Gmail OAuth init error:", error)
        return new NextResponse("Internal API Error", { status: 500 })
    }
}
