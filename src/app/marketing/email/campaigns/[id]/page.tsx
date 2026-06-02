import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth-guard"
import {
    getCampaign,
    getCampaignEngagementTimeline,
    getCampaignLinkBreakdown,
} from "@/lib/campaigns/campaigns"
import { getBalance } from "@/lib/credits/email-credits"
import { getIdentity } from "@/lib/ses/identities"
import { adminDb } from "@/lib/firebase-admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CampaignActions } from "./CampaignActions"
import { PerformanceDashboard } from "./PerformanceDashboard"
import { EmailPreview } from "@/components/email/EmailPreview"
import { BackLink } from "@/components/ui/BackLink"

export const dynamic = "force-dynamic"

function statusBadge(status: string) {
    const map: Record<string, { label: string; className: string }> = {
        draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
        scheduled: { label: "Scheduled", className: "bg-blue-500/10 text-blue-600" },
        sending: { label: "Sending…", className: "bg-amber-500/10 text-amber-600" },
        sent: { label: "Sent", className: "bg-emerald-500/10 text-emerald-600" },
        sent_with_errors: {
            label: "Sent (with errors)",
            className: "bg-yellow-500/10 text-yellow-700",
        },
        failed: { label: "Failed", className: "bg-red-500/10 text-red-600" },
        canceled: { label: "Canceled", className: "bg-muted text-muted-foreground" },
    }
    const v = map[status] ?? { label: status, className: "bg-muted" }
    return <Badge className={v.className}>{v.label}</Badge>
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function CampaignDetailPage({ params }: PageProps) {
    const { id } = await params
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const campaign = await getCampaign(workspaceId, id)
    if (!campaign) notFound()

    const [balance, identity, timeline, links] = await Promise.all([
        getBalance(workspaceId),
        getIdentity(workspaceId),
        getCampaignEngagementTimeline(workspaceId, id),
        getCampaignLinkBreakdown(workspaceId, id),
    ])
    const sesReady = identity?.status === "VERIFIED"

    // Resolve list names + exclude-list names for the Audience card
    const listIds = new Set<string>()
    if (campaign.audienceType === "by_list") {
        for (const lid of campaign.audienceValue ?? []) listIds.add(lid)
    }
    for (const lid of campaign.excludeListIds ?? []) listIds.add(lid)
    let listNamesById: Record<string, string> = {}
    if (listIds.size > 0) {
        const ids = [...listIds]
        const chunks: string[][] = []
        for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
        const snaps = await Promise.all(
            chunks.map((chunk) =>
                adminDb
                    .collection("contact_lists")
                    .where("workspaceId", "==", workspaceId)
                    .where("__name__", "in", chunk)
                    .get(),
            ),
        )
        listNamesById = Object.fromEntries(
            snaps
                .flatMap((s) => s.docs)
                .map((d) => [d.id, (d.data().name as string) ?? d.id]),
        )
    }
    const includeListNames = (campaign.audienceValue ?? []).map(
        (lid) => listNamesById[lid] ?? lid,
    )
    const excludeListNames = (campaign.excludeListIds ?? []).map(
        (lid) => listNamesById[lid] ?? lid,
    )

    // Pull recent email logs for delivery table + top-engaged leaderboard
    const logsSnap = await adminDb
        .collection("email_logs")
        .where("workspaceId", "==", workspaceId)
        .where("campaignId", "==", id)
        .orderBy("sentAt", "desc")
        .limit(200)
        .get()

    const allLogs = logsSnap.docs.map((d) => {
        const data = d.data()
        return {
            id: d.id,
            to: data.to as string,
            status: data.status as string,
            messageId: (data.messageId as string) ?? null,
            errorMessage: (data.errorMessage as string) ?? null,
            sentAt: data.sentAt?.toDate?.()?.toISOString?.() ?? null,
            openedAt: data.openedAt?.toDate?.()?.toISOString?.() ?? null,
            clickedAt: data.clickedAt?.toDate?.()?.toISOString?.() ?? null,
            bouncedAt: data.bouncedAt?.toDate?.()?.toISOString?.() ?? null,
            clickCount: (data.clickCount as number) ?? 0,
            contactId: (data.contactId as string) ?? null,
        }
    })

    // First 50 for the delivery list
    const logs = allLogs.slice(0, 50)

    // Aggregate engagement signals from the full 200 batch (campaign.stats is
    // the source of truth for big sends, but tracked engagement comes after)
    const opened = allLogs.filter((l) => !!l.openedAt).length
    const clicked = allLogs.filter((l) => !!l.clickedAt).length
    const bounced = allLogs.filter((l) => !!l.bouncedAt || l.status === "bounced").length

    // Build top-engaged leaderboard
    const topEngaged = allLogs
        .filter((l) => l.openedAt || l.clickedAt)
        .sort((a, b) => {
            const aScore = (a.clickCount ?? 0) * 10 + (a.openedAt ? 1 : 0)
            const bScore = (b.clickCount ?? 0) * 10 + (b.openedAt ? 1 : 0)
            return bScore - aScore
        })
        .slice(0, 10)
        .map((l) => ({
            email: l.to,
            openedAt: l.openedAt,
            clickedAt: l.clickedAt,
            clickCount: l.clickCount,
        }))

    const sent = campaign.stats.sent || 0
    const isSentLike =
        campaign.status === "sent" || campaign.status === "sent_with_errors"

    return (
        <div className="container mx-auto max-w-6xl py-10 px-4 space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                    <BackLink href="/marketing/email" label="Back to Email marketing" />
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-semibold truncate">{campaign.name}</h1>
                        {statusBadge(campaign.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                        {campaign.subject}
                    </p>
                </div>
                <CampaignActions
                    campaignId={campaign.id}
                    status={campaign.status}
                    canSend={sesReady}
                    canEdit={campaign.status === "draft"}
                />
            </div>

            {/* Performance dashboard — only meaningful once we have stats */}
            {(isSentLike || sent > 0) && (
                <PerformanceDashboard
                    targeted={campaign.stats.targeted}
                    sent={campaign.stats.sent}
                    failed={campaign.stats.failed}
                    opened={opened}
                    clicked={clicked}
                    bounced={bounced}
                    timeline={timeline}
                    links={links}
                    topEngaged={topEngaged}
                />
            )}

            {/* Pre-send overview for drafts/scheduled */}
            {!isSentLike && sent === 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Targeted" value={campaign.stats.targeted} />
                    <StatCard label="Sent" value={campaign.stats.sent} tone="success" />
                    <StatCard label="Failed" value={campaign.stats.failed} tone="danger" />
                    <StatCard label="Credits left" value={balance} />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Audience</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        {campaign.audienceType === "all_contacts" && (
                            <div>All contacts with an email address</div>
                        )}
                        {campaign.audienceType === "by_tag" && (
                            <div>
                                Contacts tagged{" "}
                                <span className="font-medium">
                                    {(campaign.audienceValue ?? []).join(", ") || "(none)"}
                                </span>
                            </div>
                        )}
                        {campaign.audienceType === "by_list" && (
                            <div>
                                Contacts in{" "}
                                <span className="font-medium">
                                    {includeListNames.join(", ") || "(no lists selected)"}
                                </span>
                            </div>
                        )}
                        {campaign.audienceType === "by_ids" && (
                            <div>
                                {(campaign.audienceValue ?? []).length} specific contacts
                            </div>
                        )}
                        {excludeListNames.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                                Excluding contacts in{" "}
                                <span className="font-medium">{excludeListNames.join(", ")}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <EmailPreview html={campaign.renderedHtml} height={420} />
                    </CardContent>
                </Card>
            </div>

            {logs.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Delivery log</CardTitle>
                            <span className="text-xs text-muted-foreground tabular-nums">
                                Showing {logs.length} of {allLogs.length >= 200 ? "200+" : campaign.stats.targeted}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="divide-y">
                        {logs.map((log) => (
                            <div
                                key={log.id}
                                className="py-2 flex items-center justify-between text-sm"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span
                                        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                                            log.status === "bounced"
                                                ? "bg-red-500"
                                                : log.status === "failed"
                                                  ? "bg-red-500"
                                                  : log.status === "complained"
                                                    ? "bg-orange-500"
                                                    : log.clickedAt
                                                      ? "bg-violet-500"
                                                      : log.openedAt
                                                        ? "bg-blue-500"
                                                        : "bg-emerald-500"
                                        }`}
                                    />
                                    <span className="truncate">{log.to}</span>
                                    {log.openedAt && (
                                        <span className="text-[10px] uppercase text-blue-600 font-medium tracking-wider shrink-0">
                                            opened
                                        </span>
                                    )}
                                    {log.clickedAt && (
                                        <span className="text-[10px] uppercase text-violet-700 font-medium tracking-wider shrink-0">
                                            clicked{log.clickCount > 1 ? ` ${log.clickCount}×` : ""}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground tabular-nums ml-4 shrink-0">
                                    {log.sentAt ? new Date(log.sentAt).toLocaleString() : "—"}
                                </div>
                            </div>
                        ))}
                        {allLogs.length >= 200 && (
                            <div className="pt-3 text-center text-xs text-muted-foreground">
                                Showing the most recent 200 deliveries.
                                Use exports for the full audit trail.
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
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
    tone?: "success" | "danger"
}) {
    const color =
        tone === "success"
            ? "text-emerald-600"
            : tone === "danger"
              ? "text-red-600"
              : ""
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
