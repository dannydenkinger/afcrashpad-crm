import { Users, Briefcase } from "lucide-react"
import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { DataTileCard, type DataTile } from "../DataTileCard"

export const dynamic = "force-dynamic"

const EXPORT_TILES: DataTile[] = [
    {
        href: "/contacts",
        Icon: Users,
        title: "Export contacts (CSV)",
        desc: "Open the contacts page and use the Export CSV button in the toolbar.",
        accent: "blue",
    },
    {
        href: "/pipeline",
        Icon: Briefcase,
        title: "Export opportunities (CSV)",
        desc: "Open the pipeline and use the Export action in the toolbar.",
        accent: "emerald",
    },
]

export default function DataExportCsvPage() {
    return (
        <SettingsSubPage
            title="CSV exports"
            description="Quick exports per entity. We jump you to the right page for the export action."
            flush
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EXPORT_TILES.map((t) => (
                    <DataTileCard key={t.href} {...t} kind="export" />
                ))}
            </div>
        </SettingsSubPage>
    )
}
