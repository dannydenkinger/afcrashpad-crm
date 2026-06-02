import { requireAuth } from "@/lib/auth-guard"
import { listSuppressions, countSuppressions } from "@/lib/email/suppressions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShieldAlert } from "lucide-react"
import { SuppressionsClient } from "./SuppressionsClient"
import { BackLink } from "@/components/ui/BackLink"

export const dynamic = "force-dynamic"

export default async function SuppressionsPage() {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const [entries, total] = await Promise.all([
        listSuppressions(workspaceId, { limit: 500 }),
        countSuppressions(workspaceId),
    ])

    const byReason: Record<string, number> = {
        bounce: 0,
        complaint: 0,
        unsubscribe: 0,
        manual: 0,
    }
    for (const e of entries) {
        byReason[e.reason] = (byReason[e.reason] ?? 0) + 1
    }

    return (
        <div className="container mx-auto max-w-5xl py-10 px-4 space-y-6">
            <div>
                <BackLink href="/marketing/email" label="Back to Email marketing" />
                <h1 className="text-2xl font-semibold">Suppression list</h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Addresses on this list will never receive email from your workspace.
                    Bounces and spam complaints from SES are added automatically;
                    one-click unsubscribes from your email footer go here too.
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total" value={total} />
                <StatCard label="Bounces" value={byReason.bounce} tone="danger" />
                <StatCard label="Complaints" value={byReason.complaint} tone="danger" />
                <StatCard label="Unsubscribes" value={byReason.unsubscribe} />
            </div>

            <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-3 flex items-start gap-3">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-700">
                        <strong>Why this matters:</strong> if you keep sending to addresses
                        that bounce or complain, AWS will throttle (or ban) your SES account.
                        This list is your safety net.
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base">Suppressed addresses</CardTitle>
                        <span className="text-xs text-muted-foreground tabular-nums">
                            Showing {entries.length} of {total.toLocaleString()}
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <SuppressionsClient initialEntries={entries} />
                    {total > entries.length && (
                        <p className="text-xs text-center text-muted-foreground pt-2 border-t">
                            Showing the most recent {entries.length} entries.
                            Search above or export the full list for audit.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function StatCard({
    label,
    value,
    tone,
}: {
    label: string
    value: number
    tone?: "danger"
}) {
    const color = tone === "danger" ? "text-red-600" : ""
    return (
        <Card>
            <CardContent className="py-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`text-2xl font-semibold tabular-nums ${color}`}>
                    {value.toLocaleString()}
                </div>
            </CardContent>
        </Card>
    )
}

// Re-export for convenience (pulls in shared shape from the lib).
export type { SuppressionEntry } from "@/lib/email/suppressions"

void Badge
