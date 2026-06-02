import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth-guard"
import { getCampaign } from "@/lib/campaigns/campaigns"
import { listTemplates } from "@/lib/campaigns/templates"
import { listLists } from "@/lib/lists/contact-lists"
import { getBalance } from "@/lib/credits/email-credits"
import { getIdentity } from "@/lib/ses/identities"
import { CampaignBuilder } from "../../../CampaignBuilder"
import { BackLink } from "@/components/ui/BackLink"

export const dynamic = "force-dynamic"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditCampaignPage({ params }: PageProps) {
    const { id } = await params
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const campaign = await getCampaign(workspaceId, id)
    if (!campaign) notFound()
    if (campaign.status !== "draft") {
        return (
            <div className="container mx-auto max-w-3xl py-10 px-4">
                <p>Only drafts can be edited. This campaign is <strong>{campaign.status}</strong>.</p>
            </div>
        )
    }

    const [templates, lists, balance, identity] = await Promise.all([
        listTemplates(workspaceId),
        listLists(workspaceId),
        getBalance(workspaceId),
        getIdentity(workspaceId),
    ])

    const allowedAudience: "all_contacts" | "by_tag" | "by_list" =
        campaign.audienceType === "by_tag"
            ? "by_tag"
            : campaign.audienceType === "by_list"
              ? "by_list"
              : "all_contacts"

    return (
        <div className="container mx-auto max-w-5xl py-10 px-4 space-y-6">
            <div>
                <BackLink href={`/marketing/email/campaigns/${id}`} label="Back to campaign" />
                <h1 className="text-2xl font-semibold">Edit campaign</h1>
            </div>
            <CampaignBuilder
                initialCampaign={{
                    id: campaign.id,
                    name: campaign.name,
                    subject: campaign.subject,
                    templateId: campaign.templateId,
                    renderedHtml: campaign.renderedHtml,
                    audienceType: allowedAudience,
                    audienceValue: campaign.audienceValue,
                    excludeListIds: campaign.excludeListIds ?? null,
                    abTest: campaign.abTest ?? null,
                    scheduledAt: campaign.scheduledAt ?? null,
                }}
                templates={templates.map((t) => ({
                    id: t.id,
                    name: t.name,
                    subject: t.subject,
                    renderedHtml: t.renderedHtml,
                }))}
                lists={lists.map((l) => ({
                    id: l.id,
                    name: l.name,
                    contactCount: l.contactCount,
                }))}
                balance={balance}
                sesReady={identity?.status === "VERIFIED"}
            />
        </div>
    )
}
