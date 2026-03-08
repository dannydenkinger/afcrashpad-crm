export type ReferralStatus = "pending" | "contacted" | "booked" | "active_tenant" | "paid" | "lost"

export type PayoutMethod = "zelle" | "venmo" | "paypal" | "check" | null

export interface Referral {
    id: string
    referrerName: string
    referrerEmail: string | null
    referrerPhone: string | null
    referrerContactId: string | null
    referredName: string
    referredEmail: string | null
    referredContactId: string | null
    referredOpportunityId: string | null
    status: ReferralStatus
    dealValue: number
    payoutAmount: number
    payoutPaidAt: string | null
    payoutToken: string | null
    payoutMethod: PayoutMethod
    payoutDetails: string | null
    payoutFormSentAt: string | null
    payoutFormSubmittedAt: string | null
    notes: string | null
    createdAt: string
    convertedAt: string | null
}

export interface ReferralsData {
    referrals: Referral[]
    totalReferrals: number
    activeTenantsCount: number
    paidCount: number
    conversionRate: number
    totalReferredRevenue: number
    totalPayoutsEarned: number
    totalPayoutsPaid: number
    totalPayoutsPending: number
    defaultPayoutAmount: number
    topReferrers: { name: string; email: string | null; count: number; activeCount: number; revenue: number; payoutsEarned: number }[]
}
