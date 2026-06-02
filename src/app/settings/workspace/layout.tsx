import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import {
    BadgeCheck, Layers, Sparkles, GitBranch, Boxes, FileCheck, Tag, Activity, Calendar, ShieldAlert, ShieldCheck,
} from "lucide-react"
import { SettingsSubPageLayout, type SubPageItem } from "../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

/**
 * Workspace settings is now structured as real sub-routes rather than a
 * single long page with anchor-scrolling. Each item in WORKSPACE_NAV is
 * a separate page.tsx file under /settings/workspace/<slug>. This layout
 * renders the shared sidebar + auth check; the {children} slot fills in
 * the active sub-page's content.
 */
const WORKSPACE_NAV: SubPageItem[] = [
    {
        slug: "identity",
        label: "Identity",
        description: "Workspace name",
        icon: <BadgeCheck className="w-4 h-4" />,
        accent: "blue",
    },
    {
        slug: "template",
        label: "Industry template",
        description: "Pipelines, fields, statuses by industry",
        icon: <Layers className="w-4 h-4" />,
        accent: "violet",
    },
    {
        slug: "sample-data",
        label: "Sample data",
        description: "Demo dataset for trying out the CRM",
        icon: <Sparkles className="w-4 h-4" />,
        accent: "amber",
    },
    {
        slug: "pipeline",
        label: "Pipeline",
        description: "Stages, probabilities, defaults",
        icon: <GitBranch className="w-4 h-4" />,
        accent: "emerald",
    },
    {
        slug: "fields",
        label: "Custom fields",
        description: "Contacts + opportunities",
        icon: <Boxes className="w-4 h-4" />,
        accent: "sky",
    },
    {
        slug: "required-docs",
        label: "Required docs",
        description: "Per-deal paperwork checklist",
        icon: <FileCheck className="w-4 h-4" />,
        accent: "rose",
    },
    {
        slug: "tags",
        label: "Tags & lead sources",
        description: "Labels and where contacts come from",
        icon: <Tag className="w-4 h-4" />,
        accent: "violet",
    },
    {
        slug: "statuses",
        label: "Custom statuses",
        description: "Lifecycle labels",
        icon: <Activity className="w-4 h-4" />,
        accent: "emerald",
    },
    {
        slug: "booking",
        label: "Booking page",
        description: "Public scheduling link",
        icon: <Calendar className="w-4 h-4" />,
        accent: "amber",
    },
    {
        slug: "support-access",
        label: "Support access",
        description: "Grant Vesta support a time-bound login",
        icon: <ShieldCheck className="w-4 h-4" />,
        accent: "violet",
    },
    {
        slug: "danger-zone",
        label: "Danger zone",
        description: "Delete workspace (owner only)",
        icon: <ShieldAlert className="w-4 h-4" />,
        accent: "rose",
    },
]

export default async function WorkspaceSettingsLayout({ children }: { children: React.ReactNode }) {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const role = (session.user as { role?: string }).role
    if (role !== "OWNER" && role !== "ADMIN") redirect("/settings")

    return (
        <SettingsSubPageLayout
            basePath="/settings/workspace"
            areaTitle="Workspace"
            areaDescription="Pipeline, fields, tags, sources, statuses, and booking — admin-only."
            items={WORKSPACE_NAV}
        >
            {children}
        </SettingsSubPageLayout>
    )
}
