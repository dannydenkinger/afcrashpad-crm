import { AuditLogViewer } from "../../audit/AuditLogViewer"
import { SettingsSubPage } from "../../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

export default function TeamAuditPage() {
    return (
        <SettingsSubPage
            title="Audit log"
            description="Read-only history of who did what, when."
        >
            <AuditLogViewer />
        </SettingsSubPage>
    )
}
