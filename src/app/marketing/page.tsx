import Link from "next/link"
import { requireAuth } from "@/lib/auth-guard"
import {
    getWorkspaceEmailStats,
    listCampaigns,
} from "@/lib/campaigns/campaigns"
import { Button } from "@/components/ui/button"
import {
    ArrowRight,
    BarChart3,
    Calendar,
    ClipboardList,
    FileText,
    Mail,
    MailCheck,
    Megaphone,
    MousePointerClick,
    Newspaper,
    Plus,
    Search,
    Share2,
    Sparkles,
    Zap,
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function MarketingHubPage() {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const [campaigns, emailStats] = await Promise.all([
        listCampaigns(workspaceId),
        getWorkspaceEmailStats(workspaceId, 30),
    ])

    const recentSent = campaigns
        .filter((c) => c.status === "sent" || c.status === "sent_with_errors")
        .slice(0, 3)
    const upcoming = campaigns
        .filter((c) => c.status === "scheduled")
        .slice(0, 3)

    return (
        <div className="container mx-auto max-w-6xl py-8 px-4 space-y-8">
            {/* Hero */}
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
                            <Megaphone className="w-3 h-3" />
                            Marketing
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            One place for the whole funnel.
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                            Email, social, web traffic, SEO, blog, and PR — all under one roof.
                            Watch the channels that drive new contacts in real time.
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

                {/* KPI strip — pulls real signal from the email engine */}
                <div className="relative grid grid-cols-2 md:grid-cols-4 border-t bg-card/40 backdrop-blur">
                    <HeroStat
                        Icon={Zap}
                        label="Emails sent (30d)"
                        value={formatCompact(emailStats.last30Sent)}
                        accent="emerald"
                    />
                    <HeroStat
                        Icon={MailCheck}
                        label="Avg open rate"
                        value={`${emailStats.avgOpenRate.toFixed(1)}%`}
                        accent="blue"
                    />
                    <HeroStat
                        Icon={MousePointerClick}
                        label="Avg click rate"
                        value={`${emailStats.avgClickRate.toFixed(1)}%`}
                        accent="violet"
                    />
                    <HeroStat
                        Icon={Sparkles}
                        label="Active campaigns"
                        value={String(emailStats.activeCampaigns)}
                        accent={emailStats.activeCampaigns > 0 ? "amber" : "default"}
                    />
                </div>
            </div>

            {/* Channel tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <ChannelTile
                    href="/marketing/email"
                    Icon={Mail}
                    title="Email"
                    description="Campaigns, templates, lists, suppressions."
                    metric={`${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`}
                    accent="emerald"
                />
                <ChannelTile
                    href="/marketing/forms"
                    Icon={ClipboardList}
                    title="Lead forms"
                    description="Embed forms or share links to capture leads."
                    accent="violet"
                />
                <ChannelTile
                    href="/marketing/social"
                    Icon={Share2}
                    title="Social"
                    description="Schedule + cross-post to LinkedIn, Twitter, Facebook."
                    accent="blue"
                />
                <ChannelTile
                    href="/marketing/analytics"
                    Icon={BarChart3}
                    title="Web traffic"
                    description="Sessions, sources, conversions from your site."
                    accent="violet"
                />
                <ChannelTile
                    href="/marketing/seo"
                    Icon={Search}
                    title="SEO"
                    description="Keyword ranks, backlinks, competitor tracking."
                    accent="amber"
                />
                <ChannelTile
                    href="/marketing/blog"
                    Icon={FileText}
                    title="Blog"
                    description="AI-assisted content + WordPress publishing."
                    accent="rose"
                />
                <ChannelTile
                    href="/marketing/haro"
                    Icon={Newspaper}
                    title="HARO"
                    description="Press requests, journalist outreach, PR pickups."
                    accent="emerald"
                />
                <ChannelTile
                    href="/settings/booking"
                    Icon={Calendar}
                    title="Booking page"
                    description="Public scheduling link prospects use to book meetings."
                    accent="sky"
                />
            </div>

            {/* Recent + upcoming campaign rails */}
            {(recentSent.length > 0 || upcoming.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {upcoming.length > 0 && (
                        <CampaignRail
                            title="Scheduled to send"
                            tone="blue"
                            campaigns={upcoming}
                        />
                    )}
                    {recentSent.length > 0 && (
                        <CampaignRail
                            title="Recently sent"
                            tone="emerald"
                            campaigns={recentSent}
                        />
                    )}
                </div>
            )}
        </div>
    )
}

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

function ChannelTile({
    href,
    Icon,
    title,
    description,
    metric,
    accent,
}: {
    href: string
    Icon: React.ComponentType<{ className?: string }>
    title: string
    description: string
    metric?: string
    accent: "emerald" | "blue" | "violet" | "amber" | "rose" | "sky"
}) {
    const tone = {
        emerald: { gradient: "from-emerald-500/30 to-emerald-500/0", icon: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
        blue: { gradient: "from-blue-500/30 to-blue-500/0", icon: "text-blue-600 dark:text-blue-400 bg-blue-500/10" },
        violet: { gradient: "from-violet-500/30 to-violet-500/0", icon: "text-violet-600 dark:text-violet-400 bg-violet-500/10" },
        amber: { gradient: "from-amber-500/30 to-amber-500/0", icon: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
        rose: { gradient: "from-rose-500/30 to-rose-500/0", icon: "text-rose-600 dark:text-rose-400 bg-rose-500/10" },
        sky: { gradient: "from-sky-500/30 to-sky-500/0", icon: "text-sky-600 dark:text-sky-400 bg-sky-500/10" },
    }[accent]
    return (
        <Link href={href}>
            <div className="relative group rounded-xl border bg-card p-5 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden h-full">
                <div
                    aria-hidden
                    className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${tone.gradient}`}
                />
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone.icon}`}
                    >
                        <Icon className="w-4 h-4" />
                    </div>
                    {metric && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground tabular-nums">
                            {metric}
                        </span>
                    )}
                </div>
                <div className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-1.5">
                    {title}
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-snug">
                    {description}
                </div>
            </div>
        </Link>
    )
}

interface CampaignSummary {
    id: string
    name: string
    subject: string
    status: string
    scheduledAt?: string
    sentAt?: string
    stats?: { sent: number; targeted: number }
}

function CampaignRail({
    title,
    tone,
    campaigns,
}: {
    title: string
    tone: "blue" | "emerald"
    campaigns: CampaignSummary[]
}) {
    const dot = tone === "blue" ? "bg-blue-500" : "bg-emerald-500"
    return (
        <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                <Link
                    href="/marketing/email"
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                    View all →
                </Link>
            </div>
            <div className="space-y-1.5">
                {campaigns.map((c) => (
                    <Link
                        key={c.id}
                        href={`/marketing/email/campaigns/${c.id}`}
                        className="flex items-center gap-3 px-2 py-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors"
                    >
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                                {c.subject}
                            </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                            {tone === "blue" && c.scheduledAt
                                ? new Date(c.scheduledAt).toLocaleDateString()
                                : c.stats?.sent
                                  ? `${c.stats.sent.toLocaleString()} sent`
                                  : ""}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}

function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`
    return n.toLocaleString()
}
