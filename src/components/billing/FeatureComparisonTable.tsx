"use client"

import { useState } from "react"
import { ChevronDown, Check, Minus } from "lucide-react"
import { PLANS, type PlanTier } from "@/lib/billing/plans"

/**
 * Collapsible feature-by-feature comparison of Free vs Pro vs Max.
 * Sits underneath the PricingCard in /settings/billing so users can
 * verify exactly what they get before clicking Upgrade.
 *
 * Groups are alternating bg to scan vertically; the current tier's
 * column is highlighted so the user knows what they already have.
 */

type CellValue = string | boolean | null

interface RowSpec {
    label: string
    value: (tier: PlanTier) => CellValue
}

interface GroupSpec {
    group: string
    rows: RowSpec[]
}

const GROUPS: GroupSpec[] = [
    {
        group: "Core CRM",
        rows: [
            { label: "Pipeline kanban + table", value: () => true },
            { label: "Contacts + activity timeline", value: () => true },
            { label: "Tasks + reminders", value: () => true },
            { label: "Calendar (Google sync)", value: () => true },
            { label: "Communications (email + SMS inbox)", value: () => true },
            {
                label: "Contacts cap",
                value: (t) =>
                    PLANS[t].limits.contactsCap
                        ? PLANS[t].limits.contactsCap.toLocaleString()
                        : "Unlimited",
            },
            {
                label: "Pipelines",
                value: (t) =>
                    PLANS[t].limits.pipelinesCap
                        ? String(PLANS[t].limits.pipelinesCap)
                        : "Unlimited",
            },
            {
                label: "Custom fields",
                value: (t) =>
                    PLANS[t].limits.customFieldsCap
                        ? String(PLANS[t].limits.customFieldsCap)
                        : "Unlimited",
            },
        ],
    },
    {
        group: "Team & access",
        rows: [
            { label: "Seats included", value: (t) => String(PLANS[t].limits.seatsIncluded) },
            {
                label: "Extra seat / month",
                value: (t) =>
                    PLANS[t].extraSeatCents > 0 ? `$${PLANS[t].extraSeatCents / 100}` : null,
            },
            { label: "Owner / Admin / Agent roles", value: () => true },
            { label: "Granular per-area permissions", value: (t) => PLANS[t].features.granularPermissions },
            {
                label: "Audit log retention",
                value: (t) => {
                    const d = PLANS[t].limits.auditLogRetentionDays
                    if (d === null) return "Unlimited"
                    if (d === 0) return null
                    return `${d} days`
                },
            },
        ],
    },
    {
        group: "Automation & AI",
        rows: [
            { label: "Visual workflow builder", value: (t) => PLANS[t].features.automations },
            { label: "Write-with-AI inline", value: (t) => PLANS[t].features.aiInlineWrite },
            { label: "AI Assistant chat", value: (t) => PLANS[t].features.aiAssistant },
            { label: "AI blog generation", value: (t) => PLANS[t].features.aiBlogGeneration },
            { label: "Bring your own AI keys", value: () => true },
        ],
    },
    {
        group: "Marketing",
        rows: [
            { label: "Email campaigns + lists", value: (t) => PLANS[t].features.emailMarketing },
            {
                label: "Forms (lead capture)",
                value: (t) => (PLANS[t].limits.formsCap ? String(PLANS[t].limits.formsCap) : "Unlimited"),
            },
            {
                label: "Booking pages",
                value: (t) =>
                    PLANS[t].limits.bookingPagesCap
                        ? String(PLANS[t].limits.bookingPagesCap)
                        : "Unlimited",
            },
            { label: "Social planner", value: (t) => PLANS[t].features.socialPlanner },
            { label: "Blog + AI articles", value: (t) => PLANS[t].features.aiBlogGeneration },
            { label: "SEO module", value: (t) => PLANS[t].features.seoModule },
            { label: "HARO opportunities", value: (t) => PLANS[t].features.haro },
            { label: "Reputation (reviews)", value: (t) => PLANS[t].features.reputation },
        ],
    },
    {
        group: "Operations",
        rows: [
            { label: "Documents + e-signature", value: (t) => PLANS[t].features.documentsAndEsign },
            { label: "Finance (forecasting, commissions)", value: (t) => PLANS[t].features.finance },
            { label: "Custom domain on forms/booking", value: (t) => PLANS[t].features.customDomainForms },
            { label: "White-label (remove Vesta branding)", value: (t) => PLANS[t].features.whiteLabel },
            { label: "Multiple workspaces", value: (t) => PLANS[t].features.multipleWorkspaces },
        ],
    },
    {
        group: "Credits & quotas",
        rows: [
            { label: "Monthly included credits", value: (t) => PLANS[t].limits.monthlyCredits.toLocaleString() },
            { label: "Top-up anytime ($5/1k)", value: () => true },
            { label: "Storage", value: (t) => `${PLANS[t].limits.storageGB} GB` },
        ],
    },
    {
        group: "Developer",
        rows: [
            { label: "REST API access", value: (t) => PLANS[t].features.apiAccess },
            { label: "Webhooks", value: (t) => PLANS[t].features.webhooks },
        ],
    },
    {
        group: "Support",
        rows: [
            { label: "Community + email support", value: () => true },
            { label: "Priority chat, 4h response", value: (t) => PLANS[t].features.prioritySupport },
        ],
    },
]

export function FeatureComparisonTable({ currentTier }: { currentTier: PlanTier }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className="rounded-2xl border bg-card overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                aria-expanded={expanded}
            >
                <div className="text-left">
                    <h3 className="text-sm font-semibold">
                        {expanded ? "Compare every feature" : "Compare every feature"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        See exactly what each plan unlocks — limits, features, support tier
                    </p>
                </div>
                <ChevronDown
                    className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                        expanded ? "rotate-180" : ""
                    }`}
                />
            </button>

            {expanded && (
                <div className="border-t">
                    <div className="overflow-x-auto">
                        <div className="min-w-[560px]">
                            {/* Sticky header */}
                            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] sticky top-0 bg-muted/30 backdrop-blur z-10 border-b">
                                <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Feature
                                </div>
                                {(["free", "pro", "max"] as const).map((t) => (
                                    <PlanColHeader
                                        key={t}
                                        tier={t}
                                        isCurrent={currentTier === t}
                                    />
                                ))}
                            </div>

                            {/* Groups */}
                            {GROUPS.map((group) => (
                                <Group key={group.group} group={group} currentTier={currentTier} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function PlanColHeader({ tier, isCurrent }: { tier: PlanTier; isCurrent: boolean }) {
    const plan = PLANS[tier]
    return (
        <div
            className={`px-3 py-2.5 border-l text-center ${
                isCurrent ? "bg-emerald-500/5" : tier === "pro" ? "bg-violet-500/5" : ""
            }`}
        >
            <div className="flex items-center justify-center gap-1.5">
                <span className="text-sm font-semibold">{plan.name}</span>
                {isCurrent && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-600">
                        Current
                    </span>
                )}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
                {tier === "free" ? "$0" : `$${plan.monthlyCents / 100}/mo`}
            </div>
        </div>
    )
}

function Group({
    group,
    currentTier,
}: {
    group: GroupSpec
    currentTier: PlanTier
}) {
    return (
        <div className="border-b last:border-b-0">
            <div className="px-4 py-2 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {group.group}
            </div>
            {group.rows.map((row) => (
                <Row key={row.label} row={row} currentTier={currentTier} />
            ))}
        </div>
    )
}

function Row({ row, currentTier }: { row: RowSpec; currentTier: PlanTier }) {
    return (
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b last:border-b-0 hover:bg-muted/10 transition-colors">
            <div className="px-4 py-2.5 text-xs text-foreground/90">{row.label}</div>
            {(["free", "pro", "max"] as const).map((t) => {
                const v = row.value(t)
                const isCurrent = currentTier === t
                return (
                    <div
                        key={t}
                        className={`px-3 py-2.5 border-l text-center text-xs ${
                            isCurrent ? "bg-emerald-500/5" : t === "pro" ? "bg-violet-500/5" : ""
                        }`}
                    >
                        <CellContents value={v} />
                    </div>
                )
            })}
        </div>
    )
}

function CellContents({ value }: { value: CellValue }) {
    if (value === true) {
        return <Check className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
    }
    if (value === false || value == null) {
        return <Minus className="h-3 w-3 text-muted-foreground/30 mx-auto" />
    }
    return <span className="text-foreground/85 tabular-nums">{value}</span>
}
