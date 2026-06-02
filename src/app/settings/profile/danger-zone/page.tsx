import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { DangerZoneClient } from "./DangerZoneClient"
import { getMembershipState } from "./actions"

export const dynamic = "force-dynamic"

/**
 * Personal danger zone — leave workspace, transfer ownership, delete
 * account. Distinct from /settings/workspace/danger-zone which deletes
 * the *whole* workspace (owner-only).
 */
export default async function ProfileDangerZonePage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")

    const state = await getMembershipState()

    return (
        <SettingsSubPage
            title="Account & danger zone"
            description="Leave a workspace, hand off ownership, or permanently delete your account."
        >
            <DangerZoneClient initial={state} />
        </SettingsSubPage>
    )
}
