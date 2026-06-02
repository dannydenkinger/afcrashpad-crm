import Link from "next/link"
import { requireAuth } from "@/lib/auth-guard"
import { getConnection } from "@/lib/zernio/sub-accounts"
import { listPosts } from "@/lib/zernio/posts"
import { isZernioConfigured } from "@/lib/zernio/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { SocialPlanner } from "./SocialPlanner"

export const dynamic = "force-dynamic"

export default async function SocialPage() {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const [connection, posts] = await Promise.all([
        getConnection(workspaceId),
        listPosts(workspaceId, { limit: 500 }),
    ])

    const zernioConfigured = isZernioConfigured()
    const connected = !!connection?.zernioAccountId

    return (
        <div className="container mx-auto max-w-6xl py-10 px-4 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Social Planner</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Schedule posts across your connected social accounts. Published posts land on
                    each contact&apos;s timeline automatically.
                </p>
            </div>

            {!zernioConfigured && (
                <Card className="border-amber-500/40 bg-amber-500/5">
                    <CardContent className="pt-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm">
                            <div className="font-medium">Zernio is not configured on the server</div>
                            <p className="text-muted-foreground mt-1">
                                Set <code>ZERNIO_API_KEY</code> and <code>ZERNIO_WEBHOOK_SECRET</code>{" "}
                                in your server environment. Without these, connect-flow and post
                                scheduling are disabled.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {zernioConfigured && !connected && (
                <Card className="border-amber-500/40 bg-amber-500/5">
                    <CardContent className="pt-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm">
                            <div className="font-medium">No social accounts connected</div>
                            <p className="text-muted-foreground mt-1">
                                Link your workspace&apos;s social accounts via Zernio to start
                                scheduling.
                            </p>
                        </div>
                        <Link href="/settings/integrations/zernio">
                            <Button size="sm">Connect accounts</Button>
                        </Link>
                    </CardContent>
                </Card>
            )}

            <SocialPlanner
                posts={posts}
                canSchedule={zernioConfigured && connected}
                connectedAccounts={connection?.accounts ?? []}
            />
        </div>
    )
}
