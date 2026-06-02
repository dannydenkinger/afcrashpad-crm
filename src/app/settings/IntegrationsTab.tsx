"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { disconnectGoogleCalendar } from "./users/actions"
import { useState, useTransition, useEffect } from "react"
import { GoogleAnalyticsManager } from "./integrations/GoogleAnalyticsManager"
import {
    Loader2, CalendarSync, Apple, MessageSquare, CreditCard,
    ExternalLink, Copy, Check, Mail, Bot, Search, Globe, Eye, EyeOff,
    BarChart3, Image, Briefcase,
} from "lucide-react"
import { toast } from "sonner"

interface IntegrationStatus {
    google: {
        connected: boolean
        ga4PropertyId: string | null
        gscSiteUrl: string | null
    }
    gmail: { connected: boolean; email: string | null }
    resend: { connected: boolean }
    ses: { connected: boolean; status: string | null; identity: string | null }
    twilio: { connected: boolean; fromNumber: string | null }
    zernio: { connected: boolean; accountCount: number }
    anthropic: { connected: boolean }
    openai: { connected: boolean }
    gemini: { connected: boolean }
    serper: { connected: boolean }
    wordpress: { connected: boolean }
}

export function IntegrationsTab({
    calendarConnected,
    icsFeedUrl,
    integrationStatus,
}: {
    calendarConnected: boolean
    icsFeedUrl: string
    integrationStatus: IntegrationStatus
}) {
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const [copied, setCopied] = useState(false)
    const [testing, setTesting] = useState<string | null>(null)
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
    const [status, setStatus] = useState(integrationStatus)
    const [isPending, startTransition] = useTransition()

    // Surface OAuth callback outcomes (?gmail=connected|denied|error) once,
    // then strip them from the URL so a refresh doesn't re-fire the toast.
    useEffect(() => {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        const gmail = params.get("gmail")
        if (!gmail) return
        if (gmail === "connected") toast.success("Gmail connected")
        else if (gmail === "denied") toast.error("Gmail connection canceled")
        else toast.error("Gmail connection failed")
        params.delete("gmail")
        const next = params.toString()
        window.history.replaceState({}, "", window.location.pathname + (next ? `?${next}` : ""))
    }, [])

    const handleDisconnect = async () => {
        setIsDisconnecting(true)
        try {
            await disconnectGoogleCalendar()
        } catch (error) {
            console.error(error)
        } finally {
            setIsDisconnecting(false)
        }
    }

    const handleCopy = async () => {
        await navigator.clipboard.writeText(icsFeedUrl)
        setCopied(true)
        toast.success("Feed URL copied to clipboard")
        setTimeout(() => setCopied(false), 2000)
    }

    const toggleShowKey = (key: string) => {
        setShowKeys(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const handleSaveApiKey = async (
        service: string,
        config: Record<string, string>,
        testFn?: (actions: any) => Promise<{ success: boolean; message: string }>
    ) => {
        const actions = await import("@/app/setup/actions")

        if (testFn) {
            setTesting(service)
            const result = await testFn(actions)
            setTesting(null)
            if (!result.success) {
                toast.error(`Connection failed: ${result.message}`)
                return
            }
        }

        startTransition(async () => {
            try {
                await actions.saveApiKey(service, config)
                setStatus(prev => ({ ...prev, [service]: { connected: true } }))
                toast.success("Connected successfully!")
            } catch {
                toast.error("Failed to save configuration")
            }
        })
    }

    return (
        <div className="space-y-6">
            {/* ── Calendar ── */}
            <Section title="Calendar">
                {/* Google Calendar */}
                <IntegrationRow
                    icon={<CalendarSync className="h-5 w-5" />}
                    name="Google Calendar"
                    description="Two-way sync for opportunities and tasks."
                    connected={calendarConnected}
                    accent="blue"
                    action={
                        calendarConnected ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDisconnect}
                                disabled={isDisconnecting}
                                className="h-8 text-xs text-muted-foreground hover:text-destructive"
                            >
                                {isDisconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
                            </Button>
                        ) : (
                            <Button asChild size="sm" className="h-8">
                                <a href="/api/auth/google-calendar">
                                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                    Connect
                                </a>
                            </Button>
                        )
                    }
                />

                {/* Apple Calendar — read-only ICS feed */}
                <AppleCalendarCard
                    icsFeedUrl={icsFeedUrl}
                    copied={copied}
                    onCopy={handleCopy}
                />

            </Section>

            {/* ── Google Services ── */}
            <Section title="Google Services">
                <div className="sm:col-span-2">
                    <GoogleAnalyticsManager
                        googleConnected={status.google.connected}
                        initialGa4PropertyId={status.google.ga4PropertyId}
                        initialGscSiteUrl={status.google.gscSiteUrl}
                    />
                </div>
            </Section>

            {/* ── Email ── */}
            <Section title="Email">
                {/* Gmail Integration */}
                <IntegrationRow
                    icon={<Mail className="h-5 w-5" />}
                    name="Gmail"
                    description={status.gmail?.connected
                        ? `Send and receive as ${status.gmail.email}.`
                        : "Connect your Gmail account to send and receive emails inside the CRM."
                    }
                    connected={!!status.gmail?.connected}
                    accent="rose"
                    action={
                        status.gmail?.connected ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    if (!confirm("Disconnect Gmail? Sent/received email logs are kept; sending and receiving will stop until you reconnect.")) return
                                    const res = await fetch("/api/auth/gmail/disconnect", { method: "POST" })
                                    if (res.ok) {
                                        toast.success("Gmail disconnected")
                                        setStatus(s => ({ ...s, gmail: { connected: false, email: null } }))
                                    } else {
                                        toast.error("Failed to disconnect Gmail")
                                    }
                                }}
                            >
                                Disconnect
                            </Button>
                        ) : (
                            <a href="/api/auth/gmail">
                                <Button variant="outline" size="sm">
                                    Connect Gmail
                                    <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                                </Button>
                            </a>
                        )
                    }
                />

                {/* Resend removed from the public Settings UI. SES + Gmail
                    cover marketing and transactional sends respectively;
                    Resend remains as an ENV-only fallback inside the email
                    library for system notifications when neither is set up. */}

                <IntegrationRow
                    icon={<MessageSquare className="h-5 w-5" />}
                    name="Zernio (Social Planner)"
                    accent="violet"
                    description={
                        status.zernio.connected
                            ? `${status.zernio.accountCount} social ${status.zernio.accountCount === 1 ? "account" : "accounts"} linked via Zernio.`
                            : "Schedule posts to Facebook, Instagram, X, LinkedIn, TikTok and more via Zernio."
                    }
                    connected={status.zernio.connected}
                    action={
                        <a href="/settings/integrations/zernio">
                            <Button variant="outline" size="sm">
                                {status.zernio.connected ? "Manage" : "Set up"}
                                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                            </Button>
                        </a>
                    }
                />

                <IntegrationRow
                    icon={<Mail className="h-5 w-5" />}
                    name="Amazon SES"
                    accent="amber"
                    description={
                        status.ses.identity
                            ? `Marketing email delivery via ${status.ses.identity} (${status.ses.status ?? "PENDING"}).`
                            : "Marketing email delivery. Verify a sending domain to use email campaigns."
                    }
                    connected={status.ses.connected}
                    action={
                        <a href="/settings/integrations/ses">
                            <Button variant="outline" size="sm">
                                {status.ses.identity ? "Manage" : "Set up"}
                                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                            </Button>
                        </a>
                    }
                />

                <IntegrationRow
                    icon={<MessageSquare className="h-5 w-5" />}
                    name="Twilio (SMS)"
                    accent="rose"
                    description={
                        status.twilio.fromNumber
                            ? `SMS delivery from ${status.twilio.fromNumber}.`
                            : "Send SMS from automations. Pay-as-you-go to Twilio (~$0.0079/text)."
                    }
                    connected={status.twilio.connected}
                    action={
                        <a href="/settings/integrations/twilio">
                            <Button variant="outline" size="sm">
                                {status.twilio.connected ? "Manage" : "Set up"}
                                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                            </Button>
                        </a>
                    }
                />
            </Section>

            {/* ── AI & SEO ── */}
            <Section title="AI & SEO">
                <ApiKeyRow
                    icon={<Bot className="h-4.5 w-4.5 text-muted-foreground" />}
                    name="Anthropic (Claude)"
                    description="Powers the AI assistant, blog generation, HARO replies, and AI automations."
                    linkUrl="https://console.anthropic.com/settings/keys"
                    linkText="Get API key from Anthropic"
                    placeholder="sk-ant-..."
                    connected={status.anthropic.connected}
                    testing={testing === "anthropic"}
                    isPending={isPending}
                    showKey={showKeys.anthropic}
                    onToggleShow={() => toggleShowKey("anthropic")}
                    onSave={(key) => handleSaveApiKey(
                        "anthropic",
                        { apiKey: key },
                        (actions) => actions.testAnthropicConnection(key)
                    )}
                />

                <ApiKeyRow
                    icon={<Bot className="h-4.5 w-4.5 text-muted-foreground" />}
                    name="OpenAI (GPT)"
                    description="Save a key to route AI features to GPT-4o, GPT-5, or any custom OpenAI model."
                    linkUrl="https://platform.openai.com/api-keys"
                    linkText="Get API key from OpenAI"
                    placeholder="sk-..."
                    connected={status.openai.connected}
                    testing={testing === "openai"}
                    isPending={isPending}
                    showKey={showKeys.openai}
                    onToggleShow={() => toggleShowKey("openai")}
                    onSave={(key) => handleSaveApiKey(
                        "openai",
                        { apiKey: key },
                        (actions) => actions.testOpenAIConnection(key)
                    )}
                />

                <ApiKeyRow
                    icon={<Bot className="h-4.5 w-4.5 text-muted-foreground" />}
                    name="Google Gemini"
                    description="Save a key to route AI features to Gemini 2.5 Flash, Pro, or any custom Gemini model."
                    linkUrl="https://aistudio.google.com/apikey"
                    linkText="Get API key from Google AI Studio"
                    placeholder="AIza..."
                    connected={status.gemini.connected}
                    testing={testing === "gemini"}
                    isPending={isPending}
                    showKey={showKeys.gemini}
                    onToggleShow={() => toggleShowKey("gemini")}
                    onSave={(key) => handleSaveApiKey(
                        "gemini",
                        { apiKey: key },
                        (actions) => actions.testGeminiConnection(key)
                    )}
                />

                <ApiKeyRow
                    icon={<Search className="h-4.5 w-4.5 text-muted-foreground" />}
                    name="Serper (SERP Tracking)"
                    description="Google search results and keyword rank tracking."
                    linkUrl="https://serper.dev/api-key"
                    linkText="Get API key from Serper"
                    placeholder="Enter Serper API key..."
                    connected={status.serper.connected}
                    testing={testing === "serper"}
                    isPending={isPending}
                    showKey={showKeys.serper}
                    onToggleShow={() => toggleShowKey("serper")}
                    onSave={(key) => handleSaveApiKey(
                        "serper",
                        { apiKey: key },
                        (actions) => actions.testSerperConnection(key)
                    )}
                />

            </Section>

            {/* ── Publishing ── */}
            <Section title="Publishing">
                <WordPressRow
                    connected={status.wordpress.connected}
                    testing={testing === "wordpress"}
                    isPending={isPending}
                    showKey={showKeys.wordpress}
                    onToggleShow={() => toggleShowKey("wordpress")}
                    onSave={(url, user, pass) => handleSaveApiKey(
                        "wordpress",
                        { url, username: user, appPassword: pass },
                        (actions) => actions.testWordPressConnection(url, user, pass)
                    )}
                />
            </Section>

            {/* ── Coming Soon ── */}
            <Section title="Coming Soon">
                <IntegrationRow
                    icon={<CreditCard className="h-5 w-5" />}
                    name="Stripe Billing"
                    description="Collect deposits and invoice payments from inside a deal."
                    connected={false}
                    comingSoon
                    accent="violet"
                />
                <IntegrationRow
                    icon={<Briefcase className="h-5 w-5" />}
                    name="QuickBooks"
                    description="Sync customers + create invoices when a deal closes won."
                    connected={false}
                    comingSoon
                    accent="emerald"
                />
            </Section>
        </div>
    )
}

// ── Helper Components ──

/**
 * Apple Calendar lives on a different track than Google: there's no real
 * OAuth API for iCloud Calendar, and CalDAV requires app-specific
 * passwords that customers find confusing. Instead, we publish a
 * read-only .ics feed that Apple Calendar can subscribe to natively
 * (Mac Calendar.app, iPhone Calendar app). Events flow CRM → Apple, not
 * the other way around.
 *
 * This card spells out the "subscribe by URL" steps because users who
 * have only used Google Calendar usually don't know the flow exists.
 */
function AppleCalendarCard({
    icsFeedUrl,
    copied,
    onCopy,
}: {
    icsFeedUrl: string
    copied: boolean
    onCopy: () => void
}) {
    // Apple supports webcal:// to launch Calendar.app directly. Convert
    // any https:// to webcal:// so the "Open in Apple Calendar" button
    // skips the manual paste step on macOS/iOS.
    const webcalUrl = icsFeedUrl.replace(/^https?:\/\//, "webcal://")

    return (
        <div className="sm:col-span-2 flex flex-col p-4 border rounded-xl bg-card space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shrink-0">
                        <Apple className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                            Apple Calendar
                            <span className="inline-flex items-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                One-way · CRM → Apple
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Apple doesn&apos;t expose a write API, so we publish a live calendar feed that
                            your Mac and iPhone can subscribe to. New deals, tasks, and bookings show up
                            in Apple Calendar within ~15 minutes. Edits made on the Apple side don&apos;t
                            sync back — to change events, edit them in Vesta.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <Input
                    readOnly
                    value={icsFeedUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-xs bg-muted/30 focus-visible:ring-0"
                    aria-label="Calendar feed URL"
                />
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5"
                    onClick={onCopy}
                >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy URL"}
                </Button>
                <Button
                    asChild
                    size="sm"
                    className="h-9 shrink-0 gap-1.5"
                >
                    <a href={webcalUrl}>
                        <Apple className="h-3.5 w-3.5" />
                        Subscribe
                    </a>
                </Button>
            </div>

            {/* Step-by-step instructions split by platform */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        On Mac (Calendar.app)
                    </div>
                    <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                        <li>Click the <span className="font-medium text-foreground">Subscribe</span> button above, or:</li>
                        <li>Open Calendar → File → New Calendar Subscription</li>
                        <li>Paste the feed URL and click Subscribe</li>
                        <li>Set <span className="font-medium text-foreground">Auto-refresh: Every 15 minutes</span></li>
                    </ol>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        On iPhone / iPad
                    </div>
                    <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                        <li>Settings → Calendar → Accounts → Add Account</li>
                        <li>Choose <span className="font-medium text-foreground">Other</span> → Add Subscribed Calendar</li>
                        <li>Paste the feed URL and tap Next, then Save</li>
                    </ol>
                </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
                Want two-way sync? Use Google Calendar above — Apple Calendar can also subscribe to your
                Google Calendar, so you get the best of both with a single integration.
            </p>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
        </div>
    )
}

function IntegrationRow({
    icon,
    name,
    description,
    connected,
    comingSoon,
    action,
    accent = "default",
}: {
    icon: React.ReactNode
    name: string
    description: string
    connected: boolean
    comingSoon?: boolean
    action?: React.ReactNode
    /** Brand color tone — picks the icon-tile background. */
    accent?: "default" | "blue" | "rose" | "emerald" | "violet" | "amber" | "sky"
}) {
    const accentClass = {
        default: "bg-muted text-muted-foreground",
        blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
        amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    }[accent]

    return (
        <div
            className={`relative flex flex-col p-4 border rounded-xl bg-card transition-all overflow-hidden ${
                comingSoon ? "opacity-50" : "hover:border-primary/30 hover:shadow-sm"
            } ${connected ? "border-emerald-500/30" : ""}`}
        >
            {connected && (
                <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-500/40 to-emerald-500/0"
                />
            )}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                        className={`flex items-center justify-center h-10 w-10 rounded-lg shrink-0 ${accentClass}`}
                    >
                        {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div
                            className={`text-sm font-semibold flex items-center gap-2 ${
                                comingSoon ? "text-muted-foreground" : ""
                            }`}
                        >
                            {name}
                            {connected && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                    </span>
                                    Live
                                </span>
                            )}
                            {comingSoon && (
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                                    Soon
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {description}
                        </div>
                    </div>
                </div>
            </div>
            {action && <div className="flex items-center gap-2 mt-3 justify-end">{action}</div>}
        </div>
    )
}

function ApiKeyRow({
    icon, name, description, linkUrl, linkText, placeholder,
    connected, testing, isPending, showKey, onToggleShow, onSave,
}: {
    icon: React.ReactNode
    name: string
    description: string
    linkUrl: string
    linkText: string
    placeholder: string
    connected: boolean
    testing: boolean
    isPending: boolean
    showKey: boolean
    onToggleShow: () => void
    onSave: (key: string) => void
}) {
    const [key, setKey] = useState("")

    return (
        <div className={`sm:col-span-2 relative p-4 border rounded-xl bg-card space-y-3 overflow-hidden ${connected ? "border-emerald-500/30" : ""}`}>
            {connected && (
                <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-500/40 to-emerald-500/0"
                />
            )}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold flex items-center gap-2">
                            {name}
                            {connected && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                    </span>
                                    Live
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                    </div>
                </div>
            </div>
            {!connected && (
                <>
                    <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        {linkText} <ExternalLink className="w-3 h-3" />
                    </a>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                                type={showKey ? "text" : "password"}
                                placeholder={placeholder}
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                className="pr-9"
                            />
                            <button
                                type="button"
                                onClick={onToggleShow}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <Button
                            size="sm"
                            className="h-10"
                            disabled={!key || testing || isPending}
                            onClick={() => onSave(key)}
                        >
                            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test & Save"}
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}

function WordPressRow({
    connected, testing, isPending, showKey, onToggleShow, onSave,
}: {
    connected: boolean
    testing: boolean
    isPending: boolean
    showKey: boolean
    onToggleShow: () => void
    onSave: (url: string, user: string, pass: string) => void
}) {
    const [wpUrl, setWpUrl] = useState("")
    const [wpUser, setWpUser] = useState("")
    const [wpPass, setWpPass] = useState("")

    return (
        <div className={`sm:col-span-2 p-4 border rounded-xl bg-card space-y-3 ${connected ? "border-emerald-500/30" : ""}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Globe className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold">WordPress</div>
                        <div className="text-xs text-muted-foreground">Publish blog posts directly from your CRM.</div>
                    </div>
                </div>
                {connected && (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10 gap-1.5 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected
                    </Badge>
                )}
            </div>
            {!connected && (
                <>
                    <a
                        href="https://wordpress.org/documentation/article/application-passwords/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                        How to create a WordPress Application Password <ExternalLink className="w-3 h-3" />
                    </a>
                    <Input
                        type="url"
                        placeholder="https://yourblog.com"
                        value={wpUrl}
                        onChange={(e) => setWpUrl(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            placeholder="Username"
                            value={wpUser}
                            onChange={(e) => setWpUser(e.target.value)}
                        />
                        <div className="relative">
                            <Input
                                type={showKey ? "text" : "password"}
                                placeholder="App Password"
                                value={wpPass}
                                onChange={(e) => setWpPass(e.target.value)}
                                className="pr-9"
                            />
                            <button
                                type="button"
                                onClick={onToggleShow}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        disabled={!wpUrl || !wpUser || !wpPass || testing || isPending}
                        onClick={() => onSave(wpUrl, wpUser, wpPass)}
                    >
                        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test & Save"}
                    </Button>
                </>
            )}
        </div>
    )
}
