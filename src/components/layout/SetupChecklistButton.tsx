"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
    CheckCircle2,
    Circle,
    ChevronDown,
    Sparkles,
    X,
    Undo2,
    ChevronRight,
    Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    getChecklistState,
    skipChecklistTask,
    unskipChecklistTask,
    dismissChecklist,
    type ChecklistTask,
} from "@/app/dashboard/setup-actions"
import { toast } from "sonner"

/**
 * Persistent setup checklist that lives in the sidebar.
 *
 * Renders as a small "Setup (3/8)" badge — clicking opens a popover with
 * the full task list. Each task can be opened (link), skipped, or
 * unskipped. When everything's done or skipped, the popover shows a
 * "You're all set" celebration once, then auto-dismisses.
 *
 * Replaces the dashboard SetupChecklist card (one fixed location) AND
 * the OnboardingWizard spotlight tour (overlay tour) — both deleted.
 */
export function SetupChecklistButton({ collapsed }: { collapsed?: boolean }) {
    const [open, setOpen] = useState(false)
    const [tasks, setTasks] = useState<ChecklistTask[]>([])
    const [dismissed, setDismissed] = useState(true) // start hidden until loaded
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    const refresh = () => {
        getChecklistState().then((res) => {
            if (!res.success) {
                setDismissed(true)
            } else if (res.dismissed) {
                setDismissed(true)
            } else {
                setTasks(res.tasks || [])
                setDismissed(false)
            }
            setLoading(false)
        })
    }

    useEffect(() => {
        refresh()
    }, [])

    // Refresh on window focus — catches "I just connected Gmail and came back".
    useEffect(() => {
        const onFocus = () => refresh()
        window.addEventListener("focus", onFocus)
        return () => window.removeEventListener("focus", onFocus)
    }, [])

    if (loading || dismissed) return null

    const completedCount = tasks.filter((t) => t.completed || t.skipped).length
    const totalCount = tasks.length
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    const allDone = completedCount === totalCount

    const handleDismiss = () => {
        startTransition(async () => {
            setDismissed(true)
            await dismissChecklist()
            toast.success("Setup checklist hidden — re-enable in Profile settings")
        })
    }

    const handleToggleSkip = (task: ChecklistTask) => {
        startTransition(async () => {
            if (task.skipped) {
                await unskipChecklistTask(task.id)
            } else {
                await skipChecklistTask(task.id)
            }
            refresh()
        })
    }

    return (
        <div className="relative">
            {/* Trigger button */}
            <button
                onClick={() => setOpen(!open)}
                className={`group flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-colors ${
                    open ? "bg-muted/50" : "hover:bg-muted/30"
                }`}
                aria-label="Setup checklist"
                aria-expanded={open}
            >
                <div className="relative shrink-0">
                    <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    {allDone && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                </div>
                {!collapsed && (
                    <>
                        <div className="flex-1 min-w-0 text-left">
                            <div className="text-xs font-medium leading-tight">Setup</div>
                            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                {completedCount}/{totalCount} {allDone ? "— complete" : "complete"}
                            </div>
                        </div>
                        <ChevronDown
                            className={`h-3.5 w-3.5 text-muted-foreground/60 shrink-0 transition-transform ${
                                open ? "rotate-180" : ""
                            }`}
                        />
                    </>
                )}
            </button>

            {/* Mini progress bar — always visible under the button */}
            {!collapsed && !allDone && (
                <div className="h-0.5 mx-3 -mt-1 mb-1 bg-muted/40 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}

            {/* Popover panel */}
            {open && (
                <>
                    {/* Click-outside backdrop */}
                    <div
                        className="fixed inset-0 z-30"
                        onClick={() => setOpen(false)}
                        aria-hidden
                    />

                    <div className="absolute z-40 left-full ml-2 bottom-0 w-[340px] rounded-xl border bg-popover shadow-xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-3.5 border-b">
                            <div>
                                <div className="text-sm font-semibold">
                                    {allDone ? "🎉 You're all set" : "Get started with Vesta"}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {allDone
                                        ? "Hide this panel from the sidebar?"
                                        : `${completedCount} of ${totalCount} complete`}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => setOpen(false)}
                                aria-label="Close panel"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        {/* Task list */}
                        <div className="max-h-[420px] overflow-y-auto p-2">
                            {tasks.map((task) => (
                                <TaskRow
                                    key={task.id}
                                    task={task}
                                    onToggleSkip={() => handleToggleSkip(task)}
                                    onNavigate={() => setOpen(false)}
                                    busy={isPending}
                                />
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between p-2.5 border-t bg-muted/20 rounded-b-xl">
                            <span className="text-[11px] text-muted-foreground">
                                {allDone
                                    ? "Hide from the sidebar?"
                                    : "Skip anything you don't need — it stays hidden."}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[11px]"
                                onClick={handleDismiss}
                                disabled={isPending}
                            >
                                {isPending && (
                                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                )}
                                {allDone ? "Hide" : "Hide checklist"}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function TaskRow({
    task,
    onToggleSkip,
    onNavigate,
    busy,
}: {
    task: ChecklistTask
    onToggleSkip: () => void
    onNavigate: () => void
    busy: boolean
}) {
    const muted = task.completed || task.skipped

    return (
        <div
            className={`group flex items-center gap-2.5 rounded-lg p-2 transition-colors ${
                muted ? "" : "hover:bg-muted/40"
            }`}
        >
            <div className="shrink-0">
                {task.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : task.skipped ? (
                    <div className="h-4 w-4 rounded-full border-2 border-dashed border-muted-foreground/40" />
                ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div
                    className={`text-xs font-medium leading-tight ${
                        task.completed
                            ? "text-muted-foreground line-through"
                            : task.skipped
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                    }`}
                >
                    {task.label}
                </div>
                {task.description && !muted && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                        {task.description}
                    </div>
                )}
            </div>

            <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {task.skipped ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={onToggleSkip}
                        disabled={busy}
                        title="Unskip"
                    >
                        <Undo2 className="h-3 w-3" />
                    </Button>
                ) : task.completed ? null : (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-1.5 text-muted-foreground"
                            onClick={onToggleSkip}
                            disabled={busy}
                        >
                            Skip
                        </Button>
                        <Link href={task.href} onClick={onNavigate}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-primary"
                                title={`Open ${task.label}`}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    </>
                )}
            </div>
        </div>
    )
}
