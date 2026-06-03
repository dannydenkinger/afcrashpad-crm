import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default function BillingSettingsPage() {
    // Single-org deployment: billing/credits UI is gated off. The billing
    // actions (getPlanStatus/openCustomerPortal) remain in actions.ts because
    // they're still consumed by PaymentStatusBanner and useWorkspacePlan.
    notFound()
}
