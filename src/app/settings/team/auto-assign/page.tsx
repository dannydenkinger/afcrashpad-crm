import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { AutoAssignRules } from "../../assignment/AutoAssignRules"
import { SettingsSubPage } from "../../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

export default async function TeamAutoAssignPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const membersSnap = await adminDb
        .collection("workspace_members")
        .where("workspaceId", "==", workspaceId)
        .where("status", "==", "active")
        .get()
    const memberRoles = new Map<string, string>()
    membersSnap.docs.forEach((doc) => {
        const d = doc.data()
        memberRoles.set(d.userId, d.role || "AGENT")
    })
    const userIds = Array.from(memberRoles.keys())
    const userDocs =
        userIds.length > 0
            ? await Promise.all(userIds.map((id) => adminDb.collection("users").doc(id).get()))
            : []
    const users = userDocs
        .filter((doc) => doc.exists)
        .map((doc) => {
            const d = doc.data()!
            return {
                id: doc.id,
                name: d.name || null,
                email: d.email || "",
                role: memberRoles.get(doc.id) || "AGENT",
            }
        })

    return (
        <SettingsSubPage
            title="Auto-assignment"
            description="Automatically route new leads to the right team member."
        >
            <AutoAssignRules users={users as any} />
        </SettingsSubPage>
    )
}
