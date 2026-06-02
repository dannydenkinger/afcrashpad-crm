import { Bug, Megaphone, Sparkles, Wrench } from "lucide-react"

/**
 * Public-facing changelog. Hardcoded entries — when releasing new features,
 * prepend a new entry to the array below. Type controls the icon + color pill.
 *
 * Newest entries first.
 */
interface ChangelogEntry {
    version: string
    date: string // ISO YYYY-MM-DD
    type: "feature" | "fix" | "improvement" | "maintenance"
    title: string
    description: string
}

const CHANGELOG: ChangelogEntry[] = [
    {
        version: "1.0.0",
        date: "2026-03-19",
        type: "feature",
        title: "Vesta CRM Launch",
        description:
            "Full-featured CRM with pipeline management, contacts, calendar integration, communications, document management, and optional marketing and finance modules.",
    },
]

const TYPE_CONFIG = {
    feature: {
        Icon: Sparkles,
        color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        label: "Feature",
    },
    fix: {
        Icon: Bug,
        color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        label: "Fix",
    },
    improvement: {
        Icon: Wrench,
        color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        label: "Improvement",
    },
    maintenance: {
        Icon: Megaphone,
        color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        label: "Maintenance",
    },
} as const

export function Changelog() {
    return (
        <div className="space-y-0">
            {CHANGELOG.map((entry, idx) => {
                const config = TYPE_CONFIG[entry.type]
                const Icon = config.Icon
                const isLast = idx === CHANGELOG.length - 1
                return (
                    <div key={entry.version} className="relative pl-10 pb-8 last:pb-0">
                        {!isLast && (
                            <div className="absolute left-[15px] top-7 bottom-0 w-px bg-border" />
                        )}
                        <div className="absolute left-0 top-1 h-8 w-8 rounded-full bg-card border flex items-center justify-center shadow-sm">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm tabular-nums">
                                    v{entry.version}
                                </span>
                                <span
                                    className={`inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${config.color}`}
                                >
                                    {config.label}
                                </span>
                                <span className="text-[11px] text-muted-foreground font-medium">
                                    {new Date(entry.date + "T00:00:00").toLocaleDateString(
                                        "en-US",
                                        { month: "short", day: "numeric", year: "numeric" },
                                    )}
                                </span>
                            </div>
                            <p className="font-semibold text-base">{entry.title}</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {entry.description}
                            </p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
