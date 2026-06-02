import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { StatusManager } from "../../system-properties/StatusManager"

export const dynamic = "force-dynamic"

export default function StatusesPage() {
    return (
        <SettingsSubPage
            title="Custom statuses"
            description="Status labels surfaced across the app — Lead, Active Client, Past Client, and any custom values you add."
        >
            <StatusManager />
        </SettingsSubPage>
    )
}
