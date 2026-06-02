import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { RequiredDocsManager } from "../../required-docs/RequiredDocsManager"

export const dynamic = "force-dynamic"

export default function RequiredDocsPage() {
    return (
        <SettingsSubPage
            title="Required documents"
            description="Paperwork checklist for every opportunity. Shows up on the Docs tab of each deal."
        >
            <RequiredDocsManager />
        </SettingsSubPage>
    )
}
