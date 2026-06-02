import Link from "next/link"
import { requireAuth } from "@/lib/auth-guard"
import { listLists } from "@/lib/lists/contact-lists"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ListPlus, Users } from "lucide-react"
import { ListsGrid } from "./ListsGrid"
import { EmptyState } from "@/components/ui/EmptyState"
import { BackLink } from "@/components/ui/BackLink"

export const dynamic = "force-dynamic"

export default async function ListsPage() {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const lists = await listLists(workspaceId)

    return (
        <div className="container mx-auto max-w-5xl py-10 px-4 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <BackLink href="/marketing/email" label="Back to Email marketing" />
                    <h1 className="text-2xl font-semibold">Contact lists</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Group contacts into reusable audiences for campaigns.
                    </p>
                </div>
                <Link href="/marketing/email/lists/new">
                    <Button>
                        <ListPlus className="w-4 h-4 mr-2" />
                        New list
                    </Button>
                </Link>
            </div>

            {lists.length === 0 ? (
                <Card>
                    <CardContent className="p-0">
                        <EmptyState
                            Icon={Users}
                            accent="primary"
                            title="No lists yet"
                            description="Create your first list to start grouping contacts. Lists make it easy to send campaigns to specific audiences."
                            action={{ label: "Create your first list", href: "/marketing/email/lists/new" }}
                        />
                    </CardContent>
                </Card>
            ) : (
                <ListsGrid
                    lists={lists.map((l) => ({
                        id: l.id,
                        name: l.name,
                        description: l.description,
                        contactCount: l.contactCount,
                        updatedAt: l.updatedAt,
                        isSmart: l.type === "smart",
                    }))}
                />
            )}
        </div>
    )
}
