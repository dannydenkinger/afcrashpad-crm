import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { BrandingSettings } from "./BrandingSettings"
import { PlanLocked } from "@/components/PlanLocked"
import { getWorkspacePlan } from "@/lib/billing/plans-server"
import { meetsPlan } from "@/lib/billing/plans"

export const dynamic = "force-dynamic"

export default async function BrandingSettingsPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const role = (session.user as { role?: string }).role
    if (role !== "OWNER" && role !== "ADMIN") redirect("/settings")

    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const plan = await getWorkspacePlan(workspaceId)

    return (
        <div className="container mx-auto max-w-3xl py-6 px-4">
            <div className="pb-4 border-b mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Logo, colors, typography, and the metadata your marketing emails legally need.
                </p>
            </div>
            {!meetsPlan(plan.tier, "pro") ? (
                <PlanLocked
                    feature="Workspace branding"
                    requiredTier="pro"
                    currentTier={plan.tier}
                />
            ) : (
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <BrandingSettings />
                </div>
            )}
        </div>
    )
}
