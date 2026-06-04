import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { Plug, Bot, KeyRound, Webhook, Code2, BookOpen } from "lucide-react"
import { SettingsSubPageLayout, type SubPageItem } from "../SettingsSubPageLayout"

export const dynamic = "force-dynamic"

const INTEGRATIONS_NAV: SubPageItem[] = [
    {
        slug: "services",
        label: "Connected services",
        description: "Gmail, Calendar, SES, Twilio, Zernio, WordPress",
        icon: <Plug className="w-4 h-4" />,
        accent: "rose",
    },
    {
        slug: "ai-routing",
        label: "AI routing",
        description: "Pick provider + model per AI feature",
        icon: <Bot className="w-4 h-4" />,
        accent: "violet",
    },
    {
        slug: "api-keys",
        label: "API keys",
        description: "Programmatic access to AFCrashpad",
        icon: <KeyRound className="w-4 h-4" />,
        accent: "amber",
    },
    {
        slug: "webhooks",
        label: "Webhooks",
        description: "POST CRM events to your systems",
        icon: <Webhook className="w-4 h-4" />,
        accent: "sky",
    },
    {
        slug: "embed",
        label: "Form embed",
        description: "Drop-in HTML lead-capture snippet",
        icon: <Code2 className="w-4 h-4" />,
        accent: "emerald",
    },
    {
        slug: "docs",
        label: "API reference",
        description: "Endpoints, auth, and examples",
        icon: <BookOpen className="w-4 h-4" />,
        accent: "blue",
    },
]

export default async function IntegrationsSettingsLayout({ children }: { children: React.ReactNode }) {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    const role = (session.user as { role?: string }).role
    if (role !== "OWNER" && role !== "ADMIN") redirect("/settings")

    return (
        <SettingsSubPageLayout
            basePath="/settings/integrations"
            areaTitle="Integrations & API"
            areaDescription="Connect external services and grant programmatic access to AFCrashpad."
            items={INTEGRATIONS_NAV}
        >
            {children}
        </SettingsSubPageLayout>
    )
}
