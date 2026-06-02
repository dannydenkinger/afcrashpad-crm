import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { adminDb } from "@/lib/firebase-admin"
import { formatRelative } from "@/lib/admin/format"

export const dynamic = "force-dynamic"

interface GrantRow {
    id: string
    workspaceId: string
    workspaceName: string
    grantedByEmail: string
    supportEmail: string | null
    scope: string
    status: "active" | "revoked" | "expired"
    grantedAt: string | null
    expiresAt: string
    lastUsedAt: string | null
    useCount: number
}

interface AuditRow {
    id: string
    grantId: string
    workspaceId: string
    workspaceName: string
    agentEmail: string
    action: string
    entity: string | null
    at: string | null
}

function toIso(ts: unknown): string | null {
    if (!ts) return null
    if (typeof ts === "string") return ts
    if (ts instanceof Date) return ts.toISOString()
    const t = ts as { toDate?: () => Date }
    if (typeof t.toDate === "function") return t.toDate().toISOString()
    return null
}

export default async function SupportSessionsPage() {
    const [grantsSnap, auditSnap, wsSnap] = await Promise.all([
        adminDb.collection("support_grants").orderBy("grantedAt", "desc").limit(100).get(),
        adminDb.collection("support_audit_log").orderBy("at", "desc").limit(100).get(),
        adminDb.collection("workspaces").get(),
    ])

    const wsNameById = new Map<string, string>()
    wsSnap.docs.forEach((d) => {
        wsNameById.set(d.id, (d.data().name as string) || d.id.slice(0, 8))
    })

    const now = Date.now()

    const grants: GrantRow[] = grantsSnap.docs.map((d) => {
        const data = d.data()
        const expiresAt = toIso(data.expiresAt) || new Date().toISOString()
        let status: GrantRow["status"] = (data.status as GrantRow["status"]) || "active"
        if (status !== "revoked" && new Date(expiresAt).getTime() < now) status = "expired"
        return {
            id: d.id,
            workspaceId: (data.workspaceId as string) || "",
            workspaceName: wsNameById.get((data.workspaceId as string) || "") || "(unknown)",
            grantedByEmail: (data.grantedByEmail as string) || "",
            supportEmail: (data.supportEmail as string) || null,
            scope: (data.scope as string) || "full",
            status,
            grantedAt: toIso(data.grantedAt),
            expiresAt,
            lastUsedAt: toIso(data.lastUsedAt),
            useCount: typeof data.useCount === "number" ? data.useCount : 0,
        }
    })

    const active = grants.filter((g) => g.status === "active")
    const past = grants.filter((g) => g.status !== "active")

    const audit: AuditRow[] = auditSnap.docs.map((d) => {
        const data = d.data()
        const wsId = (data.workspaceId as string) || ""
        return {
            id: d.id,
            grantId: (data.grantId as string) || "",
            workspaceId: wsId,
            workspaceName: wsNameById.get(wsId) || "(unknown)",
            agentEmail: (data.agentEmail as string) || "",
            action: (data.action as string) || "",
            entity: (data.entity as string) || null,
            at: toIso(data.at),
        }
    })

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">Support sessions</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Every workspace-issued support grant + the last 100 audit entries across all
                    workspaces.
                </p>
            </header>

            <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold mb-3 inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-violet-500" />
                    Active grants ({active.length})
                </h2>
                {active.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                        No support sessions active right now.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="text-left text-muted-foreground">
                                <tr>
                                    <Th>Workspace</Th>
                                    <Th>Granted by</Th>
                                    <Th>Agent lock</Th>
                                    <Th>Scope</Th>
                                    <Th>Expires</Th>
                                    <Th>Last used</Th>
                                    <Th>Uses</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {active.map((g) => (
                                    <tr key={g.id} className="border-t">
                                        <td className="px-2 py-1.5">
                                            <Link
                                                href={`/admin/workspaces/${g.workspaceId}`}
                                                className="font-medium hover:underline"
                                            >
                                                {g.workspaceName}
                                            </Link>
                                        </td>
                                        <td className="px-2 py-1.5 max-w-[200px] truncate">
                                            {g.grantedByEmail}
                                        </td>
                                        <td className="px-2 py-1.5 max-w-[180px] truncate">
                                            {g.supportEmail || (
                                                <span className="text-muted-foreground italic">
                                                    any agent
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <span className="text-[10px] uppercase font-semibold tracking-wider">
                                                {g.scope}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap">
                                            {formatRelative(g.expiresAt)}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                                            {g.lastUsedAt ? formatRelative(g.lastUsedAt) : "never"}
                                        </td>
                                        <td className="px-2 py-1.5 font-mono">{g.useCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold mb-3">Past grants ({past.length})</h2>
                {past.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                        None yet.
                    </p>
                ) : (
                    <ul className="space-y-1.5">
                        {past.slice(0, 20).map((g) => (
                            <li
                                key={g.id}
                                className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/40"
                            >
                                <span>
                                    <span
                                        className={`text-[10px] uppercase font-semibold tracking-wider mr-2 ${
                                            g.status === "revoked"
                                                ? "text-rose-600 dark:text-rose-400"
                                                : "text-zinc-500"
                                        }`}
                                    >
                                        {g.status}
                                    </span>
                                    <Link
                                        href={`/admin/workspaces/${g.workspaceId}`}
                                        className="font-medium hover:underline"
                                    >
                                        {g.workspaceName}
                                    </Link>
                                    <span className="text-muted-foreground ml-2">
                                        by {g.grantedByEmail}
                                    </span>
                                </span>
                                <span className="text-muted-foreground text-[10px]">
                                    {g.grantedAt && new Date(g.grantedAt).toLocaleDateString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold mb-3">Recent agent activity</h2>
                {audit.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                        No support agent activity yet.
                    </p>
                ) : (
                    <ul className="space-y-1.5">
                        {audit.map((a) => (
                            <li key={a.id} className="text-xs">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="truncate">
                                        <span className="font-medium">{a.agentEmail}</span>
                                        <span className="text-muted-foreground ml-2">
                                            {a.action}
                                            {a.entity && ` · ${a.entity}`}
                                        </span>
                                        {a.workspaceId && (
                                            <Link
                                                href={`/admin/workspaces/${a.workspaceId}`}
                                                className="text-violet-600 dark:text-violet-400 ml-2 hover:underline"
                                            >
                                                {a.workspaceName}
                                            </Link>
                                        )}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        {formatRelative(a.at)}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th className="px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider whitespace-nowrap">
            {children}
        </th>
    )
}
