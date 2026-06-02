import type { WorkspaceRow } from "@/lib/admin/queries"

const labels: Record<WorkspaceRow["health"], { text: string; className: string }> = {
    engaged: {
        text: "Engaged",
        className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    },
    active: {
        text: "Active",
        className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    },
    idle: {
        text: "Idle",
        className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400",
    },
    churn_risk: {
        text: "Churn risk",
        className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    },
    cap_approaching: {
        text: "Near cap",
        className: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    },
    past_due: {
        text: "Past due",
        className: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    },
    deleting: {
        text: "Deleting",
        className: "bg-rose-500/20 text-rose-700 dark:text-rose-400",
    },
}

export function healthBadge(health: WorkspaceRow["health"]) {
    const meta = labels[health]
    return (
        <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${meta.className}`}
        >
            {meta.text}
        </span>
    )
}
