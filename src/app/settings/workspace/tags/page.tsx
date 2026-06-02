import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { TagManager } from "../../tags/TagManager"
import { LeadSourceManager } from "../../leadsources/LeadSourceManager"

export const dynamic = "force-dynamic"

export default function TagsPage() {
    return (
        <SettingsSubPage
            title="Tags & lead sources"
            description="Free-form labels you can attach to contacts, and the list of where new contacts come from."
        >
            <div className="space-y-8">
                <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Tags
                    </h3>
                    <TagManager />
                </div>
                <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Lead sources
                    </h3>
                    <LeadSourceManager />
                </div>
            </div>
        </SettingsSubPage>
    )
}
