import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import {
    getAutomation,
    listRunsByAutomation,
} from "@/lib/automations/store"
import { listLists } from "@/lib/lists/contact-lists"
import { AutomationBuilder } from "../AutomationBuilder"

export const dynamic = "force-dynamic"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditAutomationPage({ params }: PageProps) {
    const { id } = await params
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const automation = await getAutomation(workspaceId, id)
    if (!automation) notFound()

    const [lists, tagsSnap, templatesSnap, runs, usersSnap] = await Promise.all([
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
        listRunsByAutomation(workspaceId, id, 25),
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
    const listSummaries = lists.map((l) => ({ id: l.id, name: l.name }))

    // Hydrate workspace members with their user names + emails
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    return (
        <AutomationBuilder
            mode="edit"
            initial={automation}
            lists={listSummaries}
            tags={tags}
            templates={templates}
            users={users}
            appUrl={appUrl}
            recentRuns={runs.map((r) => ({
                id: r.id,
                contactId: r.contactId,
                contactEmail: r.contactEmail,
                status: r.status,
                currentNodeIdx: r.currentNodeIdx,
                startedAt: r.startedAt,
                scheduledFor: r.scheduledFor,
                errorMessage: r.errorMessage,
            }))}
        />
    )
}
