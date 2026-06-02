import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { adminDb } from "@/lib/firebase-admin"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { WelcomeScreen } from "./WelcomeScreen"

export const dynamic = "force-dynamic"

/**
 * Post-signup welcome screen. Replaces the old 5-step wizard with a
 * single-page picker (demo data vs empty workspace + optional integration
 * shortcuts). Anything not done here is surfaced in the persistent
 * sidebar checklist after the user enters the app.
 *
 * If the workspace already finished setup, send them straight to the
 * dashboard so re-visiting /setup doesn't re-onboard.
 */
export default async function SetupPage({
    searchParams,
}: {
    searchParams: Promise<{ plan?: string }>
}) {
    const session = await auth()
    if (!session?.user?.email) redirect("/login")
    const { plan: planParam } = await searchParams
    const plan = planParam === "pro" || planParam === "max" ? planParam : null

    // Cheap status check — used to gate the redirect + populate the
    // "connected/not connected" pills on integration shortcuts.
    let status: {
        setupCompleted: boolean
        google: boolean
        gmail: boolean
        anthropic: boolean
    } = { setupCompleted: false, google: false, gmail: false, anthropic: false }
    let loadError: string | null = null

    try {
        const { getSetupStatus } = await import("./actions")
        const fetched = await getSetupStatus()
        const workspaceId = session.user.workspaceId
        const userId = session.user.id

        // Gmail is per-user — check the gmail_integrations doc instead of
        // the workspace integrations bag.
        let gmailConnected = false
        if (workspaceId && userId) {
            const gmailDoc = await adminDb
                .collection("gmail_integrations")
                .doc(`${workspaceId}_${userId}`)
                .get()
            gmailConnected = gmailDoc.exists && !!gmailDoc.data()?.refreshToken
        }

        status = {
            setupCompleted: fetched.setupCompleted,
            google: fetched.google.calendarConnected,
            gmail: gmailConnected,
            anthropic: fetched.anthropic.connected,
        }
    } catch (err) {
        loadError = err instanceof Error ? err.message : "Unknown error"
        console.error("getSetupStatus failed:", err)
    }

    if (loadError) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center space-y-4 p-6 sm:p-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm animate-element">
                    <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold">Couldn&apos;t load your setup state</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Reload to try again, or skip to the dashboard — you can finish setup
                            from the sidebar checklist anytime.
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 mt-3 font-mono break-words">
                            {loadError}
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <Link href="/setup"><Button>Reload</Button></Link>
                        <Link href="/dashboard"><Button variant="outline">Skip to dashboard</Button></Link>
                    </div>
                </div>
            </div>
        )
    }

    if (status.setupCompleted) {
        redirect(plan ? `/settings/billing?upgrade=${plan}` : "/dashboard")
    }

    const userName = session.user.name || ""

    return (
        <WelcomeScreen
            userName={userName}
            googleConnected={status.google}
            gmailConnected={status.gmail}
            anthropicConnected={status.anthropic}
            plan={plan}
        />
    )
}
