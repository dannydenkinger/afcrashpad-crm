import Link from "next/link"
import { requireAuth } from "@/lib/auth-guard"
import { listTemplates } from "@/lib/campaigns/templates"
import { STARTER_TEMPLATES } from "@/lib/campaigns/starter-templates"
import { applyBrandingToStarters } from "@/lib/campaigns/branding-substitution"
import { getBrandingSettings } from "@/app/settings/branding/actions"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TemplatesGallery } from "./TemplatesGallery"
import { BackLink } from "@/components/ui/BackLink"

export const dynamic = "force-dynamic"

export default async function TemplatesListPage() {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const [templates, branding] = await Promise.all([
        listTemplates(workspaceId),
        getBrandingSettings(),
    ])
    const brandedStarters = applyBrandingToStarters(STARTER_TEMPLATES, branding)

    return (
        <div className="container mx-auto max-w-6xl py-10 px-4 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <BackLink href="/marketing/email" label="Back to Email marketing" />
                    <h1 className="text-2xl font-semibold">Templates</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Reusable email designs. Pick one when creating a campaign.
                    </p>
                </div>
                <Link href="/marketing/email/templates/new">
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        New template
                    </Button>
                </Link>
            </div>

            <TemplatesGallery
                templates={templates.map((t) => ({
                    id: t.id,
                    name: t.name,
                    subject: t.subject,
                    description: t.description,
                    renderedHtml: t.renderedHtml,
                    updatedAt: t.updatedAt,
                }))}
                starters={brandedStarters.map((s) => ({
                    slug: s.slug,
                    name: s.name,
                    subject: s.subject,
                    description: s.description,
                    category: s.category ?? "Other",
                    renderedHtml: s.renderedHtml,
                }))}
            />
        </div>
    )
}
