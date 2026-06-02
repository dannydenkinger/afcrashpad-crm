import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { NotificationPreferences } from "../../NotificationPreferences"
import { SettingsSubPage } from "../../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

export default async function ProfileNotificationsPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")

    const usersSnap = await adminDb
        .collection("users")
        .where("email", "==", session.user.email)
        .limit(1)
        .get()
    if (usersSnap.empty) redirect("/login")
    const dbUser: any = usersSnap.docs[0].data()

    return (
        <SettingsSubPage
            title="Notifications"
            description="Pick what gets emailed and what pings the bell."
        >
            <NotificationPreferences initialPrefs={dbUser.notificationPreferences || null} />
        </SettingsSubPage>
    )
}
