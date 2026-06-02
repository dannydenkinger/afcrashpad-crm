import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { getReputationSettings } from "./actions"
import { ReputationForm } from "./ReputationForm"

export const dynamic = "force-dynamic"

export default async function ReputationSettingsPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const role = (session.user as { role?: string }).role
    if (role !== "OWNER" && role !== "ADMIN") redirect("/settings")

    const initial = await getReputationSettings()

    return (
        <div className="container mx-auto max-w-3xl py-6 px-4 space-y-5">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Reputation</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Configure where to send happy customers when you ask for a review. The
                    URLs you set here power the &ldquo;Request review&rdquo; button on contacts and the
                    review-request email template.
                </p>
            </div>
            <ReputationForm initial={initial} />
        </div>
    )
}
