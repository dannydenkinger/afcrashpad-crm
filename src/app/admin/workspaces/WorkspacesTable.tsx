"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import type { WorkspaceRow } from "@/lib/admin/queries"
import { formatCents, formatNumber, formatRelative } from "@/lib/admin/format"
import { healthBadge } from "./healthBadge"

const HEALTH_FILTERS = [
    { value: "all", label: "All" },
    { value: "engaged", label: "Engaged" },
    { value: "active", label: "Active" },
    { value: "idle", label: "Idle" },
    { value: "churn_risk", label: "Churn risk" },
    { value: "cap_approaching", label: "Near cap" },
    { value: "past_due", label: "Past due" },
    { value: "deleting", label: "Deleting" },
] as const

const PLAN_FILTERS = [
    { value: "all", label: "All plans" },
    { value: "free", label: "Free" },
    { value: "pro", label: "Pro" },
    { value: "max", label: "Max" },
] as const

type SortKey = "name" | "plan" | "contacts" | "mrr" | "active" | "created"

export function WorkspacesTable({ rows }: { rows: WorkspaceRow[] }) {
    const [query, setQuery] = useState("")
    const [healthFilter, setHealthFilter] = useState<(typeof HEALTH_FILTERS)[number]["value"]>("all")
    const [planFilter, setPlanFilter] = useState<(typeof PLAN_FILTERS)[number]["value"]>("all")
    const [sortKey, setSortKey] = useState<SortKey>("active")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        let out = rows
        if (q) {
            out = out.filter(
                (r) =>
                    r.name.toLowerCase().includes(q) ||
                    r.ownerEmail.toLowerCase().includes(q) ||
                    r.ownerName.toLowerCase().includes(q) ||
                    r.id.toLowerCase().includes(q),
            )
        }
        if (healthFilter !== "all") out = out.filter((r) => r.health === healthFilter)
        if (planFilter !== "all") out = out.filter((r) => r.plan === planFilter)
        return out
    }, [rows, query, healthFilter, planFilter])

    const sorted = useMemo(() => {
        const out = [...filtered]
        out.sort((a, b) => {
            let diff = 0
            switch (sortKey) {
                case "name":
                    diff = a.name.localeCompare(b.name)
                    break
                case "plan":
                    diff = a.plan.localeCompare(b.plan)
                    break
                case "contacts":
                    diff = a.contactCount - b.contactCount
                    break
                case "mrr":
                    diff = a.monthlyRevenueCents - b.monthlyRevenueCents
                    break
                case "active": {
                    const aT = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
                    const bT = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
                    diff = aT - bT
                    break
                }
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
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc")
        } else {
            setSortKey(key)
            setSortDir(key === "name" || key === "plan" ? "asc" : "desc")
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
                        placeholder="Search by workspace, owner email, or ID"
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>
                <FilterPills
                    options={PLAN_FILTERS}
                    value={planFilter}
                    onChange={(v) => setPlanFilter(v as typeof planFilter)}
                />
                <FilterPills
                    options={HEALTH_FILTERS}
                    value={healthFilter}
                    onChange={(v) => setHealthFilter(v as typeof healthFilter)}
                />
            </div>

            <div className="rounded-xl border bg-card overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-muted/30 text-left text-muted-foreground">
                        <tr>
                            <Th onClick={() => setSort("name")} active={sortKey === "name"} dir={sortDir}>
                                Workspace
                            </Th>
                            <Th>Owner</Th>
                            <Th onClick={() => setSort("plan")} active={sortKey === "plan"} dir={sortDir}>
                                Plan
                            </Th>
                            <Th
                                onClick={() => setSort("contacts")}
                                active={sortKey === "contacts"}
                                dir={sortDir}
                            >
                                Contacts
                            </Th>
                            <Th>Deals</Th>
                            <Th
                                onClick={() => setSort("mrr")}
                                active={sortKey === "mrr"}
                                dir={sortDir}
                            >
                                MRR
                            </Th>
                            <Th
                                onClick={() => setSort("active")}
                                active={sortKey === "active"}
                                dir={sortDir}
                            >
                                Last active
                            </Th>
                            <Th
                                onClick={() => setSort("created")}
                                active={sortKey === "created"}
                                dir={sortDir}
                            >
                                Created
                            </Th>
                            <Th>Health</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((row) => {
                            const capPct =
                                row.contactCap != null && row.contactCap > 0
                                    ? (row.contactCount / row.contactCap) * 100
                                    : null
                            return (
                                <tr key={row.id} className="border-t hover:bg-muted/30">
                                    <td className="px-3 py-2">
                                        <Link
                                            href={`/admin/workspaces/${row.id}`}
                                            className="font-medium hover:underline"
                                        >
                                            {row.name}
                                        </Link>
                                        <div className="text-[10px] text-muted-foreground font-mono">
                                            {row.id.slice(0, 12)}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 max-w-[200px] truncate">
                                        <div>{row.ownerName || "—"}</div>
                                        <div className="text-[10px] text-muted-foreground truncate">
                                            {row.ownerEmail || "—"}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <PlanBadge plan={row.plan} status={row.planStatus} />
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {formatNumber(row.contactCount)}
                                        {row.contactCap != null && (
                                            <span className="text-muted-foreground">
                                                {" / "}
                                                {formatNumber(row.contactCap)}
                                                {capPct != null && (
                                                    <span
                                                        className={
                                                            capPct >= 80
                                                                ? " text-orange-500 ml-1"
                                                                : " ml-1"
                                                        }
                                                    >
                                                        ({capPct.toFixed(0)}%)
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">{formatNumber(row.dealCount)}</td>
                                    <td className="px-3 py-2 font-mono">
                                        {row.monthlyRevenueCents > 0
                                            ? formatCents(row.monthlyRevenueCents)
                                            : "—"}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {formatRelative(row.lastActiveAt)}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {formatRelative(row.createdAt)}
                                    </td>
                                    <td className="px-3 py-2">{healthBadge(row.health)}</td>
                                </tr>
                            )
                        })}
                        {sorted.length === 0 && (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="px-3 py-6 text-center text-muted-foreground"
                                >
                                    No workspaces match the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
                Showing {sorted.length} of {rows.length} workspaces.
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

function PlanBadge({ plan, status }: { plan: string; status: string }) {
    const cls =
        plan === "max"
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            : plan === "pro"
              ? "bg-violet-500/15 text-violet-700 dark:text-violet-400"
              : "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400"
    return (
        <span className="inline-flex items-center gap-1">
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase ${cls}`}>
                {plan}
            </span>
            {status !== "active" && (
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    {status}
                </span>
            )}
        </span>
    )
}
