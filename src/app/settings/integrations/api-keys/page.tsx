import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { ApiKeyManager } from "../../api-keys/ApiKeyManager"
import { PlanLocked } from "@/components/PlanLocked"
import { getAuthSession } from "@/lib/auth-guard"
import { getWorkspacePlan } from "@/lib/billing/plans-server"
import { meetsPlan } from "@/lib/billing/plans"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ApiKeysPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const plan = await getWorkspacePlan(workspaceId)

    return (
        <SettingsSubPage
            title="API keys"
            description="Generate keys to talk to Vesta from your own code or third-party tools."
        >
            {meetsPlan(plan.tier, "pro") ? (
                <ApiKeyManager />
            ) : (
                <PlanLocked
                    feature="REST API access"
                    requiredTier="pro"
                    currentTier={plan.tier}
                />
            )}
        </SettingsSubPage>
    )
}
