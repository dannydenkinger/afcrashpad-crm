import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default function IntegrationsIndexPage() {
    redirect("/settings/integrations/services")
}
