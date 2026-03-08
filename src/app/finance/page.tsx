"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CommissionTracker } from "@/app/dashboard/commissions/CommissionTracker"
import { ReferralTracker } from "@/app/dashboard/referrals/ReferralTracker"
import { RevenueTracker } from "./RevenueTracker"

export default function FinancePage() {
    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Finance
                        </h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Track commissions, referral payouts, revenue, and agent earnings.</p>
                    </div>
                </div>

                <Tabs defaultValue="commissions" className="space-y-6">
                    <TabsList className="bg-muted/30 border border-white/5 flex-wrap h-auto gap-0.5 p-1">
                        <TabsTrigger value="commissions" className="text-xs font-semibold">Commissions</TabsTrigger>
                        <TabsTrigger value="referrals" className="text-xs font-semibold">Referrals</TabsTrigger>
                        <TabsTrigger value="revenue" className="text-xs font-semibold">Revenue</TabsTrigger>
                    </TabsList>

                    <TabsContent value="commissions" className="m-0">
                        <CommissionTracker />
                    </TabsContent>

                    <TabsContent value="referrals" className="m-0">
                        <ReferralTracker />
                    </TabsContent>

                    <TabsContent value="revenue" className="m-0">
                        <RevenueTracker />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
