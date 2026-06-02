import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { SnapshotPicker } from "../SnapshotPicker"

export const dynamic = "force-dynamic"

export default function TemplatePage() {
    return (
        <SettingsSubPage
            title="Industry template"
            description="Pick a preset that seeds pipelines, fields, and statuses tailored to your business. Apply is additive — nothing existing gets replaced."
        >
            <SnapshotPicker />
        </SettingsSubPage>
    )
}
