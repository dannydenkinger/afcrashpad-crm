"use client"

import { RevenueTracker } from "../RevenueTracker"
import {
    FinanceDateFilter,
    exportVisibleTableCsv,
    useDateFilter,
} from "../FinanceDateFilter"

export default function FinanceRevenuePage() {
    const { range, setRange, value } = useDateFilter()
    return (
        <div className="container mx-auto max-w-6xl py-6 px-4 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Revenue</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Track booked revenue, paid invoices, and outstanding balances.
                    </p>
                </div>
                <FinanceDateFilter
                    range={range}
                    onChange={setRange}
                    onExport={() => exportVisibleTableCsv("finance-revenue")}
                />
            </div>
            <RevenueTracker dateFilter={value} />
        </div>
    )
}
