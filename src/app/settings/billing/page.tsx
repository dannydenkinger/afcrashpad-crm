import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { BillingClient } from "./BillingClient"
import { getBillingState } from "./actions"

export const dynamic = "force-dynamic"

export default async function BillingSettingsPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")

    const role = session.user.role
    const canManage = role === "OWNER" || role === "ADMIN"

    const state = await getBillingState()

    return (
        <div className="container mx-auto max-w-3xl py-6 px-4">
            <div className="pb-4 border-b mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">Billing &amp; credits</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Buy credits, view transaction history, and manage your payment methods.
                </p>
            </div>
            <BillingClient initial={state} canManage={canManage} />
        </div>
    )
}
