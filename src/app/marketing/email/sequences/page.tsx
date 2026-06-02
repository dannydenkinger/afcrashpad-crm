import Link from "next/link"
import { requireAuth } from "@/lib/auth-guard"
import { listAutomations } from "@/lib/automations/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, Mail, Plus, Sparkles, Zap, Pencil } from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"
import type { AutomationNode } from "@/lib/automations/types"

export const dynamic = "force-dynamic"

const TRIGGER_LABELS: Record<string, string> = {
    contact_created: "When a contact is created",
    contact_added_to_list: "When added to a list",
    tag_added: "When a tag is added",
    form_submitted: "When a form is submitted",
    pipeline_stage_entered: "When stage changes",
    opportunity_created: "When opportunity created",
    opportunity_won: "When opportunity won",
    opportunity_lost: "When opportunity lost",
    opportunity_value_changed: "When deal value changes",
    opportunity_stale: "When deal goes stale",
    email_opened: "When email is opened",
    email_clicked: "When email is clicked",
    contact_field_updated: "When field updates",
    sms_replied: "When SMS reply received",
    appointment_booked: "When appointment booked",
    birthday: "On contact's birthday",
    anniversary: "On contact's anniversary",
    webhook_in: "Via external webhook",
    manual: "Manual / API",
}

/**
 * Email drip sequences are just automations whose first action is an email.
 * We surface them in a dedicated route so people don't have to think in
 * "automation" terms — they pick a trigger, write the emails, and we
 * present the chain as a linear sequence.
 */
function isEmailFirst(nodes: AutomationNode[]): boolean {
    if (!nodes.length) return false
    const first = nodes[0]
    return first.type === "send_email" || first.type === "ai_send_email"
}

function countEmailSteps(nodes: AutomationNode[]): number {
    return nodes.filter((n) => n.type === "send_email" || n.type === "ai_send_email").length
}

export default async function EmailSequencesPage() {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const automations = await listAutomations(workspaceId)

    // Email-led sequences only — anything else stays in /automations
    const sequences = automations.filter((a) => isEmailFirst(a.nodes))

    return (
        <div className="container mx-auto max-w-5xl py-8 px-4 space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <Link
                        href="/marketing/email"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
                    >
                        <ArrowLeft className="w-3 h-3" />
                        Email
                    </Link>
                    <h1 className="text-2xl font-semibold tracking-tight">Email sequences</h1>
                    <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
                        Multi-step email flows triggered by contact, list, tag, or opportunity events.
                        A sequence is an automation whose first step is an email — so you get conditional
                        wait steps, branching, and goal exits for free.
                    </p>
                </div>
                <Link href="/automations/new">
                    <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        New sequence
                    </Button>
                </Link>
            </div>

            {sequences.length === 0 ? (
                <Card>
                    <CardContent className="py-2">
                        <EmptyState
                            Icon={Mail}
                            accent="violet"
                            title="No email sequences yet"
                            description="Build a welcome series, lead nurture flow, or post-purchase follow-up. Sequences fire automatically when a contact matches the trigger."
                            action={{ label: "New sequence", href: "/automations/new" }}
                            secondaryAction={{ label: "Browse starters", href: "/automations" }}
                        />
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {sequences.map((seq) => {
                        const emailCount = countEmailSteps(seq.nodes)
                        const triggerLabel = TRIGGER_LABELS[seq.trigger.type] || seq.trigger.type
                        return (
                            <Link key={seq.id} href={`/automations/${seq.id}`}>
                                <div className="group rounded-xl border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                                        <Mail className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-sm truncate">{seq.name || "Untitled sequence"}</span>
                                            {seq.enabled ? (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border">
                                                    Paused
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Zap className="w-3 h-3" />
                                                {triggerLabel}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" />
                                                {emailCount} email{emailCount === 1 ? "" : "s"}
                                                {seq.nodes.length > emailCount && (
                                                    <span className="opacity-60"> + {seq.nodes.length - emailCount} other step{(seq.nodes.length - emailCount) === 1 ? "" : "s"}</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Pencil className="w-3 h-3" />
                                        Edit
                                        <ArrowRight className="w-3 h-3" />
                                    </Button>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
