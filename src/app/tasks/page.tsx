"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    CheckCircle2,
    CheckSquare,
    Circle,
    Clock,
    Calendar as CalendarIcon,
    AlertCircle,
    User as UserIcon,
    MessageSquare,
    Repeat,
    Lock,
    Unlock,
    LayoutTemplate,
    Send,
    Trash2,
    Pencil,
    ChevronDown,
    ChevronRight,
    X
} from "lucide-react"
import { format, isPast, isToday, isTomorrow, isThisWeek } from "date-fns"
import {
    getTasks,
    toggleTaskComplete,
    deleteTask,
    completeRecurringTask,
    getTaskTemplates,
    createTaskTemplate,
    updateTaskTemplate,
    deleteTaskTemplate,
    applyTaskTemplate,
    getTaskComments,
    addTaskComment,
    addRecurrenceException,
    updateFutureOccurrences,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
} from "../calendar/actions"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CreateTaskDialog } from "@/components/ui/CreateTaskDialog"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "sonner"
import { withRetry } from "@/lib/retry"
import { useIsMobile } from "@/hooks/useIsMobile"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"

// ── Types ───────────────────────────────────────────────────────────────────

interface TemplateTask {
    title: string
    description?: string
    priority?: string
    relativeDueDays?: number
}

interface TaskTemplate {
    id: string
    name: string
    tasks: TemplateTask[]
    createdAt?: string
}

interface TaskComment {
    id: string
    userId: string | null
    userName: string
    text: string
    createdAt: string
}

// ── Default Templates ───────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Omit<TaskTemplate, "id" | "createdAt">[] = [
    {
        name: "New Tenant Onboarding",
        tasks: [
            { title: "Send welcome email with move-in instructions", priority: "HIGH", relativeDueDays: 0 },
            { title: "Verify lease agreement is signed", priority: "HIGH", relativeDueDays: 1 },
            { title: "Collect security deposit", priority: "HIGH", relativeDueDays: 1 },
            { title: "Provide key/access code", priority: "HIGH", relativeDueDays: 2 },
            { title: "Walk through property rules and amenities", priority: "MEDIUM", relativeDueDays: 2 },
            { title: "Set up recurring rent payment", priority: "MEDIUM", relativeDueDays: 3 },
            { title: "Follow up - settling in check", priority: "LOW", relativeDueDays: 7 },
        ]
    },
    {
        name: "Move-Out Checklist",
        tasks: [
            { title: "Send move-out reminder and instructions", priority: "HIGH", relativeDueDays: 0 },
            { title: "Schedule property inspection", priority: "HIGH", relativeDueDays: 1 },
            { title: "Collect keys/access devices", priority: "HIGH", relativeDueDays: 2 },
            { title: "Conduct move-out inspection", priority: "HIGH", relativeDueDays: 2 },
            { title: "Process security deposit return", priority: "MEDIUM", relativeDueDays: 5 },
            { title: "Clean and prepare unit for next tenant", priority: "MEDIUM", relativeDueDays: 7 },
        ]
    },
    {
        name: "Monthly Property Check",
        tasks: [
            { title: "Inspect HVAC filters", priority: "MEDIUM", relativeDueDays: 0 },
            { title: "Check smoke detectors and CO alarms", priority: "HIGH", relativeDueDays: 0 },
            { title: "Inspect plumbing for leaks", priority: "MEDIUM", relativeDueDays: 1 },
            { title: "Review exterior condition", priority: "LOW", relativeDueDays: 2 },
            { title: "Check common area cleanliness", priority: "LOW", relativeDueDays: 2 },
            { title: "Log maintenance findings", priority: "MEDIUM", relativeDueDays: 3 },
        ]
    },
]

// ── Mobile Tasks Component ──────────────────────────────────────────────────

function MobileTasksView({
    groupedTasks,
    isLoading,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    onToggleTask,
    onRefresh,
    onCreateTask,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    editingTask,
    setEditingTask,
    loadTasks,
    availableTasksForDeps,
}: {
    groupedTasks: { key: string; label: string; tasks: any[] }[]
    isLoading: boolean
    searchQuery: string
    setSearchQuery: (q: string) => void
    filter: "all" | "active" | "completed"
    setFilter: (f: "all" | "active" | "completed") => void
    onToggleTask: (taskId: string, completed: boolean) => void
    onRefresh: () => Promise<void>
    onCreateTask: () => void
    isCreateDialogOpen: boolean
    setIsCreateDialogOpen: (open: boolean) => void
    editingTask: any
    setEditingTask: (task: any) => void
    loadTasks: () => void
    availableTasksForDeps: { id: string; title: string }[]
}) {
    const { refreshing, pullDistance } = usePullToRefresh(onRefresh)

    return (
        <div className="relative flex flex-col h-full min-h-0 bg-zinc-950">
            {/* Pull-to-refresh indicator */}
            {pullDistance > 0 && (
                <div className="pull-indicator flex items-center justify-center" style={{ height: pullDistance }}>
                    {refreshing ? (
                        <div className="pull-spinner" />
                    ) : (
                        <div
                            className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full"
                            style={{ transform: `rotate(${pullDistance * 3}deg)`, opacity: Math.min(pullDistance / 60, 1) }}
                        />
                    )}
                </div>
            )}

            <div className="flex flex-col h-full" style={{ transform: `translateY(${pullDistance}px)` }}>
                {/* Search + filter */}
                <div className="px-4 pt-3 pb-2 space-y-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                        <input
                            placeholder="Search tasks..."
                            className="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-1.5">
                        {(["active", "completed", "all"] as const).map(f => (
                            <button
                                key={f}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest touch-manipulation transition-colors",
                                    filter === f ? "bg-primary text-primary-foreground" : "bg-zinc-900 text-zinc-500 border border-white/5"
                                )}
                                onClick={() => setFilter(f)}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Task groups */}
                <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
                    {isLoading ? (
                        <div className="space-y-3 pt-4">
                            {[1,2,3,4,5].map(i => (
                                <div key={i} className="mobile-card p-4 h-16 animate-pulse" />
                            ))}
                        </div>
                    ) : groupedTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-zinc-500 text-sm">
                            {filter === "active" ? "No active tasks" : "No tasks found"}
                        </div>
                    ) : (
                        groupedTasks.map(group => (
                            <div key={group.key}>
                                <div className={cn(
                                    "mobile-section-header",
                                    group.key === "overdue" && "!text-rose-400"
                                )}>
                                    {group.label}
                                    <span className="ml-1 opacity-50">{group.tasks.length}</span>
                                </div>
                                <div className="space-y-1.5">
                                    {group.tasks.map(task => (
                                        <button
                                            key={task.id}
                                            className="w-full mobile-card p-3.5 flex items-center gap-3 touch-manipulation text-left"
                                            onClick={() => onToggleTask(task.id, task.completed)}
                                        >
                                            {/* Checkbox circle */}
                                            <div className={cn(
                                                "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                                task.completed
                                                    ? "bg-emerald-500 border-emerald-500"
                                                    : "border-zinc-600"
                                            )}>
                                                {task.completed && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                            </div>

                                            {/* Task content */}
                                            <div className="flex-1 min-w-0">
                                                <span className={cn(
                                                    "text-sm font-medium block truncate",
                                                    task.completed ? "text-zinc-500 line-through" : "text-white"
                                                )}>
                                                    {task.title}
                                                </span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {task.dueDate && (
                                                        <span className={cn(
                                                            "text-[10px]",
                                                            !task.completed && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate))
                                                                ? "text-rose-400 font-semibold"
                                                                : isToday(new Date(task.dueDate))
                                                                ? "text-primary font-semibold"
                                                                : "text-zinc-500"
                                                        )}>
                                                            {format(new Date(task.dueDate), "MMM d")}
                                                        </span>
                                                    )}
                                                    {task.assigneeName && (
                                                        <span className="text-[10px] text-zinc-600 truncate">{task.assigneeName}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Priority dot */}
                                            <div className={cn(
                                                "w-2.5 h-2.5 rounded-full shrink-0",
                                                task.priority === "HIGH" ? "bg-rose-500" :
                                                task.priority === "MEDIUM" ? "bg-amber-500" : "bg-emerald-500"
                                            )} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* FAB for new task */}
            <button
                className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
                onClick={onCreateTask}
            >
                <Plus className="h-6 w-6" />
            </button>

            <CreateTaskDialog
                isOpen={isCreateDialogOpen}
                onClose={() => { setIsCreateDialogOpen(false); setEditingTask(null) }}
                onSaved={() => {
                    toast.success(editingTask ? "Task updated" : "Task created")
                    loadTasks()
                }}
                initialData={editingTask}
                availableTasks={availableTasksForDeps}
            />
        </div>
    )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function TasksPage() {
    const isMobile = useIsMobile()
    const [tasks, setTasks] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [filter, setFilter] = useState<"all" | "active" | "completed">("active")
    const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "created">("dueDate")
    const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set())
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<any>(null)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

    // Templates state
    const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
    const [templates, setTemplates] = useState<TaskTemplate[]>([])
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)

    // Comments state
    const [commentSheetTaskId, setCommentSheetTaskId] = useState<string | null>(null)
    const [comments, setComments] = useState<TaskComment[]>([])
    const [isLoadingComments, setIsLoadingComments] = useState(false)
    const [newComment, setNewComment] = useState("")

    // Recurring exception state
    const [recurringExceptionTarget, setRecurringExceptionTarget] = useState<any>(null)

    // Bulk operations
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
    const [bulkActionLoading, setBulkActionLoading] = useState(false)
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

    // Subtasks
    const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null)
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("")

    const loadTasks = async () => {
        setIsLoading(true)
        try {
            const data = await getTasks()
            setTasks(data)
        } catch (error) {
            console.error("Failed to load tasks:", error)
        }
        setIsLoading(false)
    }

    useEffect(() => {
        loadTasks()
    }, [])

    // Available tasks for the dependency picker (exclude current task when editing)
    const availableTasksForDeps = useMemo(() =>
        tasks.filter(t => !t.completed).map(t => ({ id: t.id, title: t.title })),
        [tasks]
    )

    const handleToggleTask = useCallback(async (taskId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus
        const task = tasks.find(t => t.id === taskId)
        const isRecurring = task?.recurrence && task.recurrence.type !== "none"

        // Check if task is blocked
        if (!currentStatus && task?.blockedByTaskId) {
            const blockingTask = tasks.find(t => t.id === task.blockedByTaskId)
            if (blockingTask && !blockingTask.completed) {
                toast.error(`This task is blocked by "${blockingTask.title}"`)
                return
            }
        }

        // If recurring and completing, ask about exception handling
        if (newStatus && isRecurring) {
            setRecurringExceptionTarget(task)
            return
        }

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: newStatus } : t))
        const retryOpts = { onRetry: (attempt: number) => toast.info(`Retrying... (attempt ${attempt + 1}/4)`, { id: "retry-toast", duration: 2000 }) }
        try {
            await withRetry(() => toggleTaskComplete(taskId, newStatus), retryOpts)
            toast.success(newStatus ? "Task completed" : "Task reopened")
            // If a task that was blocking others is completed, reload to refresh dependency status
            if (newStatus) {
                const dependentTasks = tasks.filter(t => t.blockedByTaskId === taskId)
                if (dependentTasks.length > 0) {
                    toast.info(`${dependentTasks.length} task(s) unblocked!`)
                }
            }
            loadTasks()
        } catch (error) {
            console.error("Failed to toggle task:", error)
            toast.error("Failed to update task")
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: currentStatus } : t))
        }
    }, [tasks])

    const handleRecurringComplete = useCallback(async (action: "complete" | "skip" | "complete_all") => {
        if (!recurringExceptionTarget) return
        const task = recurringExceptionTarget
        setRecurringExceptionTarget(null)

        const retryOpts = { onRetry: (attempt: number) => toast.info(`Retrying... (attempt ${attempt + 1}/4)`, { id: "retry-toast", duration: 2000 }) }

        if (action === "skip") {
            // Add skip exception for this occurrence
            try {
                const dueDate = task.dueDate ? new Date(task.dueDate) : new Date()
                await withRetry(() => addRecurrenceException(task.id, { date: dueDate, action: "skip" }), retryOpts)
                toast.success("Occurrence skipped")
                loadTasks()
            } catch {
                toast.error("Failed to skip occurrence")
            }
            return
        }

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: true } : t))

        try {
            const result = await withRetry(() => completeRecurringTask(task.id), retryOpts)
            if (result.nextTaskId) {
                toast.success("Task completed -- next occurrence created")
            } else {
                toast.success("Recurring task completed (series ended)")
            }
            loadTasks()
        } catch (error) {
            toast.error("Failed to complete task")
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: false } : t))
        }
    }, [recurringExceptionTarget])

    const handleDeleteTask = useCallback(async (taskId: string) => {
        const previousTasks = tasks
        setTasks(prev => prev.filter(t => t.id !== taskId))
        setDeleteTarget(null)

        try {
            await withRetry(
                () => deleteTask(taskId),
                { onRetry: (attempt) => toast.info(`Retrying delete... (attempt ${attempt + 1}/4)`, { id: "retry-toast", duration: 2000 }) }
            )
            toast.success("Task deleted")
            loadTasks()
        } catch (error) {
            console.error("Failed to delete task:", error)
            setTasks(previousTasks)
            toast.error("Failed to delete task")
        }
    }, [tasks])

    const openEditDialog = useCallback((task: any) => {
        setEditingTask(task)
        setIsCreateDialogOpen(true)
    }, [])

    // ── Bulk Operations ──────────────────────────────────────────────────────

    const toggleSelectTask = (taskId: string) => {
        setSelectedTaskIds(prev => {
            const next = new Set(prev)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })
    }

    const handleBulkComplete = async () => {
        setBulkActionLoading(true)
        const ids = Array.from(selectedTaskIds)
        // Optimistic update
        setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, completed: true } : t))
        let failed = 0
        for (const id of ids) {
            try { await toggleTaskComplete(id, true) } catch { failed++ }
        }
        if (failed > 0) toast.error(`${failed} task(s) failed to complete`)
        else toast.success(`${ids.length} task(s) completed`)
        setSelectedTaskIds(new Set())
        setBulkActionLoading(false)
        loadTasks()
    }

    const handleBulkDelete = async () => {
        setBulkActionLoading(true)
        const ids = Array.from(selectedTaskIds)
        let failed = 0
        for (const id of ids) {
            try { await deleteTask(id) } catch { failed++ }
        }
        if (failed > 0) toast.error(`${failed} task(s) failed to delete`)
        else toast.success(`${ids.length} task(s) deleted`)
        setSelectedTaskIds(new Set())
        setBulkDeleteConfirm(false)
        setBulkActionLoading(false)
        loadTasks()
    }

    // ── Subtasks ──────────────────────────────────────────────────────────

    const handleAddSubtask = async (taskId: string) => {
        if (!newSubtaskTitle.trim()) return
        const res = await addSubtask(taskId, newSubtaskTitle)
        if (res.success && res.subtask) {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), res.subtask] } : t))
            setNewSubtaskTitle("")
        } else {
            toast.error("Failed to add checklist item")
        }
    }

    const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
        setTasks(prev => prev.map(t => t.id === taskId ? {
            ...t, subtasks: (t.subtasks || []).map((s: any) => s.id === subtaskId ? { ...s, completed: !s.completed } : s)
        } : t))
        await toggleSubtask(taskId, subtaskId)
    }

    const handleDeleteSubtask = async (taskId: string, subtaskId: string) => {
        setTasks(prev => prev.map(t => t.id === taskId ? {
            ...t, subtasks: (t.subtasks || []).filter((s: any) => s.id !== subtaskId)
        } : t))
        await deleteSubtask(taskId, subtaskId)
    }

    // ── Comments ────────────────────────────────────────────────────────────

    const openComments = useCallback(async (taskId: string) => {
        setCommentSheetTaskId(taskId)
        setIsLoadingComments(true)
        try {
            const data = await getTaskComments(taskId)
            setComments(data)
        } catch {
            toast.error("Failed to load comments")
        }
        setIsLoadingComments(false)
    }, [])

    const handleAddComment = useCallback(async () => {
        if (!commentSheetTaskId || !newComment.trim()) return
        const text = newComment.trim()
        setNewComment("")
        try {
            await addTaskComment(commentSheetTaskId, text)
            const data = await getTaskComments(commentSheetTaskId)
            setComments(data)
            toast.success("Comment added")
        } catch {
            toast.error("Failed to add comment")
            setNewComment(text)
        }
    }, [commentSheetTaskId, newComment])

    // ── Templates ───────────────────────────────────────────────────────────

    const openTemplates = useCallback(async () => {
        setIsTemplateDialogOpen(true)
        setIsLoadingTemplates(true)
        try {
            const data = await getTaskTemplates()
            setTemplates(data)
        } catch {
            toast.error("Failed to load templates")
        }
        setIsLoadingTemplates(false)
    }, [])

    const handleApplyTemplate = useCallback(async (templateId: string) => {
        try {
            const result = await applyTaskTemplate(templateId)
            if (result.success) {
                toast.success(`Created ${result.createdCount} tasks from template`)
                setIsTemplateDialogOpen(false)
                loadTasks()
            } else {
                toast.error(result.error || "Failed to apply template")
            }
        } catch {
            toast.error("Failed to apply template")
        }
    }, [])

    const toggleQuickFilter = useCallback((key: string) => {
        setQuickFilters(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const filteredTasks = useMemo(() => {
        const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

        const filtered = tasks.filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.description?.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesFilter = filter === "all" ||
                (filter === "active" && !task.completed) ||
                (filter === "completed" && task.completed)
            if (!matchesSearch || !matchesFilter) return false

            // Quick filters (all selected must match)
            if (quickFilters.has("overdue")) {
                if (!task.dueDate || !isPast(new Date(task.dueDate)) || isToday(new Date(task.dueDate)) || task.completed) return false
            }
            if (quickFilters.has("high")) {
                if (task.priority !== "HIGH") return false
            }
            if (quickFilters.has("thisWeek")) {
                if (!task.dueDate || !isThisWeek(new Date(task.dueDate), { weekStartsOn: 1 })) return false
            }
            return true
        })

        // Sort
        filtered.sort((a, b) => {
            if (sortBy === "dueDate") {
                if (!a.dueDate && !b.dueDate) return 0
                if (!a.dueDate) return 1
                if (!b.dueDate) return -1
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            }
            if (sortBy === "priority") {
                return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
            }
            // created
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        })

        return filtered
    }, [tasks, searchQuery, filter, sortBy, quickFilters])

    const groupedTasks = useMemo(() => {
        const groups: { key: string; label: string; tasks: any[] }[] = [
            { key: "overdue", label: "Overdue", tasks: [] },
            { key: "today", label: "Today", tasks: [] },
            { key: "tomorrow", label: "Tomorrow", tasks: [] },
            { key: "thisWeek", label: "This Week", tasks: [] },
            { key: "later", label: "Later", tasks: [] },
            { key: "noDueDate", label: "No Due Date", tasks: [] },
        ]

        for (const task of filteredTasks) {
            if (!task.dueDate) {
                groups[5].tasks.push(task)
            } else {
                const date = new Date(task.dueDate)
                if (isToday(date)) {
                    groups[1].tasks.push(task)
                } else if (isPast(date) && !task.completed) {
                    groups[0].tasks.push(task)
                } else if (isTomorrow(date)) {
                    groups[2].tasks.push(task)
                } else if (isThisWeek(date, { weekStartsOn: 1 })) {
                    groups[3].tasks.push(task)
                } else {
                    groups[4].tasks.push(task)
                }
            }
        }

        return groups.filter(g => g.tasks.length > 0)
    }, [filteredTasks])

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "HIGH": return "text-rose-500 border-rose-500/20 bg-rose-500/10"
            case "MEDIUM": return "text-amber-500 border-amber-500/20 bg-amber-500/10"
            case "LOW": return "text-emerald-500 border-emerald-500/20 bg-emerald-500/10"
            default: return "text-muted-foreground border-muted/20 bg-muted/10"
        }
    }

    const commentSheetTask = tasks.find(t => t.id === commentSheetTaskId)

    // ─── Mobile Tasks ───────────────────────────────────────────────
    if (isMobile) {
        return (
            <MobileTasksView
                groupedTasks={groupedTasks}
                isLoading={isLoading}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filter={filter}
                setFilter={setFilter}
                onToggleTask={handleToggleTask}
                onRefresh={async () => { await loadTasks() }}
                onCreateTask={() => { setEditingTask(null); setIsCreateDialogOpen(true) }}
                isCreateDialogOpen={isCreateDialogOpen}
                setIsCreateDialogOpen={setIsCreateDialogOpen}
                editingTask={editingTask}
                setEditingTask={setEditingTask}
                loadTasks={loadTasks}
                availableTasksForDeps={availableTasksForDeps}
            />
        )
    }

    // ─── Desktop Tasks ──────────────────────────────────────────────
    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Task Manager
                        </h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Keep track of everything you need to do.</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Button variant="outline" className="h-9 gap-2 touch-manipulation" onClick={openTemplates}>
                            <LayoutTemplate className="h-4 w-4" />
                            <span className="hidden sm:inline">Templates</span>
                        </Button>
                        <Button className="h-9 gap-2 shadow-lg shadow-primary/20 touch-manipulation flex-1 sm:flex-initial" onClick={() => {
                            setEditingTask(null);
                            setIsCreateDialogOpen(true);
                        }}>
                            <Plus className="h-4 w-4" />
                            New Task
                        </Button>
                    </div>
                </div>

            <CreateTaskDialog
                isOpen={isCreateDialogOpen}
                onClose={() => {
                    setIsCreateDialogOpen(false);
                    setEditingTask(null);
                }}
                onSaved={() => {
                    toast.success(editingTask ? "Task updated" : "Task created")
                    loadTasks()
                }}
                initialData={editingTask}
                availableTasks={availableTasksForDeps}
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-4">
                <div className="relative flex-1 min-w-0 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        className="w-full bg-muted/20 border-white/5 rounded-xl py-2.5 sm:py-2 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[44px] sm:min-h-0"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center rounded-xl bg-muted/30 p-1 border border-white/5">
                    <Button
                        variant={filter === "active" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 rounded-lg text-[11px] font-black uppercase tracking-widest px-3 sm:px-4 touch-manipulation flex-1 sm:flex-initial"
                        onClick={() => setFilter("active")}
                    >
                        Active
                    </Button>
                    <Button
                        variant={filter === "completed" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 rounded-lg text-[11px] font-black uppercase tracking-widest px-3 sm:px-4 touch-manipulation flex-1 sm:flex-initial"
                        onClick={() => setFilter("completed")}
                    >
                        Completed
                    </Button>
                    <Button
                        variant={filter === "all" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 rounded-lg text-[11px] font-black uppercase tracking-widest px-3 sm:px-4 touch-manipulation flex-1 sm:flex-initial"
                        onClick={() => setFilter("all")}
                    >
                        All
                    </Button>
                </div>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                    <SelectTrigger className="w-[140px] h-8 rounded-lg text-[11px] font-black uppercase tracking-widest bg-muted/30 border-white/5">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="dueDate">Due Date</SelectItem>
                        <SelectItem value="priority">Priority</SelectItem>
                        <SelectItem value="created">Created</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2 mb-6 flex-wrap">
                {([
                    { key: "overdue", label: "Overdue", color: "text-rose-500 border-rose-500/30 bg-rose-500/10" },
                    { key: "high", label: "High Priority", color: "text-amber-500 border-amber-500/30 bg-amber-500/10" },
                    { key: "thisWeek", label: "This Week", color: "text-blue-500 border-blue-500/30 bg-blue-500/10" },
                ] as const).map(chip => (
                    <button
                        key={chip.key}
                        onClick={() => toggleQuickFilter(chip.key)}
                        className={cn(
                            "px-3 py-1 rounded-full text-[11px] font-bold border transition-all touch-manipulation",
                            quickFilters.has(chip.key)
                                ? chip.color
                                : "text-muted-foreground border-white/10 bg-muted/20 hover:bg-muted/40"
                        )}
                    >
                        {chip.label}
                        {quickFilters.has(chip.key) && (
                            <X className="inline-block ml-1 h-3 w-3 -mt-0.5" />
                        )}
                    </button>
                ))}
            </div>

            {selectedTaskIds.size > 0 && (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5 shadow-sm">
                    <span className="text-sm font-medium">{selectedTaskIds.size} selected</span>
                    <div className="h-4 w-px bg-border" />
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleBulkComplete} disabled={bulkActionLoading}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Complete All
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setBulkDeleteConfirm(true)} disabled={bulkActionLoading}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs ml-auto" onClick={() => setSelectedTaskIds(new Set())}>
                        Clear
                    </Button>
                </div>
            )}

            <div className="flex-1 overflow-auto pr-2 space-y-3">
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-20 rounded-2xl border border-white/5 bg-muted/5 animate-pulse" />
                    ))
                ) : groupedTasks.length > 0 ? (
                    groupedTasks.map((group) => (
                        <div key={group.key} className="space-y-2">
                            <h4 className={cn(
                                "text-[10px] font-black uppercase tracking-[0.15em] px-1 pt-2",
                                group.key === "overdue" ? "text-rose-500" : "text-muted-foreground"
                            )}>
                                {group.label}
                                <span className="ml-1.5 text-muted-foreground/50">{group.tasks.length}</span>
                            </h4>
                            {group.tasks.map((task) => {
                                const isBlocked = task.blockedByTaskId && !task.blockedByTaskCompleted && !task.completed
                                const wasBlocked = task.blockedByTaskId && task.blockedByTaskCompleted && !task.completed

                                return (
                                    <Card key={task.id} className={cn(
                                        "border-white/5 bg-card/40 backdrop-blur-md hover:bg-card/60 active:bg-card/70 transition-all group overflow-hidden touch-manipulation",
                                        task.completed && "opacity-60",
                                        isBlocked && "border-amber-500/20"
                                    )}>
                                        <CardContent className="p-0">
                                            <div className="flex items-center p-4 min-h-[56px]">
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={selectedTaskIds.has(task.id)}
                                                            onCheckedChange={() => toggleSelectTask(task.id)}
                                                            className="h-4 w-4 rounded border-white/10 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                                            aria-label={`Select ${task.title}`}
                                                        />
                                                    </div>
                                                    <Checkbox
                                                        checked={task.completed}
                                                        onCheckedChange={() => handleToggleTask(task.id, task.completed)}
                                                        className={cn(
                                                            "h-5 w-5 rounded-lg border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all",
                                                            isBlocked && "border-amber-500/40"
                                                        )}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <h3 className={cn(
                                                                "text-sm font-black leading-none",
                                                                task.completed && "line-through text-muted-foreground"
                                                            )}>{task.title}</h3>
                                                            <Badge className={cn("text-[9px] font-black px-2 py-0 border leading-none uppercase tracking-tighter", getPriorityColor(task.priority))}>
                                                                {task.priority}
                                                            </Badge>
                                                            {task.recurrence && task.recurrence.type !== "none" && (
                                                                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-primary/30 text-primary bg-primary/5 leading-none gap-0.5">
                                                                    <Repeat className="h-2.5 w-2.5" />
                                                                    {task.recurrence.interval > 1 ? `${task.recurrence.interval} ` : ""}
                                                                    {task.recurrence.type === "daily" ? "Daily" : task.recurrence.type === "weekly" ? "Weekly" : "Monthly"}
                                                                </Badge>
                                                            )}
                                                            {isBlocked && (
                                                                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-amber-500/30 text-amber-500 bg-amber-500/5 leading-none gap-0.5">
                                                                    <Lock className="h-2.5 w-2.5" />
                                                                    Blocked by: {task.blockedByTaskTitle || "task"}
                                                                </Badge>
                                                            )}
                                                            {wasBlocked && (
                                                                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-emerald-500/30 text-emerald-500 bg-emerald-500/5 leading-none gap-0.5">
                                                                    <Unlock className="h-2.5 w-2.5" />
                                                                    Unblocked
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {task.description && (
                                                            <p className="text-xs text-muted-foreground truncate mb-2">{task.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-4">
                                                            {task.dueDate && (
                                                                <div className={cn(
                                                                    "flex items-center gap-1 text-[10px] font-bold",
                                                                    isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !task.completed ? "text-rose-500" : "text-muted-foreground"
                                                                )}>
                                                                    <Clock className="h-3 w-3" />
                                                                    {format(new Date(task.dueDate), "MMM d, h:mm a")}
                                                                </div>
                                                            )}
                                                            {task.contact && (
                                                                <div className="flex items-center gap-1 text-[10px] font-bold text-primary">
                                                                    <UserIcon className="h-3 w-3" />
                                                                    {task.contact.name}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => openComments(task.id)}
                                                    >
                                                        <MessageSquare className="h-4 w-4" />
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg transition-colors border border-transparent hover:border-white/5">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => openEditDialog(task)}>Edit Task</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => openComments(task.id)}>
                                                                <MessageSquare className="h-3.5 w-3.5 mr-2" />
                                                                Comments
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => { setExpandedSubtaskId(expandedSubtaskId === task.id ? null : task.id); setNewSubtaskTitle("") }}>
                                                                <CheckSquare className="h-3.5 w-3.5 mr-2" />
                                                                Checklist
                                                            </DropdownMenuItem>
                                                            {task.recurrence && task.recurrence.type !== "none" && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem onClick={() => setRecurringExceptionTarget(task)}>
                                                                        <Repeat className="h-3.5 w-3.5 mr-2" />
                                                                        Manage Recurrence
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => setDeleteTarget(task.id)} className="text-rose-500">Delete</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                            {isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !task.completed && (
                                                <div className="h-1 w-full bg-rose-500/20">
                                                    <div className="h-full bg-rose-500 w-1/3 animate-pulse" />
                                                </div>
                                            )}
                                            {/* Subtasks / Checklist */}
                                            {((task.subtasks?.length > 0) || expandedSubtaskId === task.id) && (
                                                <div className="px-4 pb-3 border-t border-border/30 pt-2">
                                                    {task.subtasks?.length > 0 && (
                                                        <div className="space-y-1 mb-2">
                                                            {task.subtasks.map((sub: any) => (
                                                                <div key={sub.id} className="flex items-center gap-2 group/sub">
                                                                    <Checkbox
                                                                        checked={sub.completed}
                                                                        onCheckedChange={() => handleToggleSubtask(task.id, sub.id)}
                                                                        className="h-3.5 w-3.5 rounded"
                                                                    />
                                                                    <span className={cn("text-xs flex-1", sub.completed && "line-through text-muted-foreground")}>{sub.title}</span>
                                                                    <button
                                                                        className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5"
                                                                        onClick={() => handleDeleteSubtask(task.id, sub.id)}
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {expandedSubtaskId === task.id && (
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                className="flex-1 text-xs h-7 px-2 rounded border bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                                placeholder="Add checklist item..."
                                                                value={newSubtaskTitle}
                                                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(task.id); if (e.key === "Escape") setExpandedSubtaskId(null) }}
                                                                autoFocus
                                                            />
                                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleAddSubtask(task.id)} disabled={!newSubtaskTitle.trim()}>Add</Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {/* Subtask progress indicator */}
                                            {task.subtasks?.length > 0 && expandedSubtaskId !== task.id && (
                                                <div className="px-4 pb-2">
                                                    <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${Math.round((task.subtasks.filter((s: any) => s.completed).length / task.subtasks.length) * 100)}%` }} />
                                                    </div>
                                                    <span className="text-[9px] text-muted-foreground">{task.subtasks.filter((s: any) => s.completed).length}/{task.subtasks.length} done</span>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <CheckSquare className="h-12 w-12 text-muted-foreground/20 mb-4" />
                        <p className="text-lg font-medium text-foreground mb-1">No tasks yet</p>
                        <p className="text-sm text-muted-foreground mb-4 max-w-sm">Create a task to stay on top of your work</p>
                        <Button onClick={() => { setEditingTask(null); setIsCreateDialogOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Task
                        </Button>
                    </div>
                )}
            </div>
            </div>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Task</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this task? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && handleDeleteTask(deleteTarget)}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Delete Dialog */}
            <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedTaskIds.size} Tasks</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete {selectedTaskIds.size} selected task{selectedTaskIds.size !== 1 ? "s" : ""}? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleBulkDelete} disabled={bulkActionLoading}>
                            {bulkActionLoading ? "Deleting..." : `Delete ${selectedTaskIds.size} Tasks`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Recurring Exception Dialog */}
            <AlertDialog open={!!recurringExceptionTarget} onOpenChange={(open) => { if (!open) setRecurringExceptionTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Recurring Task</AlertDialogTitle>
                        <AlertDialogDescription>
                            &quot;{recurringExceptionTarget?.title}&quot; is a recurring task. What would you like to do with this occurrence?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-2 py-2">
                        <Button
                            variant="outline"
                            className="justify-start h-auto py-3 px-4"
                            onClick={() => handleRecurringComplete("complete")}
                        >
                            <div className="text-left">
                                <p className="font-semibold text-sm">Complete this occurrence</p>
                                <p className="text-xs text-muted-foreground">Mark as done and create the next occurrence</p>
                            </div>
                        </Button>
                        <Button
                            variant="outline"
                            className="justify-start h-auto py-3 px-4"
                            onClick={() => handleRecurringComplete("skip")}
                        >
                            <div className="text-left">
                                <p className="font-semibold text-sm">Skip this occurrence</p>
                                <p className="text-xs text-muted-foreground">Skip this one and keep future occurrences</p>
                            </div>
                        </Button>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Comments Sheet */}
            <Sheet open={!!commentSheetTaskId} onOpenChange={(open) => { if (!open) { setCommentSheetTaskId(null); setComments([]); setNewComment(""); } }}>
                <SheetContent className="sm:max-w-[420px] flex flex-col">
                    <SheetHeader>
                        <SheetTitle className="text-left">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-primary" />
                                Comments
                            </div>
                            {commentSheetTask && (
                                <p className="text-sm font-normal text-muted-foreground mt-1 truncate">{commentSheetTask.title}</p>
                            )}
                        </SheetTitle>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto mt-4 space-y-4 min-h-0">
                        {isLoadingComments ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            </div>
                        ) : comments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
                                <p className="text-sm text-muted-foreground">No comments yet</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Add the first comment below</p>
                            </div>
                        ) : (
                            comments.map(comment => (
                                <div key={comment.id} className="flex gap-3 p-3 rounded-xl bg-muted/10 border border-white/5">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-black text-primary">
                                        {comment.userName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold">{comment.userName}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {comment.createdAt ? format(new Date(comment.createdAt), "MMM d, h:mm a") : ""}
                                            </span>
                                        </div>
                                        <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">{comment.text}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="border-t border-white/10 pt-4 mt-4 flex gap-2">
                        <Textarea
                            placeholder="Write a comment..."
                            value={newComment}
                            onChange={(e: any) => setNewComment(e.target.value)}
                            className="resize-none h-20 flex-1"
                            onKeyDown={(e: any) => {
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                    handleAddComment()
                                }
                            }}
                        />
                        <Button
                            size="icon"
                            className="h-10 w-10 shrink-0 self-end"
                            disabled={!newComment.trim()}
                            onClick={handleAddComment}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Templates Dialog */}
            <TemplateDialog
                isOpen={isTemplateDialogOpen}
                onClose={() => setIsTemplateDialogOpen(false)}
                templates={templates}
                setTemplates={setTemplates}
                isLoading={isLoadingTemplates}
                onApply={handleApplyTemplate}
            />
        </div>
    )
}

// ── Template Dialog ─────────────────────────────────────────────────────────

function TemplateDialog({
    isOpen,
    onClose,
    templates,
    setTemplates,
    isLoading,
    onApply,
}: {
    isOpen: boolean
    onClose: () => void
    templates: TaskTemplate[]
    setTemplates: (t: TaskTemplate[]) => void
    isLoading: boolean
    onApply: (id: string) => void
}) {
    const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    // Editor state
    const [templateName, setTemplateName] = useState("")
    const [templateTasks, setTemplateTasks] = useState<TemplateTask[]>([])

    const openEditor = (template?: TaskTemplate) => {
        if (template) {
            setEditingTemplate(template)
            setTemplateName(template.name)
            setTemplateTasks([...template.tasks])
        } else {
            setEditingTemplate(null)
            setTemplateName("")
            setTemplateTasks([{ title: "", priority: "MEDIUM", relativeDueDays: 0 }])
        }
        setIsCreating(true)
    }

    const addTaskRow = () => {
        setTemplateTasks(prev => [...prev, { title: "", priority: "MEDIUM", relativeDueDays: 0 }])
    }

    const removeTaskRow = (index: number) => {
        setTemplateTasks(prev => prev.filter((_, i) => i !== index))
    }

    const updateTaskRow = (index: number, field: keyof TemplateTask, value: any) => {
        setTemplateTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
    }

    const handleSaveTemplate = async () => {
        const validTasks = templateTasks.filter(t => t.title.trim())
        if (!templateName.trim() || validTasks.length === 0) {
            toast.error("Template needs a name and at least one task")
            return
        }

        try {
            if (editingTemplate) {
                await updateTaskTemplate(editingTemplate.id, { name: templateName, tasks: validTasks })
                toast.success("Template updated")
            } else {
                await createTaskTemplate({ name: templateName, tasks: validTasks })
                toast.success("Template created")
            }
            // Reload templates
            const data = await getTaskTemplates()
            setTemplates(data)
            setIsCreating(false)
        } catch {
            toast.error("Failed to save template")
        }
    }

    const handleDeleteTemplate = async (id: string) => {
        try {
            await deleteTaskTemplate(id)
            setTemplates(templates.filter(t => t.id !== id))
            toast.success("Template deleted")
        } catch {
            toast.error("Failed to delete template")
        }
    }

    const handleCreateDefault = async (template: Omit<TaskTemplate, "id" | "createdAt">) => {
        try {
            await createTaskTemplate({ name: template.name, tasks: template.tasks })
            const data = await getTaskTemplates()
            setTemplates(data)
            toast.success(`"${template.name}" template created`)
        } catch {
            toast.error("Failed to create template")
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setIsCreating(false); } }}>
            <DialogContent className="sm:max-w-[600px] border-white/10 bg-background/95 backdrop-blur-xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LayoutTemplate className="h-5 w-5 text-primary" />
                        {isCreating ? (editingTemplate ? "Edit Template" : "Create Template") : "Task Templates"}
                    </DialogTitle>
                </DialogHeader>

                {isCreating ? (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">Template Name</label>
                            <Input
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="e.g., New Tenant Onboarding"
                                autoFocus
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Tasks</label>
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addTaskRow}>
                                    <Plus className="h-3 w-3" /> Add Task
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {templateTasks.map((task, index) => (
                                    <div key={index} className="flex items-start gap-2 p-3 rounded-xl bg-muted/10 border border-white/5">
                                        <div className="flex-1 space-y-2">
                                            <Input
                                                value={task.title}
                                                onChange={(e) => updateTaskRow(index, "title", e.target.value)}
                                                placeholder="Task title"
                                                className="h-8 text-sm"
                                            />
                                            <div className="flex gap-2">
                                                <Select value={task.priority || "MEDIUM"} onValueChange={(v) => updateTaskRow(index, "priority", v)}>
                                                    <SelectTrigger className="h-7 text-xs w-24">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="LOW">Low</SelectItem>
                                                        <SelectItem value="MEDIUM">Medium</SelectItem>
                                                        <SelectItem value="HIGH">High</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Due in</span>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={365}
                                                        value={task.relativeDueDays ?? 0}
                                                        onChange={(e) => updateTaskRow(index, "relativeDueDays", parseInt(e.target.value) || 0)}
                                                        className="h-7 w-14 text-xs"
                                                    />
                                                    <span className="text-[10px] text-muted-foreground">days</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-rose-500"
                                            onClick={() => removeTaskRow(index)}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreating(false)}>Back</Button>
                            <Button onClick={handleSaveTemplate} disabled={!templateName.trim() || templateTasks.filter(t => t.title.trim()).length === 0}>
                                {editingTemplate ? "Update" : "Create"} Template
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            </div>
                        ) : (
                            <>
                                {/* Saved Templates */}
                                {templates.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Saved Templates</h3>
                                        {templates.map(template => (
                                            <div key={template.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-white/5 hover:bg-muted/20 transition-all group">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold truncate">{template.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{template.tasks.length} tasks</p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onApply(template.id)} title="Apply template">
                                                        <Plus className="h-3.5 w-3.5 text-primary" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEditor(template)}>
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500" onClick={() => handleDeleteTemplate(template.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Default Templates */}
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quick-Start Templates</h3>
                                    <p className="text-xs text-muted-foreground">Click to save these as your own templates.</p>
                                    {DEFAULT_TEMPLATES.map((template, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-muted/5 border border-white/5 border-dashed hover:bg-muted/10 hover:border-white/10 transition-all cursor-pointer" onClick={() => handleCreateDefault(template)}>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate">{template.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{template.tasks.length} tasks</p>
                                            </div>
                                            <Plus className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        <DialogFooter>
                            <Button variant="outline" onClick={onClose}>Close</Button>
                            <Button onClick={() => openEditor()}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Template
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
