import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { OnboardingClient } from "./OnboardingClient"

export const dynamic = "force-dynamic"

export default function ProfileOnboardingPage() {
    return (
        <SettingsSubPage
            title="Onboarding"
            description="Re-run the welcome screen, restore the sidebar checklist, or bring back the page hints."
        >
            <OnboardingClient />
        </SettingsSubPage>
    )
}
