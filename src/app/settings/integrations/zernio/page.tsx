import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default function ZernioIntegrationPage() {
    // Single-org deployment: the Zernio (Social Planner) integration is gated off.
    notFound()
}
