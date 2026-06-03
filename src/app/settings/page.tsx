import Link from "next/link"
import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import {
    ArrowRight,
    Bot,
    Database,
    GitBranch,
    Palette,
    Settings as SettingsIcon,
    User,
    Users,
    Webhook,
} from "lucide-react"

export const dynamic = "force-dynamic"

interface SettingsTile {
    href: string
    Icon: React.ComponentType<{ className?: string }>
    title: string
    desc: string
    accent: "blue" | "violet" | "emerald" | "amber" | "rose" | "sky"
    /** Pill shown next to the title — "New", "Updated", etc. */
    badge?: string
    adminOnly?: boolean
}

interface TileGroup {
    title: string
    description?: string
    tiles: SettingsTile[]
}

/**
 * Grouped settings hub. Three buckets:
 *
 *   You — your own profile + notifications.
 *   Workspace — admin-only configuration that affects everyone in the
 *               workspace (branding, pipeline, custom fields, team, etc).
 *   Tools & connections — admin-only integrations + APIs (AI providers,
 *                         webhooks, REST API, etc).
 *   Help — public docs + status. Available to every signed-in user.
 *
 * Descriptions reference current features so users searching for
 * "AI routing" or "webhooks" land on the right tile.
 */
const GROUPS: TileGroup[] = [
    {
        title: "You",
        tiles: [
            {
                href: "/settings/profile",
                Icon: User,
                title: "Profile",
                desc: "Your name, photo, phone, and notification preferences.",
                accent: "blue",
            },
        ],
    },
    {
        title: "Workspace",
        description: "Settings that affect everyone in this workspace.",
        tiles: [
            {
                href: "/settings/workspace",
                Icon: SettingsIcon,
                title: "Workspace",
                desc: "Identity, industry templates, sample data, pipeline stages with smart probabilities, default profit margin, custom fields, tags, statuses, booking page.",
                accent: "emerald",
                adminOnly: true,
            },
            {
                href: "/settings/branding",
                Icon: Palette,
                title: "Branding",
                desc: "Logo, colors, font, footer address, website URL, Calendly link — auto-applied across the app and outbound email.",
                accent: "violet",
                adminOnly: true,
            },
            {
                href: "/settings/team",
                Icon: Users,
                title: "Team",
                desc: "Invite members, set roles, configure auto-assignment, and review the audit log.",
                accent: "blue",
                adminOnly: true,
            },
            {
                href: "/settings/data",
                Icon: Database,
                title: "Data import & export",
                desc: "CSV imports, CSV exports, full JSON workspace backup. Scheduled email reports too.",
                accent: "amber",
                adminOnly: true,
            },
        ],
    },
    {
        title: "Tools & connections",
        description: "AI providers, integrations, webhooks, and API access.",
        tiles: [
            {
                href: "/settings/integrations/ai-routing",
                Icon: Bot,
                title: "AI providers & routing",
                desc: "Bring your own keys for Anthropic, OpenAI, and Gemini. Pick which provider runs each AI feature — assistant, blog generation, automation nodes, and the inline ✨ Write-with-AI buttons.",
                accent: "violet",
                badge: "New",
                adminOnly: true,
            },
            {
                href: "/settings/integrations/services",
                Icon: GitBranch,
                title: "Integrations",
                desc: "Gmail, Google Calendar / Analytics / Search Console, Apple Calendar feed, Amazon SES, Twilio SMS, Zernio social, WordPress, Stripe credit top-ups.",
                accent: "rose",
                adminOnly: true,
            },
            {
                href: "/settings/integrations/webhooks",
                Icon: Webhook,
                title: "Webhooks & API",
                desc: "POST CRM events to your own systems — Vesta JSON envelope or Slack message format. Generate workspace-scoped REST API keys with the embed snippet.",
                accent: "sky",
                badge: "New",
                adminOnly: true,
            },
        ],
    },
    // Help + status moved out of settings — they live in the sidebar
    // account dropdown now (avatar at bottom-left → menu).
]

export default async function SettingsHubPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")

    const role = (session.user as { role?: string }).role
    const isAdmin = role === "OWNER" || role === "ADMIN"

    return (
        <div className="container mx-auto max-w-5xl py-8 px-4 space-y-8">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Profile is yours; workspace, tools, and connections affect everyone.
                </p>
            </div>

            {GROUPS.map((group) => {
                const visibleTiles = group.tiles.filter((t) => !t.adminOnly || isAdmin)
                if (visibleTiles.length === 0) return null
                return (
                    <section key={group.title} className="space-y-3">
                        <div>
                            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {group.title}
                            </h2>
                            {group.description && (
                                <p className="text-xs text-muted-foreground/80 mt-0.5">{group.description}</p>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {visibleTiles.map((t) => (
                                <SettingsTile key={t.href} {...t} />
                            ))}
                        </div>
                    </section>
                )
            })}
        </div>
    )
}

function SettingsTile({
    href,
    Icon,
    title,
    desc,
    accent,
    badge,
}: {
    href: string
    Icon: React.ComponentType<{ className?: string }>
    title: string
    desc: string
    accent: "blue" | "violet" | "emerald" | "amber" | "rose" | "sky"
    badge?: string
}) {
    const tone = {
        blue: { gradient: "from-blue-500/30 to-blue-500/0", icon: "text-blue-600 dark:text-blue-400 bg-blue-500/10" },
        violet: { gradient: "from-violet-500/30 to-violet-500/0", icon: "text-violet-600 dark:text-violet-400 bg-violet-500/10" },
        emerald: { gradient: "from-emerald-500/30 to-emerald-500/0", icon: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
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
                    {badge && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            {badge}
                        </span>
                    )}
                </div>
                <div className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-1.5">
                    {title}
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-snug">{desc}</div>
            </div>
        </Link>
    )
}
