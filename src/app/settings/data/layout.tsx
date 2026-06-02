import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { Upload, Download, Archive } from "lucide-react"
import { SettingsSubPageLayout, type SubPageItem } from "../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

const DATA_NAV: SubPageItem[] = [
    {
        slug: "import",
        label: "Import",
        description: "Upload CSVs into Vesta",
        icon: <Upload className="w-4 h-4" />,
        accent: "emerald",
    },
    {
        slug: "export-csv",
        label: "CSV exports",
        description: "Quick exports per entity",
        icon: <Download className="w-4 h-4" />,
        accent: "blue",
    },
    {
        slug: "backup",
        label: "Full backup",
        description: "Download workspace as JSON",
        icon: <Archive className="w-4 h-4" />,
        accent: "violet",
    },
]

export default async function DataSettingsLayout({ children }: { children: React.ReactNode }) {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const role = (session.user as { role?: string }).role
    if (role !== "OWNER" && role !== "ADMIN") redirect("/settings")

    return (
        <SettingsSubPageLayout
            basePath="/settings/data"
            areaTitle="Data import & export"
            areaDescription="Move data into and out of Vesta — CSV imports, CSV exports, and full JSON backups."
            items={DATA_NAV}
        >
            {children}
        </SettingsSubPageLayout>
    )
}
