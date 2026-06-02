import { listWorkspaces } from "@/lib/admin/queries"
import { WorkspacesTable } from "./WorkspacesTable"

export const dynamic = "force-dynamic"

export default async function WorkspacesPage() {
    const rows = await listWorkspaces()
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {rows.length} total. Sorted by last activity.
                </p>
            </header>
            <WorkspacesTable rows={rows} />
        </div>
    )
}
