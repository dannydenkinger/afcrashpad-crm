import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { WorkspaceIdentityForm } from "../WorkspaceIdentityForm"

export const dynamic = "force-dynamic"

export default function IdentityPage() {
    return (
        <SettingsSubPage
            title="Identity"
            description="Workspace name shown in the sidebar logo, sent emails, and the workspace switcher."
        >
            <WorkspaceIdentityForm />
        </SettingsSubPage>
    )
}
