import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { UserManagementTable } from "../../users/UserManagementTable"
import { SettingsSubPage } from "../../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

export default async function TeamMembersPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const usersSnap = await adminDb
        .collection("users")
        .where("email", "==", session.user.email)
        .limit(1)
        .get()
    if (usersSnap.empty) redirect("/login")
    const currentUserId = usersSnap.docs[0].id

    const db = tenantDb(workspaceId)
    const [membersSnap, invitationsSnap, workspaceDoc] = await Promise.all([
        adminDb
            .collection("workspace_members")
            .where("workspaceId", "==", workspaceId)
            .where("status", "==", "active")
            .get(),
        db.collection("workspace_invitations").where("status", "==", "pending").get(),
        adminDb.collection("workspaces").doc(workspaceId).get(),
    ])
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
            const ts = d.createdAt
            const createdAt = ts?.toDate
                ? ts.toDate().toISOString()
                : ts instanceof Date
                  ? ts.toISOString()
                  : ts || null
            return {
                id: doc.id,
                name: d.name || null,
                email: d.email || "",
                role: memberRoles.get(doc.id) || "AGENT",
                createdAt,
            }
        })

    const now = new Date()
    const pendingInvitations = invitationsSnap.docs.map((doc) => {
        const d = doc.data()
        const expiresAt = d.expiresAt?.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt)
        const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt)
        return {
            id: doc.id,
            email: d.email || "",
            role: d.role || "AGENT",
            token: d.token || "",
            status: expiresAt < now ? "expired" : "pending",
            invitedByName: d.invitedByName || "",
            createdAt: createdAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
        }
    })

    const workspaceName = workspaceDoc.exists
        ? workspaceDoc.data()?.name || "Workspace"
        : "Workspace"

    return (
        <SettingsSubPage
            title="Members"
            description={`Active users in ${workspaceName} and pending invitations.`}
        >
            <UserManagementTable
                initialUsers={users as any}
                currentUserId={currentUserId}
                pendingInvitations={pendingInvitations as any}
                workspaceId={workspaceId}
            />
        </SettingsSubPage>
    )
}
