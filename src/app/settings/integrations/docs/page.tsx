import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { ApiDocs } from "../../api-keys/ApiDocs"

export const dynamic = "force-dynamic"

export default function ApiDocsPage() {
    return (
        <SettingsSubPage
            title="API reference"
            description="Endpoints, authentication, and example requests."
        >
            <ApiDocs />
        </SettingsSubPage>
    )
}
