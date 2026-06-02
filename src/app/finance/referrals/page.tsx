"use client"

import Link from "next/link"
import { ReferralTracker } from "@/app/dashboard/referrals/ReferralTracker"
import {
    FinanceDateFilter,
    exportVisibleTableCsv,
    useDateFilter,
} from "../FinanceDateFilter"

export default function FinanceReferralsPage() {
    const { range, setRange, value } = useDateFilter()
    return (
        <div className="container mx-auto max-w-6xl py-6 px-4 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Referrals</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Funnel view — who referred whom, conversion through each stage, top referrers. Manage payouts on the <Link href="/finance/payouts" className="underline-offset-2 hover:underline text-foreground">Payouts</Link> page.
                    </p>
                </div>
                <FinanceDateFilter
                    range={range}
                    onChange={setRange}
                    onExport={() => exportVisibleTableCsv("finance-referrals")}
                />
            </div>
            <ReferralTracker dateFilter={value} />
        </div>
    )
}
