import { requireAuth } from "@/lib/auth-guard"
import { listTemplates } from "@/lib/campaigns/templates"
import { listLists } from "@/lib/lists/contact-lists"
import { getBalance } from "@/lib/credits/email-credits"
import { getIdentity } from "@/lib/ses/identities"
import { CampaignBuilder } from "../../CampaignBuilder"

export const dynamic = "force-dynamic"

export default async function NewCampaignPage() {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const [templates, lists, balance, identity] = await Promise.all([
        listTemplates(workspaceId),
        listLists(workspaceId),
        getBalance(workspaceId),
        getIdentity(workspaceId),
    ])

    return (
        <div className="container mx-auto max-w-5xl py-10 px-4 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">New campaign</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Pick a template or write HTML directly, target an audience, then save as a draft or send.
                </p>
            </div>
            <CampaignBuilder
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
