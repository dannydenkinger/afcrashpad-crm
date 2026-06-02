import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { WebhooksManager } from "../../webhooks/WebhooksManager"
import { PlanLocked } from "@/components/PlanLocked"
import { getAuthSession } from "@/lib/auth-guard"
import { getWorkspacePlan } from "@/lib/billing/plans-server"
import { meetsPlan } from "@/lib/billing/plans"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function WebhooksPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const plan = await getWorkspacePlan(workspaceId)

    return (
        <SettingsSubPage
            title="Webhooks"
            description="POST CRM events to your own systems — Vesta JSON or Slack format."
        >
            {meetsPlan(plan.tier, "pro") ? (
                <WebhooksManager />
            ) : (
                <PlanLocked
                    feature="Webhooks"
                    requiredTier="pro"
                    currentTier={plan.tier}
                />
            )}
        </SettingsSubPage>
    )
}
