import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default function DataIndexPage() {
    redirect("/settings/data/import")
}
