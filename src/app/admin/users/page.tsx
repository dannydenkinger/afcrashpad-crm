import { adminDb } from "@/lib/firebase-admin"
import { UsersTable, type UserRow } from "./UsersTable"

export const dynamic = "force-dynamic"

function toIso(ts: unknown): string | null {
    if (!ts) return null
    if (typeof ts === "string") return ts
    if (ts instanceof Date) return ts.toISOString()
    const t = ts as { toDate?: () => Date }
    if (typeof t.toDate === "function") return t.toDate().toISOString()
    return null
}

export default async function UsersPage() {
    // Pull every user + every workspace membership in two reads.
    const [usersSnap, membersSnap, wsSnap] = await Promise.all([
        adminDb.collection("users").get(),
        adminDb.collection("workspace_members").get(),
        adminDb.collection("workspaces").get(),
    ])

    const wsNameById = new Map<string, string>()
    wsSnap.docs.forEach((d) => {
        wsNameById.set(d.id, (d.data().name as string) || d.id.slice(0, 8))
    })

    const membershipsByUserId = new Map<
        string,
        Array<{ workspaceId: string; workspaceName: string; role: string; status: string }>
    >()
    membersSnap.docs.forEach((d) => {
        const data = d.data()
        const userId = data.userId as string | undefined
        if (!userId) return
        const list = membershipsByUserId.get(userId) ?? []
        list.push({
            workspaceId: (data.workspaceId as string) || "",
            workspaceName: wsNameById.get((data.workspaceId as string) || "") || "(unknown)",
            role: (data.role as string) || "MEMBER",
            status: (data.status as string) || "active",
        })
        membershipsByUserId.set(userId, list)
    })

    const rows: UserRow[] = usersSnap.docs
        .map((d) => {
            const data = d.data()
            const memberships = membershipsByUserId.get(d.id) ?? []
            return {
                id: d.id,
                email: (data.email as string) || "",
                name: (data.name as string) || "",
                hasPassword: !!data.passwordHash,
                createdAt: toIso(data.createdAt),
                updatedAt: toIso(data.updatedAt),
                workspaceCount: memberships.length,
                ownerCount: memberships.filter((m) => m.role === "OWNER").length,
                memberships,
            }
        })
        .sort((a, b) => {
            const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return bT - aT
        })

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {rows.length} total. Includes users in any workspace plus pre-created
                    accounts from pending invitations.
                </p>
            </header>
            <UsersTable rows={rows} />
        </div>
    )
}
