import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { DangerZoneClient } from "./DangerZoneClient"

export const dynamic = "force-dynamic"

/**
 * Owner-only deletion flow with a 30-day grace period. Sits in the
 * workspace settings sidebar separated from the operational settings
 * so it doesn't get clicked by accident.
 */
export default async function DangerZonePage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    if (session.user.role !== "OWNER") redirect("/settings/workspace")

    return (
        <SettingsSubPage
            title="Danger zone"
            description="Permanently deleting a workspace cannot be undone after the 30-day grace period. Export your data first."
        >
            <DangerZoneClient />
        </SettingsSubPage>
    )
}
