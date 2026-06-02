import Link from "next/link"
import { requireAuth } from "@/lib/auth-guard"
import {
    getWorkspaceEmailStats,
    listCampaigns,
} from "@/lib/campaigns/campaigns"
import { listTemplates } from "@/lib/campaigns/templates"
import { getBalance } from "@/lib/credits/email-credits"
import { getIdentity } from "@/lib/ses/identities"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    AlertCircle,
    ArrowRight,
    FileText,
    MailCheck,
    MousePointerClick,
    Plus,
    Sparkles,
    ShieldOff,
    TrendingUp,
    Users,
    Wallet,
    Zap,
} from "lucide-react"
import { CampaignsList } from "./CampaignsList"
import { EmptyState } from "@/components/ui/EmptyState"
import { PlanLocked } from "@/components/PlanLocked"
import { getWorkspacePlan } from "@/lib/billing/plans-server"
import { hasFeature } from "@/lib/billing/plans"

export const dynamic = "force-dynamic"

export default async function EmailMarketingPage() {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const plan = await getWorkspacePlan(workspaceId)
    if (!hasFeature(plan.tier, "emailMarketing")) {
        return (
            <div className="container mx-auto max-w-5xl py-10 px-4 space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
                        <MailCheck className="w-6 h-6 text-primary" />
                        Email marketing
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        Campaigns, lists, templates, and suppressions — all in one place.
                    </p>
                </div>
                <PlanLocked
                    feature="Email marketing"
                    requiredTier="pro"
                    currentTier={plan.tier}
                />
            </div>
        )
    }

    const [campaigns, templates, balance, identity, stats] = await Promise.all([
        listCampaigns(workspaceId),
        listTemplates(workspaceId),
        getBalance(workspaceId),
        getIdentity(workspaceId),
        getWorkspaceEmailStats(workspaceId, 30),
    ])

    const sesReady = identity?.status === "VERIFIED"

    return (
        <div className="container mx-auto max-w-6xl py-10 px-4 space-y-8">
            {/* Hero header — gradient backdrop, big actions */}
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-violet-500/5">
                <div
                    aria-hidden
                    className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none"
                />
                <div
                    aria-hidden
                    className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none"
                />
                <div className="relative p-6 md:p-8 flex items-start justify-between gap-6 flex-wrap">
                    <div className="min-w-0">
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-full mb-3">
                            <Sparkles className="w-3 h-3" />
                            Email Marketing
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            Send campaigns. Track engagement. Grow.
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                            Build pixel-perfect templates, target the right audience, and watch
                            opens and clicks land in real time.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Link href="/marketing/email/templates/new">
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <FileText className="w-3.5 h-3.5" />
                                New template
                            </Button>
                        </Link>
                        <Link href="/marketing/email/campaigns/new">
                            <Button size="sm" className="gap-1.5 shadow-sm">
                                <Plus className="w-3.5 h-3.5" />
                                New campaign
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* KPI strip */}
                <div className="relative grid grid-cols-2 md:grid-cols-4 border-t bg-card/40 backdrop-blur">
                    <HeroStat
                        Icon={Zap}
                        label="Sent (30d)"
                        value={formatCompact(stats.last30Sent)}
                        accent="emerald"
                    />
                    <HeroStat
                        Icon={MailCheck}
                        label="Avg open rate"
                        value={`${stats.avgOpenRate.toFixed(1)}%`}
                        accent="blue"
                    />
                    <HeroStat
                        Icon={MousePointerClick}
                        label="Avg click rate"
                        value={`${stats.avgClickRate.toFixed(1)}%`}
                        accent="violet"
                    />
                    <HeroStat
                        Icon={Wallet}
                        label="Credits"
                        value={formatCompact(balance)}
                        accent={balance < 100 ? "amber" : "default"}
                    />
                </div>
            </div>

            {!sesReady && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <div className="font-medium">SES is not set up</div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Verify a sending domain before sending campaigns.
                        </p>
                    </div>
                    <Link href="/settings/integrations/ses">
                        <Button variant="outline" size="sm">
                            Configure
                        </Button>
                    </Link>
                </div>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <QuickLink
                    href="/marketing/email/sequences"
                    Icon={Zap}
                    label="Sequences"
                    accent="violet"
                />
                <QuickLink
                    href="/marketing/email/lists"
                    Icon={Users}
                    label="Contact lists"
                    accent="blue"
                />
                <QuickLink
                    href="/marketing/email/templates"
                    Icon={FileText}
                    label="Templates"
                    accent="violet"
                />
                <QuickLink
                    href="/marketing/email/suppressions"
                    Icon={ShieldOff}
                    label="Suppressions"
                    accent="rose"
                />
            </div>

            {/* Campaigns */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold tracking-tight">Campaigns</h2>
                        {stats.activeCampaigns > 0 && (
                            <span className="text-[11px] uppercase tracking-wider font-medium text-blue-700 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                {stats.activeCampaigns} active
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {campaigns.length} total
                    </span>
                </div>
                <CampaignsList
                    campaigns={campaigns.map((c) => ({
                        id: c.id,
                        name: c.name,
                        subject: c.subject,
                        status: c.status,
                        scheduledAt: c.scheduledAt,
                        sentAt: c.sentAt,
                        createdAt: c.createdAt,
                        stats: c.stats,
                    }))}
                />
            </section>

            {/* Templates strip */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <Link
                        href="/marketing/email/templates"
                        className="text-lg font-semibold tracking-tight hover:underline flex items-center gap-1.5 group"
                    >
                        Templates
                        <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                    <span className="text-xs text-muted-foreground">
                        {templates.length} total
                    </span>
                </div>
                {templates.length === 0 ? (
                    <Card className="rounded-xl">
                        <CardContent className="p-0">
                            <EmptyState
                                Icon={FileText}
                                accent="primary"
                                title="No templates yet"
                                description="Build one with the drag-and-drop editor."
                                action={{ label: "New template", href: "/marketing/email/templates/new" }}
                                compact
                            />
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {templates.slice(0, 6).map((t) => (
                            <Link key={t.id} href={`/marketing/email/templates/${t.id}`}>
                                <div className="group rounded-xl border bg-card p-4 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full">
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                                {t.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                                                {t.subject || "(no subject)"}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground/70 mt-2">
                                                Updated {new Date(t.updatedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {campaigns.length > 0 && sesReady && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" />
                    Campaigns deduct 1 credit per recipient. Engagement events stream into{" "}
                    <code className="px-1 py-0.5 rounded bg-muted text-[10px]">email_logs</code>{" "}
                    and onto each contact&apos;s timeline.
                </p>
            )}
        </div>
    )
}

// ── Hero KPI cell ──────────────────────────────────────────────────────────

function HeroStat({
    Icon,
    label,
    value,
    accent,
}: {
    Icon: React.ComponentType<{ className?: string }>
    label: string
    value: string
    accent: "emerald" | "blue" | "violet" | "amber" | "default"
}) {
    const tone = {
        emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
        blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
        violet: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
        amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
        default: "text-foreground bg-muted",
    }[accent]
    return (
        <div className="px-5 py-4 border-r last:border-r-0 flex items-center gap-3">
            <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}
            >
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {label}
                </div>
                <div className="text-xl font-semibold tabular-nums leading-tight">
                    {value}
                </div>
            </div>
        </div>
    )
}

function QuickLink({
    href,
    Icon,
    label,
    accent,
}: {
    href: string
    Icon: React.ComponentType<{ className?: string }>
    label: string
    accent: "blue" | "violet" | "rose"
}) {
    const tone = {
        blue: "from-blue-500/30 to-blue-500/0 text-blue-600 dark:text-blue-400 bg-blue-500/10",
        violet: "from-violet-500/30 to-violet-500/0 text-violet-600 dark:text-violet-400 bg-violet-500/10",
        rose: "from-rose-500/30 to-rose-500/0 text-rose-600 dark:text-rose-400 bg-rose-500/10",
    }[accent]
    const [gradient, ...rest] = tone.split(" ")
    const iconClasses = rest.join(" ")
    return (
        <Link href={href}>
            <div className="relative group rounded-xl border bg-card p-4 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
                <div
                    aria-hidden
                    className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${gradient}`}
                />
                <div className="flex items-center gap-3">
                    <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClasses}`}
                    >
                        <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm group-hover:text-primary transition-colors">
                            {label}
                        </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
            </div>
        </Link>
    )
}

function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`
    return n.toLocaleString()
}
