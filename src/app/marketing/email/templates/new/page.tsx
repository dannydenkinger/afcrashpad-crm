import { requireAuth } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { STARTER_TEMPLATES } from "@/lib/campaigns/starter-templates"
import { applyBrandingToStarters } from "@/lib/campaigns/branding-substitution"
import { getBrandingSettings } from "@/app/settings/branding/actions"
import { TemplateEditor } from "../TemplateEditor"

export const dynamic = "force-dynamic"

interface PageProps {
    searchParams: Promise<{ starter?: string }>
}

export default async function NewTemplatePage({ searchParams }: PageProps) {
    const session = await requireAuth()
    const user = session.user as { workspaceId: string }

    const [wsDoc, branding] = await Promise.all([
        adminDb.collection("workspaces").doc(user.workspaceId).get(),
        getBrandingSettings(),
    ])
    const workspaceName = (wsDoc.data()?.name as string) || undefined
    // Substitute the workspace's brand colors / font / footer into every
    // starter so the editor opens on-brand.
    const brandedStarters = applyBrandingToStarters(STARTER_TEMPLATES, branding)

    const { starter: starterSlug } = await searchParams
    const preselectedStarter = starterSlug
        ? brandedStarters.find((s) => s.slug === starterSlug)
        : undefined

    return (
        <TemplateEditor
            starterTemplates={brandedStarters}
            preselectedStarter={preselectedStarter}
            workspaceName={workspaceName}
        />
    )
}
