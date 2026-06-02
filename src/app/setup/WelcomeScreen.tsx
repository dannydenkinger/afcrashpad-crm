"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    Hexagon,
    Rocket,
    FileText,
    Mail,
    Calendar as CalendarIcon,
    Bot,
    Loader2,
    ArrowRight,
    Check,
} from "lucide-react"
import { toast } from "sonner"
import { completeSetup } from "./actions"
import { loadSampleData } from "@/app/dashboard/sample-data-actions"
import { trackClient } from "@/lib/posthog/client"

/**
 * Post-signup welcome screen — replaces the old 5-step wizard.
 *
 * Two big choices ("demo data" vs "start fresh") + a few optional inline
 * integration shortcuts. Total time-to-dashboard: under 60 seconds.
 *
 * Design language matches /login + /register — two-column on desktop,
 * GlassInputWrapper-style cards, violet hero panel on the right.
 */
export function WelcomeScreen({
    userName,
    googleConnected,
    gmailConnected,
    anthropicConnected,
    plan,
}: {
    userName: string
    googleConnected: boolean
    gmailConnected: boolean
    anthropicConnected: boolean
    plan?: "pro" | "max" | null
}) {
    const router = useRouter()
    const [pendingPath, setPendingPath] = useState<"demo" | "fresh" | null>(null)
    const [isPending, startTransition] = useTransition()

    const finish = (path: "demo" | "fresh") => {
        setPendingPath(path)
        startTransition(async () => {
            try {
                if (path === "demo") {
                    const res = await loadSampleData()
                    if (!res.success) {
                        toast.error("Couldn't load demo data — taking you to an empty workspace instead.")
                    } else {
                        toast.success(`Loaded ${res.counts?.contacts || 0} sample contacts to get you started`)
                    }
                }
                await completeSetup()
                trackClient({ name: "setup_completed", props: { path } })
                router.push(plan ? `/settings/billing?upgrade=${plan}` : "/dashboard")
            } catch (err) {
                console.error("Setup completion failed:", err)
                toast.error("Something went wrong. You can re-run setup from settings.")
                setPendingPath(null)
            }
        })
    }

    const firstName = (userName || "").trim().split(" ")[0] || "there"

    return (
        <div className="min-h-[100dvh] flex flex-col md:flex-row w-[100dvw]">
            {/* Left column: setup choices */}
            <section className="flex-1 flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
                <div className="w-full max-w-lg">
                    <div className="flex flex-col gap-6">
                        <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight">
                            <span className="font-light text-foreground tracking-tighter">
                                Welcome, {firstName}
                            </span>
                        </h1>
                        <p className="animate-element animate-delay-200 text-muted-foreground">
                            Pick how you&apos;d like to start. You can change anything from settings later.
                        </p>

                        {/* Two-path choice */}
                        <div className="space-y-3">
                            <PathCard
                                accent="violet"
                                icon={<Rocket className="h-5 w-5" />}
                                title="Try with demo data"
                                description="Loads ~10 sample contacts, deals, and tasks so the dashboard isn't empty. Wipe in one click later."
                                badge="Recommended for exploring"
                                loading={pendingPath === "demo"}
                                disabled={isPending}
                                onClick={() => finish("demo")}
                                animateDelay={300}
                            />
                            <PathCard
                                accent="indigo"
                                icon={<FileText className="h-5 w-5" />}
                                title="Start fresh"
                                description="Empty workspace — bring your own data. Add contacts and deals as you go."
                                badge="Recommended if migrating"
                                loading={pendingPath === "fresh"}
                                disabled={isPending}
                                onClick={() => finish("fresh")}
                                animateDelay={400}
                            />
                        </div>

                        {/* Divider */}
                        <div className="animate-element animate-delay-500 relative flex items-center justify-center pt-2">
                            <span className="w-full border-t border-border"></span>
                            <span className="px-4 text-xs uppercase tracking-wider text-muted-foreground bg-background absolute">
                                Optional · connect later
                            </span>
                        </div>

                        {/* Integration shortcuts */}
                        <div className="animate-element animate-delay-600 grid grid-cols-1 gap-2">
                            <IntegrationShortcut
                                icon={<CalendarIcon className="h-4 w-4" />}
                                label="Google Calendar"
                                description="Sync events both ways"
                                connected={googleConnected}
                                href="/api/auth/google?returnTo=/setup"
                            />
                            <IntegrationShortcut
                                icon={<Mail className="h-4 w-4" />}
                                label="Gmail"
                                description="Send + receive in-app"
                                connected={gmailConnected}
                                href="/api/auth/gmail?returnTo=/setup"
                            />
                            <IntegrationShortcut
                                icon={<Bot className="h-4 w-4" />}
                                label="AI provider"
                                description="Write-with-AI, automation nodes"
                                connected={anthropicConnected}
                                href="/settings/integrations/ai-routing"
                            />
                        </div>

                        {/* Footer */}
                        <p className="animate-element animate-delay-700 text-center text-sm text-muted-foreground">
                            Already set up?{" "}
                            <Link href="/dashboard" className="text-violet-400 hover:underline transition-colors">
                                Skip to dashboard →
                            </Link>
                        </p>
                    </div>
                </div>
            </section>

            {/* Right column: hero panel */}
            <section className="hidden md:block flex-1 relative p-4">
                <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-gradient-to-br from-violet-600/20 via-indigo-600/20 to-purple-700/20 border border-white/5 overflow-hidden">
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                        <div className="space-y-6">
                            <div className="animate-element animate-delay-500 h-20 w-20 mx-auto rounded-2xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center backdrop-blur-sm">
                                <Hexagon className="h-10 w-10 text-violet-500" />
                            </div>
                            <h2 className="animate-element animate-delay-600 text-3xl font-semibold text-foreground/90 tracking-tight">
                                You&apos;re in
                            </h2>
                            <p className="animate-element animate-delay-700 text-lg text-muted-foreground max-w-sm mx-auto leading-relaxed">
                                Your workspace is ready. Take one minute now, or skip ahead — the sidebar checklist will walk you through anything you miss.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

function PathCard({
    accent,
    icon,
    title,
    description,
    badge,
    loading,
    disabled,
    onClick,
    animateDelay,
}: {
    accent: "violet" | "indigo"
    icon: React.ReactNode
    title: string
    description: string
    badge?: string
    loading: boolean
    disabled: boolean
    onClick: () => void
    animateDelay: number
}) {
    const accentBg = accent === "violet"
        ? "bg-violet-500/15 text-violet-400 border-violet-400/30 group-hover:bg-violet-500/25"
        : "bg-indigo-500/15 text-indigo-400 border-indigo-400/30 group-hover:bg-indigo-500/25"
    const focusRing = accent === "violet"
        ? "hover:border-violet-400/70 hover:bg-violet-500/10"
        : "hover:border-indigo-400/70 hover:bg-indigo-500/10"

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`group animate-element rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm p-5 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${focusRing}`}
            style={{ animationDelay: `${animateDelay}ms` }}
        >
            <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${accentBg}`}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base flex items-center gap-1.5">
                        {title}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {description}
                    </p>
                    {badge && (
                        <div className="inline-flex items-center mt-3 px-2 py-0.5 rounded-full bg-muted/40 border border-border text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                            {badge}
                        </div>
                    )}
                </div>
            </div>
        </button>
    )
}

function IntegrationShortcut({
    icon,
    label,
    description,
    connected,
    href,
}: {
    icon: React.ReactNode
    label: string
    description: string
    connected: boolean
    href: string
}) {
    return (
        <Link
            href={href}
            className={`group flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                connected
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border bg-foreground/5 backdrop-blur-sm hover:border-violet-400/70 hover:bg-violet-500/10"
            }`}
        >
            <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    connected
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-foreground/10 text-muted-foreground group-hover:bg-violet-500/20 group-hover:text-violet-400"
                }`}
            >
                {connected ? <Check className="h-4 w-4" /> : icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight">{label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
                    {connected ? "Connected" : description}
                </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        </Link>
    )
}
