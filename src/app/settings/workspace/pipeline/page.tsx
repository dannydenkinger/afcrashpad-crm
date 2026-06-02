import { SettingsSubPage } from "../../SettingsSubPageLayout"
import { StageProbabilityEditor } from "../../pipeline/StageProbabilityEditor"
import { StageManagementEditor } from "../../pipeline/StageManagementEditor"
import { DefaultMarginForm } from "../../pipeline/DefaultMarginForm"
import { PipelinePrioritySettings } from "../../pipeline/PipelinePrioritySettings"

export const dynamic = "force-dynamic"

/**
 * Pipeline configuration is the only workspace section with multiple
 * sub-managers. Rather than nest sub-pages further, render them as
 * stacked subsections on this single page — they're all about deal
 * forecast math and customers usually want to see them together.
 */
export default function PipelinePage() {
    return (
        <SettingsSubPage
            title="Pipeline configuration"
            description="Stage probabilities, deal forecast defaults, staleness thresholds, and priority colors."
        >
            <div className="space-y-8">
                <SubBlock title="Stage probabilities">
                    <StageProbabilityEditor />
                </SubBlock>
                <SubBlock title="Stage order & staleness">
                    <StageManagementEditor />
                </SubBlock>
                <SubBlock title="Default profit margin">
                    <DefaultMarginForm />
                </SubBlock>
                <SubBlock title="Priority date ranges">
                    <PipelinePrioritySettings />
                </SubBlock>
            </div>
        </SettingsSubPage>
    )
}

function SubBlock({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {title}
            </h3>
            {children}
        </div>
    )
}
