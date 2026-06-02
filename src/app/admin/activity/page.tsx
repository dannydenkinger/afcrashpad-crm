import Link from "next/link"
import { adminDb } from "@/lib/firebase-admin"
import { formatRelative } from "@/lib/admin/format"

export const dynamic = "force-dynamic"

interface ActivityEntry {
    id: string
    workspaceId: string
    workspaceName: string
    at: string | null
    userEmail: string
    userName: string
    action: string
    entity: string
    entityName: string
}

function toIso(ts: unknown): string | null {
    if (!ts) return null
    if (typeof ts === "string") return ts
    if (ts instanceof Date) return ts.toISOString()
    const t = ts as { toDate?: () => Date }
    if (typeof t.toDate === "function") return t.toDate().toISOString()
    return null
}

async function fetchActivity(limit: number): Promise<ActivityEntry[]> {
    let snap
    try {
        snap = await adminDb
            .collection("audit_logs")
            .orderBy("at", "desc")
            .limit(limit)
            .get()
    } catch {
        return []
    }

    const wsIds = new Set<string>()
    snap.docs.forEach((d) => {
        const wsId = d.data().workspaceId as string | undefined
        if (wsId) wsIds.add(wsId)
    })
    const wsNames = new Map<string, string>()
    await Promise.all(
        Array.from(wsIds).map(async (id) => {
            try {
                const w = await adminDb.collection("workspaces").doc(id).get()
                wsNames.set(id, (w.data()?.name as string) || id.slice(0, 8))
            } catch {
                wsNames.set(id, id.slice(0, 8))
            }
        }),
    )

    return snap.docs.map((d) => {
        const data = d.data()
        const wsId = (data.workspaceId as string) || ""
        return {
            id: d.id,
            workspaceId: wsId,
            workspaceName: wsNames.get(wsId) || "(unknown)",
            at: toIso(data.at) || toIso(data.timestamp) || toIso(data.createdAt),
            userEmail: (data.userEmail as string) || "",
            userName: (data.userName as string) || "",
            action: (data.action as string) || "",
            entity: (data.entity as string) || "",
            entityName: (data.entityName as string) || "",
        }
    })
}

export default async function ActivityPage() {
    const entries = await fetchActivity(200)
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Last 200 audit-log entries across every workspace.
                </p>
            </header>

            {entries.length === 0 ? (
                <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground italic">
                    No audit-log entries yet.
                </div>
            ) : (
                <div className="rounded-xl border bg-card overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/30 text-left text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 font-medium uppercase text-[10px] tracking-wider">
                                    When
                                </th>
                                <th className="px-3 py-2 font-medium uppercase text-[10px] tracking-wider">
                                    Workspace
                                </th>
                                <th className="px-3 py-2 font-medium uppercase text-[10px] tracking-wider">
                                    User
                                </th>
                                <th className="px-3 py-2 font-medium uppercase text-[10px] tracking-wider">
                                    Action
                                </th>
                                <th className="px-3 py-2 font-medium uppercase text-[10px] tracking-wider">
                                    Entity
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e) => (
                                <tr key={e.id} className="border-t hover:bg-muted/30">
                                    <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                                        {formatRelative(e.at)}
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <Link
                                            href={`/admin/workspaces/${e.workspaceId}`}
                                            className="hover:underline"
                                        >
                                            {e.workspaceName}
                                        </Link>
                                    </td>
                                    <td className="px-3 py-1.5 truncate max-w-[200px]">
                                        {e.userName || e.userEmail || "—"}
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <span className="text-[10px] uppercase font-semibold tracking-wider">
                                            {e.action}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 text-muted-foreground">
                                        {e.entity}
                                        {e.entityName && (
                                            <span className="text-foreground">
                                                {" — "}
                                                {e.entityName}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
