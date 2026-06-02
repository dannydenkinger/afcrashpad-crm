import { google } from "googleapis"
import { tenantDb } from "@/lib/tenant-db"

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.AUTH_URL // Redirect URI
)

export async function getGoogleCalendarClient(workspaceId: string, userId: string) {
    const db = tenantDb(workspaceId)

    // Look up the Google Provider account for this user
    const integrationSnap = await db.collection('calendar_integrations')
        .where('userId', '==', userId)
        .limit(1)
        .get()

    if (integrationSnap.empty) {
        throw new Error("No Google Refresh Token available")
    }

    const integration = integrationSnap.docs[0].data();

    if (!integration || !integration.refreshToken) {
        throw new Error("No Google Refresh Token available")
    }

    oauth2Client.setCredentials({
        refresh_token: integration.refreshToken,
        access_token: integration.accessToken,
        expiry_date: integration.expiresAt ? integration.expiresAt * 1000 : null
    })

    return google.calendar({ version: "v3", auth: oauth2Client })
}

export async function syncEventToGoogle(
    workspaceId: string,
    userId: string,
    eventDetails: { summary: string, description: string, dateStart: string, dateEnd?: string }
) {
    try {
        const calendar = await getGoogleCalendarClient(workspaceId, userId)

        const response = await calendar.events.insert({
            calendarId: "primary",
            requestBody: {
                summary: eventDetails.summary,
                description: eventDetails.description,
                start: {
                    date: eventDetails.dateStart,
                    timeZone: "America/Chicago"
                },
                end: {
                    date: eventDetails.dateEnd || eventDetails.dateStart,
                    timeZone: "America/Chicago"
                }
            }
        })

        return response.data
    } catch (error) {
        console.error("Failed to sync event to Google Calendar:", error)
        return null // Don't crash the main CRM flow if sync fails
    }
}
