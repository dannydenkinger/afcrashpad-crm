import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { CustomFieldsManager } from "../../custom-fields/CustomFieldsManager"

export const dynamic = "force-dynamic"

export default function FieldsPage() {
    return (
        <SettingsSubPage
            title="Custom fields"
            description="Add fields to contacts and opportunities — text, number, date, or single-select."
        >
            <CustomFieldsManager />
        </SettingsSubPage>
    )
}
