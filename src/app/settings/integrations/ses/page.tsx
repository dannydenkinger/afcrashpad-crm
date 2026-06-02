import { requireAdmin } from "@/lib/auth-guard"
import { getIdentity } from "@/lib/ses/identities"
import { getBalance } from "@/lib/credits/email-credits"
import { SesIntegrationCard } from "./SesIntegrationCard"
import { BackLink } from "@/components/ui/BackLink"

export default async function SesIntegrationPage() {
    const session = await requireAdmin()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const [identity, balance] = await Promise.all([
        getIdentity(workspaceId),
        getBalance(workspaceId),
    ])

    return (
        <div className="container mx-auto max-w-4xl py-10 px-4">
            <div className="mb-8">
                <BackLink href="/settings/integrations" label="Back to Integrations" />
                <h1 className="text-2xl font-semibold">Amazon SES</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Verify a sending domain so your workspace can deliver email marketing campaigns.
                </p>
            </div>
            <SesIntegrationCard initialIdentity={identity} initialBalance={balance} />
        </div>
    )
}
