import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { AIRoutingManager } from "../AIRoutingManager"

export const dynamic = "force-dynamic"

export default function AIRoutingPage() {
    return (
        <SettingsSubPage
            title="AI routing"
            description="Pick which AI provider and model handles each AI feature in Vesta."
        >
            <AIRoutingManager />
        </SettingsSubPage>
    )
}
