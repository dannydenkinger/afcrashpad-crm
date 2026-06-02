import Link from "next/link"
import { requireAuth } from "@/lib/auth-guard"
import { listAutomations } from "@/lib/automations/store"
import { STARTER_AUTOMATIONS } from "@/lib/automations/starters"
import { Button } from "@/components/ui/button"
import { Plus, Workflow } from "lucide-react"
import { AutomationListClient } from "./AutomationListClient"
import { StarterGrid } from "./StarterGrid"
import { FirstVisitHint } from "@/components/FirstVisitHint"
import { PlanLocked } from "@/components/PlanLocked"
import { getWorkspacePlan } from "@/lib/billing/plans-server"
import { hasFeature } from "@/lib/billing/plans"

export const dynamic = "force-dynamic"

export default async function AutomationsPage() {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const plan = await getWorkspacePlan(workspaceId)

    // Free tier doesn't have automations — show the lock screen instead
    // of the empty/starter UI. Existing paid customers who downgrade can
    // still see their automation list at /automations/<id> directly; new
    // creation is gated server-side via requirePlan in actions.
    if (!hasFeature(plan.tier, "automations")) {
        return (
            <div className="container mx-auto max-w-5xl py-10 px-4 space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-2">
                        <Workflow className="w-6 h-6 text-primary" />
                        Automations
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        Trigger emails, tags, and list actions automatically when something
                        happens — a contact signs up, joins a list, or moves through your
                        pipeline.
                    </p>
                </div>
                <PlanLocked
                    feature="Automations"
                    requiredTier="pro"
                    currentTier={plan.tier}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {STARTER_AUTOMATIONS.slice(0, 4).map((s) => (
                            <div
                                key={s.slug}
                                className="rounded-xl border bg-card p-4"
                            >
                                <div className="text-sm font-semibold">{s.name}</div>
                                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    {s.description}
                                </div>
                            </div>
                        ))}
                    </div>
                </PlanLocked>
            </div>
        )
    }

    const automations = await listAutomations(workspaceId)

    return (
        <div className="container mx-auto max-w-5xl py-10 px-4 space-y-10">
            <FirstVisitHint
                pageKey="automations"
                text="Automations fire when something happens — a contact signs up, a deal moves stage, etc. Pick a starter template below or build from scratch."
            />
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-2">
                        <Workflow className="w-6 h-6 text-primary" />
                        Automations
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        Trigger emails, tags, and list actions automatically when something
                        happens — a contact signs up, joins a list, or moves through your
                        pipeline.
                    </p>
                </div>
                <Link href="/automations/new">
                    <Button className="gap-1.5 shadow-sm">
                        <Plus className="w-4 h-4" />
                        New automation
                    </Button>
                </Link>
            </div>

            {automations.length > 0 && (
                <section className="space-y-3">
                    <AutomationListClient initialAutomations={automations} />
                </section>
            )}

            <section className="space-y-3">
                <div>
                    <h2 className="text-base font-semibold tracking-tight">
                        Start from a template
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Fork a pre-built workflow and customize. All start disabled so you
                        can review before going live.
                    </p>
                </div>
                <StarterGrid
                    starters={STARTER_AUTOMATIONS.map((s) => ({
                        slug: s.slug,
                        name: s.name,
                        description: s.description,
                        category: s.category,
                    }))}
                />
            </section>
        </div>
    )
}
