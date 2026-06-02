import { PublicNav } from "@/components/marketing/PublicNav"
import { PublicFooter } from "@/components/marketing/PublicFooter"
import PricingTable from "@/components/marketing/PricingTable"
import type { Plan } from "@/components/marketing/PricingTable"
import { PLANS } from "@/lib/billing/plans"

export const metadata = {
    title: "Pricing | Vesta CRM",
}

const plans: Plan[] = [
    {
        title: PLANS.free.name,
        price: {
            monthly: PLANS.free.monthlyCents / 100,
            yearly: PLANS.free.yearlyCents / 100,
        },
        description: PLANS.free.tagline,
        ctaText: "Start free",
        ctaHref: "/register",
        features: [
            "1 seat, no time limit",
            "Up to 1,000 contacts",
            "Pipeline, tasks, calendar, comms",
            "100 credits/month for email + AI",
            "Bring your own AI keys",
        ],
    },
    {
        title: PLANS.pro.name,
        price: {
            monthly: PLANS.pro.monthlyCents / 100,
            yearly: PLANS.pro.yearlyCents / 100,
        },
        description: PLANS.pro.tagline,
        ctaText: "Get Pro",
        ctaHref: "/register?plan=pro",
        isFeatured: true,
        features: [
            "3 seats included · $12/extra",
            "Unlimited contacts",
            "Automations + AI Write-with-AI",
            "Email marketing + e-signature",
            "Documents, finance, reputation",
            "2,500 credits/month + top-ups",
            "REST API + webhooks",
            "90-day audit log",
        ],
    },
    {
        title: PLANS.max.name,
        price: {
            monthly: PLANS.max.monthlyCents / 100,
            yearly: PLANS.max.yearlyCents / 100,
        },
        description: PLANS.max.tagline,
        ctaText: "Get Max",
        ctaHref: "/register?plan=max",
        features: [
            "10 seats included · $19/extra",
            "Everything in Pro, plus:",
            "AI blog generation + SEO module",
            "HARO opportunity feed",
            "White-label + sub-workspaces",
            "Granular role permissions",
            "25,000 credits/month",
            "Unlimited audit log retention",
            "Priority support, 4h response",
        ],
    },
]

export default function PricingPage() {
    return (
        <div className="landing-grain relative min-h-screen overflow-x-clip text-foreground">
            {/* Animated background orbs */}
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
                <div className="landing-orb-home landing-orb-home-1" />
                <div className="landing-orb-home landing-orb-home-2" />
                <div className="landing-orb-home landing-orb-home-3" />
                <div className="landing-orb-home landing-orb-home-4" />
            </div>

            <PublicNav />

            <main className="relative z-10 pt-24 pb-20">
                <PricingTable plans={plans} />
            </main>

            <PublicFooter />
        </div>
    )
}
