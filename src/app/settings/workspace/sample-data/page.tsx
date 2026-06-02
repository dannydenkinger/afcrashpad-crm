import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { SampleDataControls } from "../SampleDataControls"

export const dynamic = "force-dynamic"

export default function SampleDataPage() {
    return (
        <SettingsSubPage
            title="Sample data"
            description="Populate or wipe the demo dataset for trying out the CRM."
        >
            <SampleDataControls />
        </SettingsSubPage>
    )
}
