import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"

/**
 * Reusable empty state for any list / table / pane that has no data yet.
 *
 *   <EmptyState
 *       Icon={Mail}
 *       title="No campaigns yet"
 *       description="Create one to start reaching contacts."
 *       action={{ label: "New campaign", href: "/marketing/email/campaigns/new" }}
 *   />
 *
 * Use the `compact` prop inside cards / sheets / modals where the default
 * size would dwarf the surrounding chrome.
 */
export interface EmptyStateProps {
    /** Lucide icon shown in a tinted circle. Optional. */
    Icon?: LucideIcon
    /** One-line headline (sentence case, no period). */
    title: string
    /** Sub-line — one or two short sentences explaining what to do. */
    description?: string
    /** Optional CTA — either a Link (with href) or a button (with onClick). */
    action?: {
        label: string
        href?: string
        onClick?: () => void
    }
    /** Optional secondary action (rendered as ghost button). */
    secondaryAction?: {
        label: string
        href?: string
        onClick?: () => void
    }
    /** Tighter spacing for use inside cards/sheets. Default false. */
    compact?: boolean
    /** Color tone for the icon background. Default "muted". */
    accent?: "muted" | "primary" | "emerald" | "amber" | "rose" | "blue" | "violet"
    className?: string
}

export function EmptyState({
    Icon,
    title,
    description,
    action,
    secondaryAction,
    compact = false,
    accent = "muted",
    className = "",
}: EmptyStateProps) {
    const tone = {
        muted: "bg-muted text-muted-foreground",
        primary: "bg-primary/10 text-primary",
        emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    }[accent]

    return (
        <div
            className={`flex flex-col items-center justify-center text-center ${
                compact ? "py-8 px-4" : "py-16 px-6"
            } ${className}`}
        >
            {Icon && (
                <div
                    className={`flex items-center justify-center rounded-full mb-4 ${tone} ${
                        compact ? "h-10 w-10" : "h-12 w-12"
                    }`}
                >
                    <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
                </div>
            )}
            <h3
                className={`font-semibold tracking-tight ${
                    compact ? "text-sm" : "text-base"
                }`}
            >
                {title}
            </h3>
            {description && (
                <p
                    className={`text-muted-foreground max-w-sm mx-auto leading-relaxed mt-1 ${
                        compact ? "text-xs" : "text-sm"
                    }`}
                >
                    {description}
                </p>
            )}
            {(action || secondaryAction) && (
                <div className="flex items-center gap-2 mt-5 flex-wrap justify-center">
                    {action && (
                        action.href ? (
                            <Link href={action.href}>
                                <Button size={compact ? "sm" : "default"} className="gap-1.5 shadow-sm">
                                    {action.label}
                                </Button>
                            </Link>
                        ) : (
                            <Button
                                size={compact ? "sm" : "default"}
                                onClick={action.onClick}
                                className="gap-1.5 shadow-sm"
                            >
                                {action.label}
                            </Button>
                        )
                    )}
                    {secondaryAction && (
                        secondaryAction.href ? (
                            <Link href={secondaryAction.href}>
                                <Button
                                    size={compact ? "sm" : "default"}
                                    variant="ghost"
                                    className="gap-1.5"
                                >
                                    {secondaryAction.label}
                                </Button>
                            </Link>
                        ) : (
                            <Button
                                size={compact ? "sm" : "default"}
                                variant="ghost"
                                onClick={secondaryAction.onClick}
                                className="gap-1.5"
                            >
                                {secondaryAction.label}
                            </Button>
                        )
                    )}
                </div>
            )}
        </div>
    )
}
