import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { StatusManager } from "../../system-properties/StatusManager"
import { SpecialAccommodationsManager } from "../../system-properties/SpecialAccommodationsManager"

export const dynamic = "force-dynamic"

export default function StatusesPage() {
    return (
        <div className="space-y-8">
            <SettingsSubPage
                title="Custom statuses"
                description="Status labels surfaced across the app — Lead, Active Client, Past Client, and any custom values you add."
            >
                <StatusManager />
            </SettingsSubPage>

            <SettingsSubPage
                title="Special accommodations"
                description="Accommodation options offered on opportunities (e.g. Pets, Spouse, Dependents). These power the picker on the Pipeline."
            >
                <SpecialAccommodationsManager />
            </SettingsSubPage>
        </div>
    )
}
