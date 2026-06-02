import { redirect } from "next/navigation"
import crypto from "crypto"
import { getAuthSession } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { ProfileForm } from "../../ProfileForm"
import { SettingsSubPage } from "../../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

export default async function ProfilePersonalPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")

    const usersSnap = await adminDb
        .collection("users")
        .where("email", "==", session.user.email)
        .limit(1)
        .get()
    if (usersSnap.empty) redirect("/login")
    const dbUser: any = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() }

    if (!dbUser.calendarFeedId) {
        const newFeedId = crypto.randomUUID()
        await adminDb.collection("users").doc(dbUser.id).update({ calendarFeedId: newFeedId })
        dbUser.calendarFeedId = newFeedId
    }

    return (
        <SettingsSubPage
            title="Personal info"
            description="Name, photo, phone — visible to your teammates."
        >
            <ProfileForm
                initialName={dbUser.name}
                initialPhone={dbUser.phone || ""}
                email={dbUser.email}
                role={dbUser.role}
                initialImageUrl={dbUser.profileImageUrl || null}
            />
        </SettingsSubPage>
    )
}
