import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { Users, Shuffle, History } from "lucide-react"
import { SettingsSubPageLayout, type SubPageItem } from "../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

const TEAM_NAV: SubPageItem[] = [
    {
        slug: "members",
        label: "Members",
        description: "Active users and pending invites",
        icon: <Users className="w-4 h-4" />,
        accent: "blue",
    },
    {
        slug: "auto-assign",
        label: "Auto-assignment",
        description: "Route new leads to the right person",
        icon: <Shuffle className="w-4 h-4" />,
        accent: "emerald",
    },
    {
        slug: "audit",
        label: "Audit log",
        description: "Read-only history of who did what",
        icon: <History className="w-4 h-4" />,
        accent: "amber",
    },
]

export default async function TeamSettingsLayout({ children }: { children: React.ReactNode }) {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const role = (session.user as { role?: string }).role
    if (role !== "OWNER" && role !== "ADMIN") redirect("/settings")

    return (
        <SettingsSubPageLayout
            basePath="/settings/team"
            areaTitle="Team"
            areaDescription="Members, role-based access, lead routing, and audit trail."
            items={TEAM_NAV}
        >
            {children}
        </SettingsSubPageLayout>
    )
}
