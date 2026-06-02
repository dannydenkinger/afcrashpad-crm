import { DataExport } from "../DataExport"
import { SettingsSubPage } from "../../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

export default function DataBackupPage() {
    return (
        <SettingsSubPage
            title="Full backup (JSON)"
            description="Download your entire workspace as a single JSON file. Useful for archives or migrations."
        >
            <DataExport />
        </SettingsSubPage>
    )
}
