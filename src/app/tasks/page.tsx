"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    CheckCircle2,
    Circle,
    Clock,
    Calendar as CalendarIcon,
    AlertCircle,
    User as UserIcon,
    MessageSquare
} from "lucide-react"
import { format, isPast, isToday } from "date-fns"
import { getTasks, toggleTaskComplete, deleteTask } from "../calendar/actions"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { CreateTaskDialog } from "@/components/ui/CreateTaskDialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function TasksPage() {
    const [tasks, setTasks] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [filter, setFilter] = useState<"all" | "active" | "completed">("active")
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<any>(null)

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

    const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: newStatus } : t))
        try {
            await toggleTaskComplete(taskId, newStatus)
        } catch (error) {
            console.error("Failed to toggle task:", error)
            // Rollback
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: currentStatus } : t))
        }
    }

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm("Are you sure you want to delete this task?")) return
        try {
            await deleteTask(taskId)
            loadTasks()
        } catch (error) {
            console.error("Failed to delete task:", error)
        }
    }

    const openEditDialog = (task: any) => {
        setEditingTask(task)
        setIsCreateDialogOpen(true)
    }

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.description?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesFilter = filter === "all" ||
            (filter === "active" && !task.completed) ||
            (filter === "completed" && task.completed)
        return matchesSearch && matchesFilter
    })

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "HIGH": return "text-rose-500 border-rose-500/20 bg-rose-500/10"
            case "MEDIUM": return "text-amber-500 border-amber-500/20 bg-amber-500/10"
            case "LOW": return "text-emerald-500 border-emerald-500/20 bg-emerald-500/10"
            default: return "text-muted-foreground border-muted/20 bg-muted/10"
        }
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden p-4 sm:p-8 pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Task Manager
                    </h2>
                    <p className="text-muted-foreground font-medium text-sm">
                        Keep track of everything you need to do.
                    </p>
                </div>
                <Button className="h-9 gap-2 shadow-lg shadow-primary/20 touch-manipulation w-full sm:w-auto" onClick={() => {
                    setEditingTask(null);
                    setIsCreateDialogOpen(true);
                }}>
                    <Plus className="h-4 w-4" />
                    New Task
                </Button>
            </div>

            <CreateTaskDialog
                isOpen={isCreateDialogOpen}
                onClose={() => {
                    setIsCreateDialogOpen(false);
                    setEditingTask(null);
                }}
                onSaved={loadTasks}
                initialData={editingTask}
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-6">
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
            </div>

            <div className="flex-1 overflow-auto pr-2 space-y-3">
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-20 rounded-2xl border border-white/5 bg-muted/5 animate-pulse" />
                    ))
                ) : filteredTasks.length > 0 ? (
                    filteredTasks.map((task) => (
                        <Card key={task.id} className={cn(
                            "border-white/5 bg-card/40 backdrop-blur-md hover:bg-card/60 active:bg-card/70 transition-all group overflow-hidden touch-manipulation",
                            task.completed && "opacity-60"
                        )}>
                            <CardContent className="p-0">
                                <div className="flex items-center p-4 min-h-[56px]">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <Checkbox
                                            checked={task.completed}
                                            onCheckedChange={() => handleToggleTask(task.id, task.completed)}
                                            className="h-5 w-5 rounded-lg border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className={cn(
                                                    "text-sm font-black leading-none",
                                                    task.completed && "line-through text-muted-foreground"
                                                )}>{task.title}</h3>
                                                <Badge className={cn("text-[9px] font-black px-2 py-0 border leading-none uppercase tracking-tighter", getPriorityColor(task.priority))}>
                                                    {task.priority}
                                                </Badge>
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
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
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
                                                <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-rose-500">Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                {isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !task.completed && (
                                    <div className="h-1 w-full bg-rose-500/20">
                                        <div className="h-full bg-rose-500 w-1/3 animate-pulse" />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-muted-foreground/30 gap-4 border-2 border-dashed border-white/5 rounded-3xl mt-10">
                        <CheckCircle2 className="h-12 w-12 opacity-10" />
                        <p className="text-sm font-black uppercase tracking-[0.3em]">No tasks found</p>
                        <Button variant="outline" size="sm" onClick={() => loadTasks()} className="h-8 text-[10px] font-black uppercase border-white/10 hover:bg-primary/10 hover:text-primary transition-all">Reload</Button>
                    </div>
                )}
            </div>
        </div>
    )
}
