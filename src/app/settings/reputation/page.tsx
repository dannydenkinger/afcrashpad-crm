import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default function ReputationSettingsPage() {
    // Single-org deployment: reputation settings UI is gated off.
    notFound()
}
