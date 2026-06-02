import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { WebsiteFormEmbed } from "../../api-keys/WebsiteFormEmbed"

export const dynamic = "force-dynamic"

export default function EmbedPage() {
    return (
        <SettingsSubPage
            title="Website form embed"
            description="Drop-in HTML snippet to capture leads from your marketing site."
        >
            <WebsiteFormEmbed />
        </SettingsSubPage>
    )
}
