import { requireAdmin } from "@/lib/auth-guard"
import { getConnection } from "@/lib/zernio/sub-accounts"
import { isZernioConfigured } from "@/lib/zernio/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { ZernioIntegrationCard } from "./ZernioIntegrationCard"
import { BackLink } from "@/components/ui/BackLink"

export const dynamic = "force-dynamic"

interface Props {
    searchParams: Promise<{ connected?: string; error?: string }>
}

export default async function ZernioIntegrationPage({ searchParams }: Props) {
    const session = await requireAdmin()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const { connected, error } = await searchParams

    const [connection, configured] = await Promise.all([
        getConnection(workspaceId),
        Promise.resolve(isZernioConfigured()),
    ])

    return (
        <div className="container mx-auto max-w-4xl py-10 px-4 space-y-6">
            <div>
                <BackLink href="/settings/integrations" label="Back to Integrations" />
                <h1 className="text-2xl font-semibold">Zernio (Social Planner)</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Connect your workspace&apos;s social accounts via Zernio so you can schedule
                    posts from the Social Planner.
                </p>
            </div>

            {!configured && (
                <Card className="border-amber-500/40 bg-amber-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            Zernio is not configured on the server
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                        <p>Set these env vars in <code>.env.local</code> and restart:</p>
                        <pre className="text-xs bg-muted p-3 rounded">
{`ZERNIO_API_KEY=your-platform-api-key
ZERNIO_WEBHOOK_SECRET=hmac-shared-secret
# Optional:
# ZERNIO_BASE_URL=https://api.zernio.com`}
                        </pre>
                        <p>
                            In your Zernio dashboard, point the webhook to{" "}
                            <code>{"{NEXT_PUBLIC_APP_URL}/api/webhooks/zernio"}</code>.
                        </p>
                    </CardContent>
                </Card>
            )}

            {connected && (
                <Card className="border-emerald-500/40 bg-emerald-500/5">
                    <CardContent className="pt-6 text-sm text-emerald-700">
                        Social accounts connected successfully.
                    </CardContent>
                </Card>
            )}
            {error && (
                <Card className="border-red-500/40 bg-red-500/5">
                    <CardContent className="pt-6 text-sm text-red-700">
                        Connect failed: {error}
                    </CardContent>
                </Card>
            )}

            <ZernioIntegrationCard
                connection={connection}
                configured={configured}
            />
        </div>
    )
}
