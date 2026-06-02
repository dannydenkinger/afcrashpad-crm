import { requireAuth } from "@/lib/auth-guard"
import { listLists } from "@/lib/lists/contact-lists"
import { adminDb } from "@/lib/firebase-admin"
import { AutomationBuilder } from "../AutomationBuilder"

export const dynamic = "force-dynamic"

export default async function NewAutomationPage() {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const [lists, tagsSnap, templatesSnap, usersSnap] = await Promise.all([
        listLists(workspaceId),
        adminDb
            .collection("tags")
            .where("workspaceId", "==", workspaceId)
            .limit(200)
            .get(),
        adminDb
            .collection("email_templates")
            .where("workspaceId", "==", workspaceId)
            .orderBy("updatedAt", "desc")
            .limit(50)
            .get(),
        adminDb
            .collection("workspace_members")
            .where("workspaceId", "==", workspaceId)
            .where("status", "==", "active")
            .limit(100)
            .get(),
    ])

    const tags = tagsSnap.docs.map((d) => ({
        id: d.id,
        name: (d.data().name as string) ?? "(untitled)",
        color: (d.data().color as string) ?? "#94a3b8",
    }))
    const templates = templatesSnap.docs.map((d) => ({
        id: d.id,
        name: (d.data().name as string) ?? "(untitled)",
        subject: (d.data().subject as string) ?? "",
        renderedHtml: (d.data().renderedHtml as string) ?? "",
    }))
    const listSummaries = lists.map((l) => ({
        id: l.id,
        name: l.name,
    }))

    // Hydrate workspace members → users
    const userIds = usersSnap.docs
        .map((d) => (d.data().userId as string) || "")
        .filter(Boolean)
    const userDocs = userIds.length > 0
        ? await Promise.all(
              userIds.map((uid) => adminDb.collection("users").doc(uid).get()),
          )
        : []
    const users = userDocs
        .filter((d) => d.exists)
        .map((d) => ({
            id: d.id,
            name: (d.data()?.name as string) ?? "",
            email: (d.data()?.email as string) ?? "",
        }))

    return (
        <AutomationBuilder
            mode="create"
            lists={listSummaries}
            tags={tags}
            templates={templates}
            users={users}
        />
    )
}
