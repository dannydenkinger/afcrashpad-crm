import { Users, Briefcase, Mail, Ban } from "lucide-react"
import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { DataTileCard, type DataTile } from "../DataTileCard"

export const dynamic = "force-dynamic"

const IMPORT_TILES: DataTile[] = [
    {
        href: "/contacts?import=1",
        Icon: Users,
        title: "Import contacts",
        desc: "Upload a CSV — we'll auto-map columns to name, email, phone, etc.",
        accent: "blue",
    },
    {
        href: "/pipeline?import=1",
        Icon: Briefcase,
        title: "Import opportunities",
        desc: "Bulk-create deals from a CSV. Stage and pipeline can be pre-set.",
        accent: "emerald",
    },
    {
        href: "/marketing/email/lists",
        Icon: Mail,
        title: "Import email list",
        desc: "Add subscribers from CSV to a marketing list. Optionally creates contacts.",
        accent: "violet",
    },
    {
        href: "/marketing/email/suppressions",
        Icon: Ban,
        title: "Import suppressions",
        desc: "Add bounces, complaints, or manual unsubs in bulk.",
        accent: "rose",
    },
]

export default function DataImportPage() {
    return (
        <SettingsSubPage
            title="Import"
            description="Upload CSVs to bring data into Vesta. We jump you to the right page for each entity."
            flush
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {IMPORT_TILES.map((t) => (
                    <DataTileCard key={t.href} {...t} kind="import" />
                ))}
            </div>
        </SettingsSubPage>
    )
}
