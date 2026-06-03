import { notFound } from "next/navigation"

export default function PricingPage() {
    // Single-org deployment: the SaaS pricing page is not exposed.
    notFound()
}
