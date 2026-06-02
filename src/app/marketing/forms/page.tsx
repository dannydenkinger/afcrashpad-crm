import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { LeadFormsTab } from "@/app/settings/lead-forms/LeadFormsTab"

export const dynamic = "force-dynamic"

export default async function MarketingFormsPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")

    return (
        <div className="container mx-auto max-w-6xl py-8 px-4 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Lead forms
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Embed forms on your site or share as a public link to capture leads
                    straight into the CRM.
                </p>
            </div>

            <LeadFormsTab chromeless />
        </div>
    )
}
