import {
    computeOnboardingFunnel,
    computeSignupCohorts,
    listWorkspaces,
} from "@/lib/admin/queries"
import { formatNumber, formatPercent } from "@/lib/admin/format"

export const dynamic = "force-dynamic"

export default async function FunnelsPage() {
    const rows = await listWorkspaces()
    const funnel = computeOnboardingFunnel(rows)
    const cohorts = computeSignupCohorts(rows)

    const maxStep = Math.max(1, ...funnel.steps.map((s) => s.count))

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">Funnels</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Funnel + cohort views derived from Firestore. PostHog-powered event funnels
                    show up in the PostHog dashboard once events flow.
                </p>
            </header>

            <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold">{funnel.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">{funnel.description}</p>
                <div className="space-y-2">
                    {funnel.steps.map((step, idx) => {
                        const prev = idx > 0 ? funnel.steps[idx - 1].count : null
                        const stepToStepPct = prev && prev > 0 ? (step.count / prev) * 100 : null
                        return (
                            <div key={step.label} className="space-y-1">
                                <div className="flex items-baseline justify-between text-xs">
                                    <span>
                                        {idx + 1}. {step.label}
                                    </span>
                                    <span className="font-mono">
                                        {formatNumber(step.count)}
                                        <span className="text-muted-foreground ml-1.5">
                                            ({formatPercent(step.pct, 0)})
                                        </span>
                                        {stepToStepPct != null && (
                                            <span className="text-muted-foreground ml-2 text-[10px]">
                                                step Δ {formatPercent(stepToStepPct, 0)}
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                                        style={{
                                            width: `${(step.count / maxStep) * 100}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold">Signup cohorts — by ISO week</h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">
                    Last 12 weeks with signups. Conversion = % of that week&apos;s signups
                    currently on a paid plan.
                </p>
                {cohorts.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No signups yet.</p>
                ) : (
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-left text-muted-foreground">
                                <th className="py-1 font-medium">Cohort</th>
                                <th className="py-1 font-medium text-right">Workspaces</th>
                                <th className="py-1 font-medium text-right">Paid</th>
                                <th className="py-1 font-medium text-right">Conversion</th>
                                <th className="py-1 font-medium">&nbsp;</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cohorts.map((c) => (
                                <tr key={c.cohort} className="border-t">
                                    <td className="py-1.5 font-mono">{c.cohort}</td>
                                    <td className="py-1.5 text-right">
                                        {formatNumber(c.workspaces)}
                                    </td>
                                    <td className="py-1.5 text-right">{formatNumber(c.paid)}</td>
                                    <td className="py-1.5 text-right font-mono">
                                        {formatPercent(c.conversionPct, 0)}
                                    </td>
                                    <td className="py-1.5 pl-3 w-[40%]">
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500"
                                                style={{
                                                    width: `${Math.min(100, c.conversionPct)}%`,
                                                }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    )
}
