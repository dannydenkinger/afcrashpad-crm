"use client"

import { CommissionTracker } from "@/app/dashboard/commissions/CommissionTracker"
import {
    FinanceDateFilter,
    exportVisibleTableCsv,
    useDateFilter,
} from "../FinanceDateFilter"

export default function FinanceCommissionsPage() {
    const { range, setRange, value } = useDateFilter()
    return (
        <div className="container mx-auto max-w-6xl py-6 px-4 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Commissions</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Track agent commissions, splits, and payout status.
                    </p>
                </div>
                <FinanceDateFilter
                    range={range}
                    onChange={setRange}
                    onExport={() => exportVisibleTableCsv("finance-commissions")}
                />
            </div>
            <CommissionTracker dateFilter={value} />
        </div>
    )
}
