import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { getTemplate } from "@/lib/campaigns/templates"
import { TemplateEditor } from "../TemplateEditor"

export const dynamic = "force-dynamic"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditTemplatePage({ params }: PageProps) {
    const { id } = await params
    const session = await requireAuth()
    const user = session.user as { workspaceId: string }

    const template = await getTemplate(user.workspaceId, id)
    if (!template) notFound()

    const wsDoc = await adminDb.collection("workspaces").doc(user.workspaceId).get()
    const workspaceName = (wsDoc.data()?.name as string) || undefined

    return (
        <TemplateEditor
            initial={{
                id: template.id,
                name: template.name,
                subject: template.subject,
                description: template.description,
                renderedHtml: template.renderedHtml,
                designJson: template.designJson,
            }}
            workspaceName={workspaceName}
        />
    )
}
