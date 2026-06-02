import crypto from "crypto"
import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { IntegrationsTab } from "../../IntegrationsTab"
import { SettingsSubPage } from "../../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

export default async function IntegrationsServicesPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")

    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const userEmail = session.user.email

    const usersSnap = await adminDb
        .collection("users")
        .where("email", "==", userEmail)
        .limit(1)
        .get()
    if (usersSnap.empty) redirect("/login")
    const dbUser: any = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() }
    if (!dbUser.calendarFeedId) {
        const newFeedId = crypto.randomUUID()
        await adminDb.collection("users").doc(dbUser.id).update({ calendarFeedId: newFeedId })
        dbUser.calendarFeedId = newFeedId
    }

    const calIntSnap = await adminDb
        .collection("calendar_integrations")
        .where("userId", "==", dbUser.id)
        .limit(1)
        .get()
    const calendarConnected = !calIntSnap.empty
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const icsFeedUrl = `${baseUrl}/api/calendar/feed/${dbUser.calendarFeedId}`

    const db = tenantDb(workspaceId)
    const integrationsDoc = await db.settingsDoc("integrations").get()
    const intData = integrationsDoc.exists ? integrationsDoc.data() : null

    const gmailDocId = `${workspaceId}_${dbUser.id}`
    const gmailDoc = await adminDb.collection("gmail_integrations").doc(gmailDocId).get()
    const gmailConnected = gmailDoc.exists && !!gmailDoc.data()?.refreshToken

    const zernioSnap = await adminDb
        .collection("social_connections")
        .where("workspaceId", "==", workspaceId)
        .limit(1)
        .get()
    const zernioConnected =
        !zernioSnap.empty && !!zernioSnap.docs[0].data()?.zernioAccountId
    const zernioAccountCount = zernioSnap.empty
        ? 0
        : zernioSnap.docs[0].data()?.accounts?.length || 0

    const wsDoc = await adminDb.collection("workspaces").doc(workspaceId).get()
    const twilio =
        (wsDoc.data()?.twilio as
            | { accountSid?: string; authToken?: string; fromNumber?: string }
            | undefined) ?? {}
    const twilioConnected = !!twilio.accountSid && !!twilio.authToken && !!twilio.fromNumber

    const integrationStatus = {
        google: {
            connected: !!intData?.google?.refreshToken,
            ga4PropertyId: intData?.google?.ga4PropertyId || null,
            gscSiteUrl: intData?.google?.gscSiteUrl || null,
        },
        gmail: { connected: gmailConnected, email: gmailDoc.data()?.email || null },
        resend: { connected: !!intData?.resend?.apiKey },
        ses: {
            connected: intData?.ses?.status === "VERIFIED",
            status: (intData?.ses?.status as string) || null,
            identity: (intData?.ses?.identity as string) || null,
        },
        twilio: { connected: twilioConnected, fromNumber: twilio.fromNumber || null },
        zernio: { connected: zernioConnected, accountCount: zernioAccountCount as number },
        anthropic: { connected: !!intData?.anthropic?.apiKey },
        openai: { connected: !!intData?.openai?.apiKey },
        gemini: { connected: !!intData?.gemini?.apiKey },
        serper: { connected: !!intData?.serper?.apiKey },
        wordpress: {
            connected: !!intData?.wordpress?.url && !!intData?.wordpress?.appPassword,
        },
    }

    return (
        <SettingsSubPage
            title="Connected services"
            description="Email, calendar, SMS, social, AI providers, and your CMS — connect them once, use everywhere."
        >
            <IntegrationsTab
                calendarConnected={calendarConnected}
                icsFeedUrl={icsFeedUrl}
                integrationStatus={integrationStatus}
            />
        </SettingsSubPage>
    )
}
