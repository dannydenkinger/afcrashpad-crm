"use client"

import Link from "next/link"
import { ReferralTracker } from "@/app/dashboard/referrals/ReferralTracker"

/**
 * Money-out view: which referrals have unlocked a payout, which are owed
 * vs paid, and tools to send payout forms. Backed by the same `referrals`
 * collection as /finance/referrals but defaults the filter to "Payout
 * Due" and trims out the funnel-relationship UI.
 */
export default function FinancePayoutsPage() {
    return (
        <div className="container mx-auto max-w-6xl py-6 px-4 space-y-5">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Payouts</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Money out to referrers and partners. Send the payout form to collect their preferred method, then mark as paid. See the funnel on <Link href="/finance/referrals" className="underline-offset-2 hover:underline text-foreground">Referrals</Link>.
                </p>
            </div>
            <ReferralTracker dateFilter={null} viewContext="payouts" />
        </div>
    )
}
