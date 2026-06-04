import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { SettingsSubPageLayout } from "../SettingsSubPageLayout"
import { WORKSPACE_NAV } from "./nav"

export const dynamic = "force-dynamic"

/**
 * Workspace settings is structured as real sub-routes rather than a
 * single long page with anchor-scrolling. Each item in WORKSPACE_NAV (see
 * ./nav) is a separate page.tsx file under /settings/workspace/<slug>
 * (or, for href-override items, its own top-level route). This layout
 * renders the shared sidebar + auth check; the {children} slot fills in
 * the active sub-page's content.
 */
export default async function WorkspaceSettingsLayout({ children }: { children: React.ReactNode }) {
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
            {children}
        </SettingsSubPageLayout>
    )
}
