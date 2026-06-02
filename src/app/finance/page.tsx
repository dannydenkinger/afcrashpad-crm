import Link from "next/link"
import { requireAuth } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import {
    ArrowRight,
    DollarSign,
    Receipt,
    Send,
    TrendingUp,
    UserCheck,
    Wallet,
} from "lucide-react"

export const dynamic = "force-dynamic"

interface CountTotals {
    revenueThisMonth: number
    revenueYTD: number
    expensesThisMonth: number
    expensesYTD: number
    pendingCommissions: number
    pendingPayouts: number
}

async function loadTotals(workspaceId: string): Promise<CountTotals> {
    // Best-effort aggregations across the existing finance collections.
    // We keep this defensive — missing collections shouldn't crash the hub.
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const out: CountTotals = {
        revenueThisMonth: 0,
        revenueYTD: 0,
        expensesThisMonth: 0,
        expensesYTD: 0,
        pendingCommissions: 0,
        pendingPayouts: 0,
    }

    try {
        const revSnap = await adminDb
            .collection("revenue_entries")
            .where("workspaceId", "==", workspaceId)
            .limit(1000)
            .get()
        for (const d of revSnap.docs) {
            const data = d.data()
            const amount = Number(data.amount) || 0
            const dateRaw = data.date
            const date =
                typeof (dateRaw as { toDate?: () => Date })?.toDate === "function"
                    ? (dateRaw as { toDate: () => Date }).toDate()
                    : dateRaw
                      ? new Date(dateRaw)
                      : null
            if (date && !isNaN(date.getTime())) {
                if (date >= yearStart) out.revenueYTD += amount
                if (date >= monthStart) out.revenueThisMonth += amount
            }
        }
    } catch {
        /* collection might not exist yet */
    }

    try {
        const expSnap = await adminDb
            .collection("expenses")
            .where("workspaceId", "==", workspaceId)
            .limit(1000)
            .get()
        for (const d of expSnap.docs) {
            const data = d.data()
            const amount = Number(data.amount) || 0
            const dateRaw = data.date
            const date =
                typeof (dateRaw as { toDate?: () => Date })?.toDate === "function"
                    ? (dateRaw as { toDate: () => Date }).toDate()
                    : dateRaw
                      ? new Date(dateRaw)
                      : null
            if (date && !isNaN(date.getTime())) {
                if (date >= yearStart) out.expensesYTD += amount
                if (date >= monthStart) out.expensesThisMonth += amount
            }
        }
    } catch {
        /* ignore */
    }

    try {
        const commSnap = await adminDb
            .collection("commissions")
            .where("workspaceId", "==", workspaceId)
            .where("status", "in", ["pending", "owed"])
            .limit(500)
            .get()
        for (const d of commSnap.docs) {
            out.pendingCommissions += Number(d.data().amount) || 0
        }
    } catch {
        /* ignore — status filter mismatch is fine */
    }

    try {
        const refSnap = await adminDb
            .collection("referrals")
            .where("workspaceId", "==", workspaceId)
            .where("payoutStatus", "==", "form_submitted")
            .limit(500)
            .get()
        for (const d of refSnap.docs) {
            out.pendingPayouts += Number(d.data().payoutAmount) || 0
        }
    } catch {
        /* ignore */
    }

    return out
}

export default async function FinanceHubPage() {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const totals = await loadTotals(workspaceId)

    const netThisMonth = totals.revenueThisMonth - totals.expensesThisMonth
    const netYTD = totals.revenueYTD - totals.expensesYTD

    return (
        <div className="container mx-auto max-w-6xl py-8 px-4 space-y-8">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-500/5 via-card to-blue-500/5">
                <div
                    aria-hidden
                    className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"
                />
                <div
                    aria-hidden
                    className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"
                />
                <div className="relative p-6 md:p-8">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full mb-3">
                        <Wallet className="w-3 h-3" />
                        Finance
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight">
                        The money side of the business.
                    </h1>
                    <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                        Revenue in, expenses out, commissions owed, payouts pending —
                        all in one place.
                    </p>
                </div>

                {/* KPI strip */}
                <div className="relative grid grid-cols-2 md:grid-cols-4 border-t bg-card/40 backdrop-blur">
                    <HeroStat
                        Icon={TrendingUp}
                        label="Revenue (MTD)"
                        value={formatCurrency(totals.revenueThisMonth)}
                        sub={`${formatCurrency(totals.revenueYTD)} YTD`}
                        accent="emerald"
                    />
                    <HeroStat
                        Icon={Receipt}
                        label="Expenses (MTD)"
                        value={formatCurrency(totals.expensesThisMonth)}
                        sub={`${formatCurrency(totals.expensesYTD)} YTD`}
                        accent="rose"
                    />
                    <HeroStat
                        Icon={DollarSign}
                        label="Net (MTD)"
                        value={formatCurrency(netThisMonth)}
                        sub={`${formatCurrency(netYTD)} YTD`}
                        accent={netThisMonth >= 0 ? "blue" : "amber"}
                    />
                    <HeroStat
                        Icon={Send}
                        label="Owed to others"
                        value={formatCurrency(totals.pendingCommissions + totals.pendingPayouts)}
                        sub={`${formatCurrency(totals.pendingCommissions)} commissions · ${formatCurrency(totals.pendingPayouts)} payouts`}
                        accent="amber"
                    />
                </div>
            </div>

            {/* Channel tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <FinanceTile
                    href="/finance/revenue"
                    Icon={TrendingUp}
                    title="Revenue"
                    description="Booked deals, paid invoices, outstanding balances."
                    accent="emerald"
                />
                <FinanceTile
                    href="/finance/expenses"
                    Icon={Receipt}
                    title="Expenses"
                    description="Log spend, attach receipts, categorize for taxes."
                    accent="rose"
                />
                <FinanceTile
                    href="/finance/commissions"
                    Icon={DollarSign}
                    title="Commissions"
                    description="Agent splits, owed amounts, payout status."
                    accent="violet"
                />
                <FinanceTile
                    href="/finance/referrals"
                    Icon={UserCheck}
                    title="Referrals"
                    description="Sources, conversion stages, payouts owed to referrers."
                    accent="blue"
                />
                <FinanceTile
                    href="/finance/forecasting"
                    Icon={TrendingUp}
                    title="Forecasting"
                    description="Pipeline-weighted projections by month and quarter."
                    accent="amber"
                />
                <FinanceTile
                    href="/finance/payouts"
                    Icon={Send}
                    title="Payouts"
                    description="Send payout forms, track recipient submissions."
                    accent="emerald"
                />
            </div>
        </div>
    )
}

function HeroStat({
    Icon,
    label,
    value,
    sub,
    accent,
}: {
    Icon: React.ComponentType<{ className?: string }>
    label: string
    value: string
    sub?: string
    accent: "emerald" | "blue" | "rose" | "amber"
}) {
    const tone = {
        emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
        blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
        rose: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
        amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    }[accent]
    return (
        <div className="px-5 py-4 border-r last:border-r-0 flex items-start gap-3">
            <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}
            >
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {label}
                </div>
                <div className="text-xl font-semibold tabular-nums leading-tight">
                    {value}
                </div>
                {sub && (
                    <div className="text-[10px] text-muted-foreground/80 tabular-nums mt-0.5 truncate">
                        {sub}
                    </div>
                )}
            </div>
        </div>
    )
}

function FinanceTile({
    href,
    Icon,
    title,
    description,
    accent,
}: {
    href: string
    Icon: React.ComponentType<{ className?: string }>
    title: string
    description: string
    accent: "emerald" | "blue" | "violet" | "amber" | "rose"
}) {
    const tone = {
        emerald: { gradient: "from-emerald-500/30 to-emerald-500/0", icon: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
        blue: { gradient: "from-blue-500/30 to-blue-500/0", icon: "text-blue-600 dark:text-blue-400 bg-blue-500/10" },
        violet: { gradient: "from-violet-500/30 to-violet-500/0", icon: "text-violet-600 dark:text-violet-400 bg-violet-500/10" },
        amber: { gradient: "from-amber-500/30 to-amber-500/0", icon: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
        rose: { gradient: "from-rose-500/30 to-rose-500/0", icon: "text-rose-600 dark:text-rose-400 bg-rose-500/10" },
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

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(amount)
}
