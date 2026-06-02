import { notFound } from "next/navigation"
import Link from "next/link"
import {
    ArrowUpRight,
    Briefcase,
    CheckCircle2,
    Circle,
    Coins,
    ExternalLink,
    Mail,
    UserCircle,
    Users,
    Workflow,
} from "lucide-react"
import { getWorkspaceDetail } from "@/lib/admin/queries"
import { formatCents, formatDate, formatNumber, formatRelative } from "@/lib/admin/format"
import { healthBadge } from "../healthBadge"
import { OperatorActions } from "./OperatorActions"
import { listOperatorAuditForWorkspace } from "@/lib/admin/operator-audit"
import { adminDb } from "@/lib/firebase-admin"

export const dynamic = "force-dynamic"

export default async function WorkspaceDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const ws = await getWorkspaceDetail(id)
    if (!ws) notFound()

    const [wsRawDoc, operatorAudit] = await Promise.all([
        adminDb.collection("workspaces").doc(id).get(),
        listOperatorAuditForWorkspace(id, 30),
    ])
    const wsStatus = (wsRawDoc.data()?.status as string) || "active"
    const isSuspended = wsStatus === "suspended"
    const emailCreditBalance =
        typeof wsRawDoc.data()?.email_credit_balance === "number"
            ? (wsRawDoc.data()!.email_credit_balance as number)
            : 0

    const owner = ws.members.find((m) => m.userId === ws.ownerId)
    const otherMembers = ws.members.filter((m) => m.userId !== ws.ownerId)

    const capPct =
        ws.contactCap != null && ws.contactCap > 0
            ? (ws.contactCount / ws.contactCap) * 100
            : null

    const firstsRows: Array<{ label: string; at: string | null }> = [
        { label: "First contact", at: ws.firsts.contactCreatedAt },
        { label: "First deal", at: ws.firsts.dealCreatedAt },
        { label: "First email sent", at: ws.firsts.emailSentAt },
        { label: "First automation", at: ws.firsts.automationCreatedAt },
    ]

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                    <Link
                        href="/admin/workspaces"
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        ← back to workspaces
                    </Link>
                    <h1 className="text-2xl font-semibold tracking-tight mt-1">{ws.name}</h1>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{ws.id}</div>
                </div>
                <div className="flex items-center gap-2">
                    {healthBadge(ws.health)}
                    {ws.stripeCustomerId && (
                        <a
                            href={`https://dashboard.stripe.com/customers/${ws.stripeCustomerId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2.5 py-1 rounded-md border hover:bg-muted inline-flex items-center gap-1"
                        >
                            Stripe customer
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
            </header>

            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat
                    icon={<Coins className="h-3.5 w-3.5" />}
                    label="MRR"
                    value={
                        ws.monthlyRevenueCents > 0 ? formatCents(ws.monthlyRevenueCents) : "—"
                    }
                    sub={`${ws.plan.toUpperCase()} · ${ws.planStatus}`}
                />
                <Stat
                    icon={<Users className="h-3.5 w-3.5" />}
                    label="Contacts"
                    value={formatNumber(ws.contactCount)}
                    sub={
                        ws.contactCap != null
                            ? `of ${formatNumber(ws.contactCap)}${
                                  capPct != null ? ` (${capPct.toFixed(0)}%)` : ""
                              }`
                            : "unlimited"
                    }
                />
                <Stat
                    icon={<Briefcase className="h-3.5 w-3.5" />}
                    label="Deals"
                    value={formatNumber(ws.dealCount)}
                />
                <Stat
                    icon={<Workflow className="h-3.5 w-3.5" />}
                    label="Automations / campaigns"
                    value={`${formatNumber(ws.automationCount)} · ${formatNumber(ws.campaignCount)}`}
                />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card title="Owner + members" icon={<UserCircle className="h-4 w-4" />}>
                    {owner ? (
                        <div className="mb-3 pb-3 border-b">
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
                                Owner
                            </div>
                            <div className="text-sm font-medium">
                                {owner.name || owner.email || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">{owner.email}</div>
                        </div>
                    ) : null}
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1.5">
                        Other members ({otherMembers.length})
                    </div>
                    {otherMembers.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Solo workspace.</p>
                    ) : (
                        <ul className="space-y-1.5">
                            {otherMembers.map((m) => (
                                <li
                                    key={m.userId}
                                    className="flex items-center justify-between text-xs"
                                >
                                    <span>
                                        <span className="font-medium">
                                            {m.name || m.email || "—"}
                                        </span>
                                        {m.email && (
                                            <span className="text-muted-foreground ml-1.5">
                                                {m.email}
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {m.role}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card title="Billing" icon={<Coins className="h-4 w-4" />}>
                    <div className="space-y-2 text-xs">
                        <Row label="Plan" value={ws.plan.toUpperCase()} />
                        <Row label="Status" value={ws.planStatus} />
                        <Row label="MRR" value={formatCents(ws.monthlyRevenueCents)} />
                        <Row
                            label="Period ends"
                            value={
                                ws.stripeSubscription?.currentPeriodEnd
                                    ? formatDate(ws.stripeSubscription.currentPeriodEnd)
                                    : formatDate(ws.planExpiresAt)
                            }
                        />
                        {ws.stripeSubscription?.cadence && (
                            <Row label="Billing cycle" value={ws.stripeSubscription.cadence} />
                        )}
                        {ws.stripeSubscription?.cancelAt && (
                            <Row
                                label="Cancels at"
                                value={formatDate(ws.stripeSubscription.cancelAt)}
                            />
                        )}
                        {ws.stripeSubscription?.latestInvoiceUrl && (
                            <a
                                href={ws.stripeSubscription.latestInvoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline"
                            >
                                Latest invoice
                                <ArrowUpRight className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                </Card>

                <Card title="Feature adoption" icon={<CheckCircle2 className="h-4 w-4" />}>
                    <ul className="space-y-2">
                        {firstsRows.map((r) => (
                            <li key={r.label} className="flex items-center gap-2 text-xs">
                                {r.at ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                ) : (
                                    <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                <span className={r.at ? "" : "text-muted-foreground"}>
                                    {r.label}
                                </span>
                                {r.at && (
                                    <span className="ml-auto text-[10px] text-muted-foreground">
                                        {formatRelative(r.at)}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </Card>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Workspace meta" icon={<Mail className="h-4 w-4" />}>
                    <div className="space-y-2 text-xs">
                        <Row label="Slug" value={ws.slug || "—"} />
                        <Row label="Created" value={formatDate(ws.createdAt)} />
                        <Row label="Last activity" value={formatRelative(ws.lastActiveAt)} />
                        <Row label="Members" value={formatNumber(ws.memberCount)} />
                        {ws.deletionScheduledAt && (
                            <Row
                                label="Deletion scheduled"
                                value={formatDate(ws.deletionScheduledAt)}
                            />
                        )}
                    </div>
                </Card>

                <Card title="Recent activity">
                    {ws.auditLog.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                            No audit-log entries yet.
                        </p>
                    ) : (
                        <ul className="space-y-1.5">
                            {ws.auditLog.slice(0, 12).map((entry) => (
                                <li key={entry.id} className="text-xs">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="truncate">
                                            <span className="font-medium">
                                                {entry.userName || entry.userEmail || "system"}
                                            </span>
                                            <span className="text-muted-foreground ml-1.5">
                                                {entry.action} · {entry.entity}
                                                {entry.entityName && (
                                                    <span className="text-foreground">
                                                        {" "}
                                                        — {entry.entityName}
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                            {formatRelative(entry.at)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </section>

            <section>
                <OperatorActions
                    workspaceId={ws.id}
                    workspaceName={ws.name}
                    currentPlan={ws.plan}
                    isSuspended={isSuspended}
                    hasStripeSubscription={!!ws.stripeSubscriptionId}
                />
            </section>

            <section className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">Operator audit (last 30)</h2>
                    <span className="text-[11px] text-muted-foreground">
                        Email balance: {formatNumber(emailCreditBalance)}
                    </span>
                </div>
                {operatorAudit.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                        No operator actions on this workspace yet.
                    </p>
                ) : (
                    <ul className="space-y-1.5">
                        {operatorAudit.map((entry) => (
                            <li
                                key={entry.id}
                                className="text-xs flex items-baseline justify-between gap-2"
                            >
                                <span className="truncate">
                                    <span className="font-medium">{entry.operatorEmail}</span>
                                    <span className="text-muted-foreground ml-2">
                                        {entry.action}
                                    </span>
                                    {Object.keys(entry.params).length > 0 && (
                                        <span className="text-muted-foreground ml-2 font-mono text-[10px]">
                                            {JSON.stringify(entry.params)}
                                        </span>
                                    )}
                                </span>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                    {formatRelative(entry.at)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

function Stat({
    icon,
    label,
    value,
    sub,
}: {
    icon: React.ReactNode
    label: string
    value: string
    sub?: string
}) {
    return (
        <div className="rounded-xl border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                {icon}
                {label}
            </div>
            <div className="text-lg font-semibold mt-1">{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    )
}

function Card({
    title,
    icon,
    children,
}: {
    title: string
    icon?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
                {icon}
                <h2 className="text-sm font-semibold">{title}</h2>
            </div>
            {children}
        </div>
    )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
        </div>
    )
}
