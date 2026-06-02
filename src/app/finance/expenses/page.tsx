"use client"

import { ExpenseTracker } from "../ExpenseTracker"
import {
    FinanceDateFilter,
    exportVisibleTableCsv,
    useDateFilter,
} from "../FinanceDateFilter"

export default function FinanceExpensesPage() {
    const { range, setRange, value } = useDateFilter()
    return (
        <div className="container mx-auto max-w-6xl py-6 px-4 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Expenses</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Log business expenses, attach receipts, and categorize spend.
                    </p>
                </div>
                <FinanceDateFilter
                    range={range}
                    onChange={setRange}
                    onExport={() => exportVisibleTableCsv("finance-expenses")}
                />
            </div>
            <ExpenseTracker dateFilter={value} />
        </div>
    )
}
