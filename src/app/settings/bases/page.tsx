import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { SettingsSubPageLayout, SettingsSubPage } from "../SettingsSubPageLayout"
import { WORKSPACE_NAV } from "../workspace/nav"
import { BasesManager } from "./BasesManager"

export const dynamic = "force-dynamic"

/**
 * Military Bases & Lodging admin. Lives at its own /settings/bases route but
 * renders inside the shared Workspace settings sidebar so it sits alongside
 * the other admin-only configuration pages. Admin-gated, same as the
 * Workspace layout.
 */
export default async function BasesSettingsPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const role = (session.user as { role?: string }).role
    if (role !== "OWNER" && role !== "ADMIN") redirect("/settings")

    return (
        <SettingsSubPageLayout
            basePath="/settings/workspace"
            areaTitle="Workspace"
            areaDescription="Pipeline, fields, tags, sources, statuses, bases, and booking — admin-only."
            items={WORKSPACE_NAV}
        >
            <SettingsSubPage
                title="Military bases & lodging"
                description="Bases available in the pipeline pickers, their zip codes, and seasonal lodging rate periods (start/end date and nightly rate)."
            >
                <BasesManager />
            </SettingsSubPage>
        </SettingsSubPageLayout>
    )
}
