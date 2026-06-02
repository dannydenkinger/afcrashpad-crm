import Link from "next/link"
import { requireAuth } from "@/lib/auth-guard"
import { NewListForm } from "./NewListForm"

export const dynamic = "force-dynamic"

export default async function NewListPage() {
    await requireAuth()
    return (
        <div className="container mx-auto max-w-xl py-10 px-4 space-y-6">
            <div>
                <div className="text-xs text-muted-foreground mb-1">
                    <Link href="/marketing/email/lists" className="hover:underline">
                        ← Contact lists
                    </Link>
                </div>
                <h1 className="text-2xl font-semibold">New list</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Create a static list and add contacts to it afterward.
                </p>
            </div>
            <NewListForm />
        </div>
    )
}
