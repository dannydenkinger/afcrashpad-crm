import Link from "next/link"
import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { ScheduledReports } from "@/app/settings/reports/ScheduledReports"
import { ArrowRight, BarChart3 } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function FinanceReportsPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const role = (session.user as { role?: string }).role
    if (role !== "OWNER" && role !== "ADMIN") redirect("/finance")

    return (
        <div className="container mx-auto max-w-5xl py-6 px-4 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Reports</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    On-demand analytics and scheduled snapshots.
                </p>
            </div>

            {/* On-demand reports */}
            <div className="space-y-2">
                <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">On-demand</h2>
                <Link href="/finance/reports/attribution">
                    <div className="group rounded-xl border bg-card p-4 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                            <BarChart3 className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm">Source attribution</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                                Which lead sources drove the most opportunities, win rate, and revenue.
                            </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                </Link>
            </div>

            {/* Scheduled reports */}
            <div className="space-y-2">
                <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Scheduled</h2>
                <p className="text-xs text-muted-foreground">
                    Email recurring pipeline + revenue snapshots to yourself or your team on a daily, weekly, or monthly cadence.
                </p>
                <ScheduledReports />
            </div>
        </div>
    )
}
