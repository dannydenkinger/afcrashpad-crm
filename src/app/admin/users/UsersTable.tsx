"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { formatNumber, formatRelative } from "@/lib/admin/format"

export interface UserRow {
    id: string
    email: string
    name: string
    hasPassword: boolean
    createdAt: string | null
    updatedAt: string | null
    workspaceCount: number
    ownerCount: number
    memberships: Array<{
        workspaceId: string
        workspaceName: string
        role: string
        status: string
    }>
}

type SortKey = "name" | "email" | "workspaces" | "created"

export function UsersTable({ rows }: { rows: UserRow[] }) {
    const [query, setQuery] = useState("")
    const [sortKey, setSortKey] = useState<SortKey>("created")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
    const [filter, setFilter] = useState<"all" | "owners" | "multi" | "pending">("all")

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        let out = rows
        if (q) {
            out = out.filter(
                (r) =>
                    r.email.toLowerCase().includes(q) ||
                    r.name.toLowerCase().includes(q) ||
                    r.id.toLowerCase().includes(q) ||
                    r.memberships.some((m) => m.workspaceName.toLowerCase().includes(q)),
            )
        }
        if (filter === "owners") out = out.filter((r) => r.ownerCount > 0)
        if (filter === "multi") out = out.filter((r) => r.workspaceCount > 1)
        if (filter === "pending") out = out.filter((r) => !r.hasPassword)
        return out
    }, [rows, query, filter])

    const sorted = useMemo(() => {
        const out = [...filtered]
        out.sort((a, b) => {
            let diff = 0
            switch (sortKey) {
                case "name":
                    diff = (a.name || a.email).localeCompare(b.name || b.email)
                    break
                case "email":
                    diff = a.email.localeCompare(b.email)
                    break
                case "workspaces":
                    diff = a.workspaceCount - b.workspaceCount
                    break
                case "created": {
                    const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0
                    const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0
                    diff = aT - bT
                    break
                }
            }
            return sortDir === "asc" ? diff : -diff
        })
        return out
    }, [filtered, sortKey, sortDir])

    const setSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc")
        else {
            setSortKey(key)
            setSortDir(key === "name" || key === "email" ? "asc" : "desc")
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search email / name / workspace"
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>
                <FilterPills
                    options={[
                        { value: "all", label: "All" },
                        { value: "owners", label: "Owners" },
                        { value: "multi", label: "Multi-workspace" },
                        { value: "pending", label: "Pending invite" },
                    ]}
                    value={filter}
                    onChange={(v) => setFilter(v as typeof filter)}
                />
            </div>

            <div className="rounded-xl border bg-card overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-muted/30 text-left text-muted-foreground">
                        <tr>
                            <Th onClick={() => setSort("name")} active={sortKey === "name"} dir={sortDir}>
                                User
                            </Th>
                            <Th onClick={() => setSort("email")} active={sortKey === "email"} dir={sortDir}>
                                Email
                            </Th>
                            <Th
                                onClick={() => setSort("workspaces")}
                                active={sortKey === "workspaces"}
                                dir={sortDir}
                            >
                                Workspaces
                            </Th>
                            <Th>Roles</Th>
                            <Th
                                onClick={() => setSort("created")}
                                active={sortKey === "created"}
                                dir={sortDir}
                            >
                                Joined
                            </Th>
                            <Th>State</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((row) => (
                            <tr key={row.id} className="border-t hover:bg-muted/30">
                                <td className="px-3 py-2">
                                    <div className="font-medium">{row.name || "—"}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                        {row.id.slice(0, 12)}
                                    </div>
                                </td>
                                <td className="px-3 py-2 max-w-[240px] truncate">{row.email}</td>
                                <td className="px-3 py-2">
                                    {row.workspaceCount === 0 ? (
                                        <span className="text-muted-foreground italic">—</span>
                                    ) : (
                                        <ul className="space-y-0.5">
                                            {row.memberships.slice(0, 3).map((m) => (
                                                <li key={m.workspaceId}>
                                                    <Link
                                                        href={`/admin/workspaces/${m.workspaceId}`}
                                                        className="hover:underline"
                                                    >
                                                        {m.workspaceName}
                                                    </Link>
                                                </li>
                                            ))}
                                            {row.memberships.length > 3 && (
                                                <li className="text-muted-foreground text-[10px]">
                                                    +{row.memberships.length - 3} more
                                                </li>
                                            )}
                                        </ul>
                                    )}
                                </td>
                                <td className="px-3 py-2">
                                    {row.ownerCount > 0 && (
                                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded bg-violet-500/15 text-violet-700 dark:text-violet-400 mr-1">
                                            OWNER × {row.ownerCount}
                                        </span>
                                    )}
                                    {row.workspaceCount - row.ownerCount > 0 && (
                                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded bg-zinc-500/15 text-zinc-700 dark:text-zinc-400">
                                            MEMBER × {row.workspaceCount - row.ownerCount}
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    {formatRelative(row.createdAt)}
                                </td>
                                <td className="px-3 py-2">
                                    {row.hasPassword ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold uppercase">
                                            Active
                                        </span>
                                    ) : (
                                        <span className="text-amber-600 dark:text-amber-400 text-[10px] font-semibold uppercase">
                                            Pending
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {sorted.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-3 py-6 text-center text-muted-foreground"
                                >
                                    No users match the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
                Showing {formatNumber(sorted.length)} of {formatNumber(rows.length)} users.
            </p>
        </div>
    )
}

function Th({
    children,
    onClick,
    active,
    dir,
}: {
    children: React.ReactNode
    onClick?: () => void
    active?: boolean
    dir?: "asc" | "desc"
}) {
    return (
        <th className="px-3 py-2 font-medium text-[10px] uppercase tracking-wider whitespace-nowrap">
            {onClick ? (
                <button
                    type="button"
                    onClick={onClick}
                    className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
                >
                    {children}
                    {active && <span className="text-[8px]">{dir === "asc" ? "▲" : "▼"}</span>}
                </button>
            ) : (
                children
            )}
        </th>
    )
}

function FilterPills({
    options,
    value,
    onChange,
}: {
    options: ReadonlyArray<{ value: string; label: string }>
    value: string
    onChange: (v: string) => void
}) {
    return (
        <div className="inline-flex items-center gap-0.5 rounded-md border bg-card p-0.5">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`px-2 py-1 text-[10px] font-medium rounded ${
                        value === o.value
                            ? "bg-violet-500/15 text-violet-700 dark:text-violet-400"
                            : "text-muted-foreground hover:bg-muted"
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    )
}
