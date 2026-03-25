"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Plus,
    Filter,
    Calendar as CalendarIcon,
    Check,
    Clock,
    LayoutGrid,
    X,
    Tag,
    ArrowRight,
    Pencil
} from "lucide-react"
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    isSameMonth,
    isSameDay,
    addWeeks,
    subWeeks,
    isToday
} from "date-fns"
import { getUnifiedEvents, updateTask } from "./actions"
import { CalendarEvent } from "@/lib/calendar-sync"
import { CreateTaskDialog } from "@/components/ui/CreateTaskDialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "sonner"
import dynamic from "next/dynamic"

const TasksPage = dynamic(() => import("@/app/tasks/page"), { ssr: false })
const BookingCalendar = dynamic(() => import("@/app/dashboard/bookings/BookingCalendar").then(mod => mod.BookingCalendar), { ssr: false })

type ViewMode = "month" | "week" | "day"

export default function CalendarPage() {
    const [activeTab, setActiveTab] = useState("calendar")
    const [currentDate, setCurrentDate] = useState(new Date())
    const [viewMode, setViewMode] = useState<ViewMode>("month")
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [activeSources, setActiveSources] = useState<string[]>(["APPLE", "SYSTEM", "TASK", "EVENT"])
    const [activeGoogleCalendars, setActiveGoogleCalendars] = useState<string[]>([])
    const [googleFolderOpen, setGoogleFolderOpen] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [filterSheetOpen, setFilterSheetOpen] = useState(false)
    const [clickedDate, setClickedDate] = useState<Date | null>(null)
    const [editingTaskData, setEditingTaskData] = useState<any>(null)
    const router = useRouter()
    const isMobile = useIsMobile()

    const loadEvents = async () => {
        setIsLoading(true)
        const allEvents = await getUnifiedEvents(60)
        setEvents(allEvents)
        const uniqueGoogleCals = Array.from(new Set(allEvents.filter(e => e.source === "GOOGLE" && e.calendarId).map(e => e.calendarId as string)))
        setActiveGoogleCalendars(uniqueGoogleCals)
        setIsLoading(false)
    }

    useEffect(() => { loadEvents() }, [])

    const nextTime = () => {
        if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1))
        else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1))
        else setCurrentDate(addDays(currentDate, 1))
    }

    const prevTime = () => {
        if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1))
        else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1))
        else setCurrentDate(addDays(currentDate, -1))
    }

    const getEventsForDay = (day: Date) => {
        return events.filter(e => {
            if (!isSameDay(new Date(e.start), day)) return false;
            if (e.source === "GOOGLE") return e.calendarId && activeGoogleCalendars.includes(e.calendarId);
            return activeSources.includes(e.source)
        })
    }

    const toggleSource = (source: string) => {
        setActiveSources(prev => prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source])
    }

    const toggleGoogleCategory = (calendarId: string) => {
        setActiveGoogleCalendars(prev => prev.includes(calendarId) ? prev.filter(c => c !== calendarId) : [...prev, calendarId])
    }

    const googleCalendars = useMemo(() => Array.from(new Map(
        events.filter(e => e.source === "GOOGLE" && e.calendarId).map(e => [e.calendarId, { id: e.calendarId as string, name: e.calendarName || "Google Calendar", color: e.color || "#4285F4" }])
    ).values()), [events])

    const allGoogleEnabled = googleCalendars.length > 0 && googleCalendars.every(c => activeGoogleCalendars.includes(c.id))
    const someGoogleEnabled = googleCalendars.some(c => activeGoogleCalendars.includes(c.id))

    const toggleAllGoogle = () => {
        if (allGoogleEnabled) setActiveGoogleCalendars([])
        else setActiveGoogleCalendars(googleCalendars.map(c => c.id))
    }

    // Click-to-add handler
    const handleCellClick = useCallback((date: Date) => {
        setClickedDate(date)
        setIsCreateDialogOpen(true)
    }, [])

    // Drag-and-drop handler for rescheduling events
    const handleEventDrop = useCallback(async (eventId: string, newDate: Date) => {
        // Only allow dragging TASK and EVENT items (CRM items we own)
        const event = events.find(e => e.id === eventId)
        if (!event || (event.source !== "TASK" && event.source !== "EVENT")) {
            toast.error("Only CRM tasks and events can be rescheduled by dragging")
            return
        }

        // Extract the real task ID from event ID (format: "task-{taskId}" or "event-{taskId}")
        const taskId = eventId.replace(/^(task|event)-/, "")

        // Optimistic update
        setEvents(prev => prev.map(e =>
            e.id === eventId ? { ...e, start: newDate, end: newDate } : e
        ))

        try {
            await updateTask(taskId, { dueDate: newDate })
            toast.success("Task rescheduled")
        } catch {
            toast.error("Failed to reschedule task")
            loadEvents() // Rollback by reloading
        }
    }, [events])

    // ─── Mobile Layout ──────────────────────────────────────────────
    if (isMobile) {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
        const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
        const todayEvents = getEventsForDay(currentDate).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

        return (
            <div className="flex flex-col h-full bg-background">
                {/* Header */}
                <div className="px-4 pt-3 pb-2 border-b border-border">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">{format(currentDate, "MMMM yyyy")}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
                                onClick={() => setCurrentDate(new Date())}
                            >
                                Today
                            </button>
                            <button
                                className="h-10 w-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground touch-manipulation active:scale-95 transition-transform"
                                onClick={() => { setClickedDate(null); setIsCreateDialogOpen(true); }}
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                    {/* Tab pills */}
                    <div className="flex gap-1 bg-muted rounded-xl p-1">
                        {[
                            { value: "calendar", label: "Calendar" },
                            { value: "bookings", label: "Stays" },
                            { value: "tasks", label: "Tasks" },
                        ].map(tab => (
                            <button
                                key={tab.value}
                                onClick={() => setActiveTab(tab.value)}
                                className={cn(
                                    "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                    activeTab === tab.value
                                        ? "bg-primary/15 text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {activeTab === "calendar" && (
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Week strip */}
                        <div className="flex items-center border-b border-border px-2 py-2">
                            <button
                                className="p-2 rounded-lg hover:bg-muted touch-manipulation"
                                onClick={() => setCurrentDate(addDays(currentDate, -7))}
                            >
                                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                            </button>
                            <div className="flex-1 flex justify-around">
                                {weekDays.map(day => {
                                    const dayEvts = getEventsForDay(day)
                                    const selected = isSameDay(day, currentDate)
                                    const today = isToday(day)
                                    return (
                                        <button
                                            key={day.toISOString()}
                                            className="flex flex-col items-center gap-1 py-1 touch-manipulation"
                                            onClick={() => setCurrentDate(day)}
                                        >
                                            <span className="text-[10px] font-medium text-muted-foreground">{format(day, "EEE")}</span>
                                            <span className={cn(
                                                "flex items-center justify-center h-9 w-9 rounded-full text-sm font-bold transition-all",
                                                selected && today && "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
                                                selected && !today && "bg-primary/20 text-foreground",
                                                !selected && today && "text-primary font-black",
                                                !selected && !today && "text-muted-foreground"
                                            )}>
                                                {format(day, "d")}
                                            </span>
                                            {dayEvts.length > 0 && !selected && (
                                                <span className="h-1 w-1 rounded-full bg-primary" />
                                            )}
                                            {dayEvts.length > 0 && selected && (
                                                <span className="h-1 w-1 rounded-full bg-foreground/60" />
                                            )}
                                            {dayEvts.length === 0 && <span className="h-1" />}
                                        </button>
                                    )
                                })}
                            </div>
                            <button
                                className="p-2 rounded-lg hover:bg-muted touch-manipulation"
                                onClick={() => setCurrentDate(addDays(currentDate, 7))}
                            >
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Day heading */}
                        <div className="px-4 pt-3 pb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                {isToday(currentDate) ? "Today" : format(currentDate, "EEEE, MMM d")}
                                {todayEvents.length > 0 && ` · ${todayEvents.length} event${todayEvents.length !== 1 ? "s" : ""}`}
                            </span>
                        </div>

                        {/* Events list */}
                        <div className="flex-1 overflow-y-auto px-4 pb-28">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : todayEvents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <CalendarIcon className="h-10 w-10 text-muted-foreground/50 mb-3" />
                                    <p className="text-sm font-medium text-muted-foreground">No events</p>
                                    <p className="text-xs text-muted-foreground mt-1">Tap + to add an event</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {todayEvents.map(event => {
                                        const startTime = new Date(event.start)
                                        const isAllDay = startTime.getHours() === 0 && startTime.getMinutes() === 0
                                        return (
                                            <button
                                                key={event.id}
                                                className="w-full flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border active:bg-muted transition-colors text-left touch-manipulation"
                                                onClick={() => setSelectedEvent(event)}
                                            >
                                                <div
                                                    className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                                                    style={{ backgroundColor: event.color || "#3B82F6" }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-muted-foreground">
                                                            {isAllDay ? "All day" : format(startTime, "h:mm a")}
                                                        </span>
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                                                            {event.source === "GOOGLE" ? "Google" : event.source === "APPLE" ? "iCal" : event.source === "TASK" ? "Task" : event.source === "EVENT" ? "Event" : "Stay"}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Filter button */}
                        <button
                            className="fixed bottom-28 left-4 z-30 flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border text-xs font-medium text-foreground shadow-lg touch-manipulation"
                            onClick={() => setFilterSheetOpen(true)}
                        >
                            <Filter className="h-3.5 w-3.5" />
                            Filters
                        </button>
                    </div>
                )}

                {activeTab === "bookings" && (
                    <div className="flex-1 overflow-y-auto pb-28 p-4">
                        <BookingCalendar />
                    </div>
                )}

                {activeTab === "tasks" && (
                    <div className="flex-1 overflow-y-auto pb-28">
                        <TasksPage />
                    </div>
                )}

                {/* Shared modals */}
                <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                    <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl">
                        <SheetHeader>
                            <SheetTitle>Event Sources</SheetTitle>
                        </SheetHeader>
                        <div className="space-y-1 mt-4">
                            <div className="rounded-xl overflow-hidden">
                                <div className="flex items-center w-full p-3 rounded-xl hover:bg-muted/20 transition-colors">
                                    <button onClick={() => setGoogleFolderOpen(o => !o)} className="flex items-center justify-center h-8 w-8 shrink-0 rounded hover:bg-muted transition-colors touch-manipulation">
                                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", !googleFolderOpen && "-rotate-90")} />
                                    </button>
                                    <button onClick={toggleAllGoogle} className="flex items-center gap-3 flex-1 min-w-0 ml-1 text-sm font-semibold text-foreground text-left touch-manipulation">
                                        <div className="h-4 w-4 rounded-sm bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0">
                                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                                        </div>
                                        <span className="truncate">Google Calendar</span>
                                    </button>
                                </div>
                                {googleFolderOpen && googleCalendars.map(cal => (
                                    <button key={`mf-google-${cal.id}`} onClick={() => toggleGoogleCategory(cal.id)} className="flex items-center gap-3 w-full px-3 py-3 pl-11 rounded-lg text-sm font-medium transition-all hover:bg-muted/20 min-h-[44px] touch-manipulation">
                                        <div className="w-[3px] h-4 rounded-full shrink-0" style={{ backgroundColor: cal.color, opacity: activeGoogleCalendars.includes(cal.id) ? 1 : 0.3 }} />
                                        <span className={cn("truncate flex-1 text-left", activeGoogleCalendars.includes(cal.id) ? "opacity-100" : "opacity-40")}>{cal.name}</span>
                                    </button>
                                ))}
                            </div>
                            {[
                                { id: "APPLE", label: "Apple Calendar", color: "#9966FF" },
                                { id: "SYSTEM", label: "Stay Dates", color: "#10B981" },
                                { id: "TASK", label: "CRM Tasks", color: "#F59E0B" },
                                { id: "EVENT", label: "CRM Events", color: "#6366F1" }
                            ].map(source => (
                                <button key={`mf-${source.id}`} onClick={() => toggleSource(source.id)} className="flex items-center justify-between w-full px-3 py-3 rounded-xl text-sm font-medium transition-all hover:bg-muted/20 min-h-[44px] touch-manipulation">
                                    <div className="flex items-center gap-3">
                                        <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: source.color }} />
                                        <span className={cn("transition-opacity", activeSources.includes(source.id) ? "opacity-100" : "opacity-40")}>{source.label}</span>
                                    </div>
                                    <div className={cn("h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-all", activeSources.includes(source.id) ? "border-blue-500 bg-blue-500" : "border-border bg-transparent")}>
                                        {activeSources.includes(source.id) && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>
                <CreateTaskDialog
                    isOpen={isCreateDialogOpen}
                    onClose={() => { setIsCreateDialogOpen(false); setClickedDate(null); setEditingTaskData(null); }}
                    onSaved={(type) => { const label = type === "event" ? "Event" : "Task"; toast.success(editingTaskData ? `${label} updated` : `${label} created`); loadEvents(); setEditingTaskData(null); }}
                    initialDate={clickedDate}
                    initialData={editingTaskData}
                />
                {selectedEvent && (
                    <EventDetailModal
                        event={selectedEvent}
                        onClose={() => setSelectedEvent(null)}
                        onNavigate={(url) => { setSelectedEvent(null); router.push(url); }}
                        onEditTask={(taskId) => {
                            setSelectedEvent(null)
                            import("./actions").then(async ({ getTaskById }) => {
                                const task = await getTaskById(taskId)
                                if (task) {
                                    setClickedDate(null)
                                    setEditingTaskData(task)
                                    setIsCreateDialogOpen(true)
                                }
                            })
                        }}
                    />
                )}
            </div>
        )
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-4 border-b bg-card/50 backdrop-blur-md shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Calendar
                        </h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
                            Manage schedules, tasks, and property bookings.
                        </p>
                    </div>
                    {activeTab === "calendar" && (
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <Button variant="outline" size="sm" className="h-9 gap-2 md:hidden touch-manipulation" onClick={() => setFilterSheetOpen(true)}>
                                <Filter className="h-4 w-4" />
                                Filters
                            </Button>
                            <div className="flex items-center rounded-xl bg-muted/30 p-1 border border-border">
                                <Button variant={viewMode === "month" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-lg text-xs font-semibold px-3 sm:px-4 touch-manipulation" onClick={() => setViewMode("month")}>Month</Button>
                                <Button variant={viewMode === "week" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-lg text-xs font-semibold px-3 sm:px-4 touch-manipulation" onClick={() => setViewMode("week")}>Week</Button>
                                <Button variant={viewMode === "day" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-lg text-xs font-semibold px-3 sm:px-4 touch-manipulation" onClick={() => setViewMode("day")}>Day</Button>
                            </div>
                            <Button size="sm" className="h-9 gap-2 shadow-lg shadow-primary/20 touch-manipulation" onClick={() => { setClickedDate(null); setIsCreateDialogOpen(true); }}>
                                <Plus className="h-4 w-4" />
                                Add Item
                            </Button>
                        </div>
                    )}
                </div>
                <TabsList className="bg-muted/30 border border-border flex-wrap h-auto gap-0.5 p-1 mt-4">
                    <TabsTrigger value="calendar" className="text-xs font-semibold">Calendar</TabsTrigger>
                    <TabsTrigger value="bookings" className="text-xs font-semibold">Stays</TabsTrigger>
                    <TabsTrigger value="tasks" className="text-xs font-semibold">Tasks</TabsTrigger>
                </TabsList>
            </div>

            {/* Stays Tab */}
            <TabsContent value="bookings" className="flex-1 overflow-y-auto m-0 p-4 sm:p-6 lg:p-8">
                <BookingCalendar />
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="flex-1 overflow-y-auto m-0">
                <TasksPage />
            </TabsContent>

            {/* Calendar Tab */}
            <TabsContent value="calendar" className="flex-1 flex flex-col md:flex-row overflow-hidden m-0 min-h-0">
                {/* Sidebar */}
                <aside className="hidden md:flex w-72 border-r bg-card/30 backdrop-blur-xl p-4 lg:p-6 flex-col gap-6 shrink-0 overflow-y-auto">
                    {/* Mini Calendar */}
                    <div>
                        {(() => {
                            const miniStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 })
                            const miniEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })
                            const miniDays: Date[] = []
                            let d = miniStart
                            while (d <= miniEnd) { miniDays.push(d); d = addDays(d, 1) }
                            return (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 rounded hover:bg-muted/30"><ChevronLeft className="h-3 w-3" /></button>
                                        <span className="text-[11px] font-bold">{format(currentDate, "MMMM yyyy")}</span>
                                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 rounded hover:bg-muted/30"><ChevronRight className="h-3 w-3" /></button>
                                    </div>
                                    <div className="grid grid-cols-7 gap-0">
                                        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(day => (
                                            <div key={day} className="text-[10px] font-bold text-muted-foreground/50 text-center py-1">{day}</div>
                                        ))}
                                        {miniDays.map((day, i) => {
                                            const dayEvents = events.filter(e => isSameDay(new Date(e.start), day))
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => { setCurrentDate(day); setViewMode("day") }}
                                                    className={cn(
                                                        "relative h-7 w-full text-[10px] rounded-md transition-colors",
                                                        !isSameMonth(day, currentDate) && "text-muted-foreground/30",
                                                        isToday(day) && "bg-primary text-primary-foreground font-bold",
                                                        isSameDay(day, currentDate) && !isToday(day) && "bg-muted font-bold",
                                                        !isToday(day) && !isSameDay(day, currentDate) && "hover:bg-muted/30",
                                                    )}
                                                >
                                                    {day.getDate()}
                                                    {dayEvents.length > 0 && !isToday(day) && (
                                                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })()}
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Event Sources</h3>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Filter className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="space-y-1">
                            {/* Google Calendar folder */}
                            <div className="rounded-xl overflow-hidden">
                                <div className="flex items-center w-full p-2.5 rounded-xl hover:bg-muted/20 transition-colors">
                                    <button onClick={() => setGoogleFolderOpen(o => !o)} className="flex items-center justify-center h-5 w-5 shrink-0 rounded hover:bg-muted transition-colors">
                                        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", !googleFolderOpen && "-rotate-90")} />
                                    </button>
                                    <button onClick={toggleAllGoogle} className="flex items-center gap-2.5 flex-1 min-w-0 ml-1 text-xs font-semibold text-foreground text-left">
                                        <div className="h-3.5 w-3.5 rounded-sm bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0">
                                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                        </div>
                                        <span className="truncate">Google Calendar</span>
                                    </button>
                                    <button onClick={toggleAllGoogle} className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0 ml-2 transition-all", allGoogleEnabled ? "border-blue-500 bg-blue-500" : someGoogleEnabled ? "border-blue-500/60 bg-blue-500/30" : "border-border bg-transparent hover:border-blue-400")}>
                                        {allGoogleEnabled && <Check className="h-2.5 w-2.5 text-white" />}
                                        {!allGoogleEnabled && someGoogleEnabled && <div className="h-1.5 w-1.5 rounded-sm bg-blue-400" />}
                                    </button>
                                </div>
                                {googleFolderOpen && (
                                    <div className="pl-5 pb-1 space-y-0.5">
                                        {googleCalendars.length === 0 ? (
                                            <p className="text-[10px] text-muted-foreground px-2 py-1">No calendars loaded yet</p>
                                        ) : googleCalendars.map(cal => (
                                            <button key={`google-${cal.id}`} onClick={() => toggleGoogleCategory(cal.id)} className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-[11px] font-medium transition-all hover:bg-muted/20">
                                                <div className="w-[3px] h-3.5 rounded-full shrink-0 self-center" style={{ backgroundColor: cal.color, opacity: activeGoogleCalendars.includes(cal.id) ? 1 : 0.3 }} />
                                                <span className={cn("truncate flex-1 text-left transition-opacity", activeGoogleCalendars.includes(cal.id) ? "opacity-100" : "opacity-40")}>{cal.name}</span>
                                                <div className="relative h-4 w-7 rounded-full shrink-0 transition-all duration-200" style={{ backgroundColor: activeGoogleCalendars.includes(cal.id) ? cal.color : "var(--muted)" }}>
                                                    <div className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-200", activeGoogleCalendars.includes(cal.id) ? "left-3.5" : "left-0.5")} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {[
                                { id: "APPLE", label: "Apple Calendar", color: "#9966FF" },
                                { id: "SYSTEM", label: "Stay Dates", color: "#10B981" },
                                { id: "TASK", label: "CRM Tasks", color: "#F59E0B" },
                                { id: "EVENT", label: "CRM Events", color: "#6366F1" }
                            ].map(source => (
                                <button key={source.id} onClick={() => toggleSource(source.id)} className="flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-xs font-medium transition-all hover:bg-muted/20">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: source.color }} />
                                        <span className={cn("transition-opacity", activeSources.includes(source.id) ? "opacity-100" : "opacity-40")}>{source.label}</span>
                                    </div>
                                    <div className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all", activeSources.includes(source.id) ? "border-blue-500 bg-blue-500" : "border-border bg-transparent hover:border-blue-400")}>
                                        {activeSources.includes(source.id) && <Check className="h-2.5 w-2.5 text-white" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-4">Quick Tasks</h3>
                        <div className="space-y-3">
                            {events.filter(e => e.source === "TASK" && !isSameDay(new Date(e.start), new Date())).slice(0, 3).map(task => (
                                <div key={task.id} className="group flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border hover:border-border hover:bg-muted transition-all cursor-pointer">
                                    <div className="mt-0.5 h-4 w-4 rounded border border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
                                        <div className="h-2 w-2 rounded-sm bg-primary opacity-0 group-hover:opacity-20 transition-opacity" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-semibold truncate leading-tight">{task.title.replace('Task: ', '')}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">{format(new Date(task.start), 'MMM d, yyyy')}</p>
                                    </div>
                                </div>
                            ))}
                            <Button variant="ghost" className="w-full justify-start h-8 text-[10px] font-bold text-primary gap-2 hover:bg-primary/5">
                                <Plus className="h-3 w-3" />
                                VIEW ALL TASKS
                            </Button>
                        </div>
                    </div>
                </aside>

                {/* Calendar Body */}
                <div className="flex-1 flex flex-col overflow-hidden bg-muted/5 min-w-0">
                    <div className="p-4 sm:p-6 border-b bg-card/20 flex flex-wrap items-center justify-between gap-3 sm:gap-4 shrink-0">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 min-w-0">
                            <h2 className="text-lg sm:text-xl font-black tracking-tight capitalize truncate">
                                {format(currentDate, viewMode === "month" ? "MMMM yyyy" : "MMMM d, yyyy")}
                            </h2>
                            <div className="flex items-center gap-1 rounded-xl bg-muted/30 p-1 border border-border">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg touch-manipulation" onClick={prevTime}>
                                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 px-3 sm:px-4 rounded-lg text-[11px] font-black uppercase text-muted-foreground tracking-widest hover:text-foreground touch-manipulation" onClick={() => setCurrentDate(new Date())}>
                                    Today
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg touch-manipulation" onClick={nextTime}>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                        </div>
                        {isLoading && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground animate-pulse">
                                <div className="h-2 w-2 rounded-full bg-primary" />
                                SYNCING...
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto p-2 sm:p-4 md:p-6">
                        {viewMode === "month" && <MonthView date={currentDate} getEvents={getEventsForDay} onEventClick={setSelectedEvent} onCellClick={handleCellClick} onEventDrop={handleEventDrop} />}
                        {viewMode === "week" && <WeekView date={currentDate} getEvents={getEventsForDay} onEventClick={setSelectedEvent} onCellClick={handleCellClick} onEventDrop={handleEventDrop} />}
                        {viewMode === "day" && <DayView date={currentDate} getEvents={getEventsForDay} onEventClick={setSelectedEvent} onCellClick={handleCellClick} onEventDrop={handleEventDrop} />}
                    </div>
                </div>
            </TabsContent>

            {/* Mobile Filter Sheet */}
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl">
                    <SheetHeader>
                        <SheetTitle>Event Sources</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-1 mt-4">
                        {/* Google Calendar folder */}
                        <div className="rounded-xl overflow-hidden">
                            <div className="flex items-center w-full p-3 rounded-xl hover:bg-muted/20 transition-colors">
                                <button onClick={() => setGoogleFolderOpen(o => !o)} className="flex items-center justify-center h-8 w-8 shrink-0 rounded hover:bg-muted transition-colors touch-manipulation">
                                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", !googleFolderOpen && "-rotate-90")} />
                                </button>
                                <button onClick={toggleAllGoogle} className="flex items-center gap-3 flex-1 min-w-0 ml-1 text-sm font-semibold text-foreground text-left touch-manipulation">
                                    <div className="h-4 w-4 rounded-sm bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0">
                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                    </div>
                                    <span className="truncate">Google Calendar</span>
                                </button>
                                <button onClick={toggleAllGoogle} className={cn("h-5 w-5 rounded border flex items-center justify-center shrink-0 ml-2 transition-all touch-manipulation", allGoogleEnabled ? "border-blue-500 bg-blue-500" : someGoogleEnabled ? "border-blue-500/60 bg-blue-500/30" : "border-border bg-transparent hover:border-blue-400")}>
                                    {allGoogleEnabled && <Check className="h-3 w-3 text-white" />}
                                    {!allGoogleEnabled && someGoogleEnabled && <div className="h-2 w-2 rounded-sm bg-blue-400" />}
                                </button>
                            </div>
                            {googleFolderOpen && (
                                <div className="pl-8 pb-1 space-y-0.5">
                                    {googleCalendars.length === 0 ? (
                                        <p className="text-xs text-muted-foreground px-2 py-2">No calendars loaded yet</p>
                                    ) : googleCalendars.map(cal => (
                                        <button key={`mobile-google-${cal.id}`} onClick={() => toggleGoogleCategory(cal.id)} className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium transition-all hover:bg-muted/20 min-h-[44px] touch-manipulation">
                                            <div className="w-[3px] h-4 rounded-full shrink-0 self-center" style={{ backgroundColor: cal.color, opacity: activeGoogleCalendars.includes(cal.id) ? 1 : 0.3 }} />
                                            <span className={cn("truncate flex-1 text-left transition-opacity", activeGoogleCalendars.includes(cal.id) ? "opacity-100" : "opacity-40")}>{cal.name}</span>
                                            <div className="relative h-5 w-9 rounded-full shrink-0 transition-all duration-200" style={{ backgroundColor: activeGoogleCalendars.includes(cal.id) ? cal.color : "var(--muted)" }}>
                                                <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200", activeGoogleCalendars.includes(cal.id) ? "left-4.5" : "left-0.5")} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {[
                            { id: "APPLE", label: "Apple Calendar", color: "#9966FF" },
                            { id: "SYSTEM", label: "Stay Dates", color: "#10B981" },
                            { id: "TASK", label: "CRM Tasks", color: "#F59E0B" }
                        ].map(source => (
                            <button key={`mobile-${source.id}`} onClick={() => toggleSource(source.id)} className="flex items-center justify-between w-full px-3 py-3 rounded-xl text-sm font-medium transition-all hover:bg-muted/20 min-h-[44px] touch-manipulation">
                                <div className="flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: source.color }} />
                                    <span className={cn("transition-opacity", activeSources.includes(source.id) ? "opacity-100" : "opacity-40")}>{source.label}</span>
                                </div>
                                <div className={cn("h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-all", activeSources.includes(source.id) ? "border-blue-500 bg-blue-500" : "border-border bg-transparent hover:border-blue-400")}>
                                    {activeSources.includes(source.id) && <Check className="h-3 w-3 text-white" />}
                                </div>
                            </button>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>

            <CreateTaskDialog
                isOpen={isCreateDialogOpen}
                onClose={() => { setIsCreateDialogOpen(false); setClickedDate(null); setEditingTaskData(null); }}
                onSaved={(type) => { const label = type === "event" ? "Event" : "Task"; toast.success(editingTaskData ? `${label} updated` : `${label} created`); loadEvents(); setEditingTaskData(null); }}
                initialDate={clickedDate}
                initialData={editingTaskData}
            />
            {selectedEvent && (
                <EventDetailModal
                    event={selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                    onNavigate={(url) => { setSelectedEvent(null); router.push(url); }}
                    onEditTask={(taskId) => {
                        setSelectedEvent(null)
                        import("./actions").then(async ({ getTaskById }) => {
                            const task = await getTaskById(taskId)
                            if (task) {
                                setClickedDate(null)
                                setEditingTaskData(task)
                                setIsCreateDialogOpen(true)
                            }
                        })
                    }}
                />
            )}
        </Tabs>
    )
}

// ── Drag & Drop Helpers ─────────────────────────────────────────────────────

function handleDragStart(e: React.DragEvent, event: CalendarEvent) {
    if (event.source !== "TASK") {
        e.preventDefault()
        return
    }
    e.dataTransfer.setData("text/plain", event.id)
    e.dataTransfer.effectAllowed = "move"
    // Add a class to the dragged element for visual feedback
    const target = e.currentTarget as HTMLElement
    setTimeout(() => target.classList.add("opacity-40"), 0)
}

function handleDragEnd(e: React.DragEvent) {
    const target = e.currentTarget as HTMLElement
    target.classList.remove("opacity-40")
}

// ── Month View ──────────────────────────────────────────────────────────────

function MonthView({
    date, getEvents, onEventClick, onCellClick, onEventDrop
}: {
    date: Date
    getEvents: (d: Date) => CalendarEvent[]
    onEventClick: (e: CalendarEvent) => void
    onCellClick: (d: Date) => void
    onEventDrop: (eventId: string, newDate: Date) => void
}) {
    const [dragOverDate, setDragOverDate] = useState<string | null>(null)
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const rows = []
    let days = []
    let day = startDate

    while (day <= endDate) {
        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(day)
            const formattedDate = format(day, "d")
            const dayEvents = getEvents(day)
            const visibleEvents = dayEvents.slice(0, 2)
            const overflowCount = dayEvents.length - 2
            const dayKey = currentDay.toISOString()
            const isDragOver = dragOverDate === dayKey

            days.push(
                <div
                    key={day.toString()}
                    className={cn(
                        "bg-card min-h-[60px] sm:min-h-[100px] md:min-h-[140px] p-1.5 sm:p-3 border-r border-b border-border transition-all flex flex-col gap-1 sm:gap-2 group cursor-pointer",
                        !isSameMonth(day, monthStart) ? "bg-muted/10 opacity-30" : "hover:bg-muted/10",
                        isDragOver && "bg-primary/10 ring-2 ring-primary/30 ring-inset"
                    )}
                    onClick={(e) => {
                        // Only trigger if clicking on the cell background, not an event
                        if ((e.target as HTMLElement).closest('[data-event]')) return
                        onCellClick(currentDay)
                    }}
                    onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = "move"
                        setDragOverDate(dayKey)
                    }}
                    onDragLeave={() => setDragOverDate(null)}
                    onDrop={(e) => {
                        e.preventDefault()
                        setDragOverDate(null)
                        const eventId = e.dataTransfer.getData("text/plain")
                        if (eventId) onEventDrop(eventId, currentDay)
                    }}
                >
                    <div className="flex items-center justify-between">
                        <span className={cn("text-[11px] sm:text-xs font-black w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg transition-colors leading-none", isToday(day) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-muted-foreground group-hover:text-foreground")}>
                            {formattedDate}
                        </span>
                        {isToday(day) && <div className="h-1.5 w-1.5 rounded-full bg-primary hidden sm:block" />}
                    </div>
                    <div className="flex flex-col gap-0.5 sm:gap-1 overflow-hidden">
                        {/* Desktop events */}
                        <div className="hidden sm:flex flex-col gap-1">
                            {dayEvents.map(event => (
                                <div
                                    key={event.id}
                                    data-event
                                    draggable={event.source === "TASK"}
                                    onDragStart={(e) => handleDragStart(e, event)}
                                    onDragEnd={handleDragEnd}
                                    onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                                    className={cn(
                                        "text-[10px] px-2 py-1.5 rounded-lg border truncate font-bold shadow-sm transition-all active:scale-95 cursor-pointer hover:brightness-110 hover:shadow-md",
                                        event.source === "TASK" && "cursor-grab active:cursor-grabbing"
                                    )}
                                    style={{ backgroundColor: `${event.color}15`, borderColor: `${event.color}40`, color: event.color }}
                                >
                                    {event.title}
                                </div>
                            ))}
                        </div>
                        {/* Mobile events */}
                        <div className="flex sm:hidden flex-col gap-0.5">
                            {visibleEvents.map(event => (
                                <div
                                    key={event.id}
                                    data-event
                                    onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                                    className="text-[11px] px-1.5 py-1 rounded-md border truncate font-bold shadow-sm transition-all active:scale-95 cursor-pointer min-h-[24px] touch-manipulation"
                                    style={{ backgroundColor: `${event.color}15`, borderColor: `${event.color}40`, color: event.color }}
                                >
                                    {event.title}
                                </div>
                            ))}
                            {overflowCount > 0 && (
                                <span className="text-[10px] font-bold text-muted-foreground px-1">+{overflowCount} more</span>
                            )}
                        </div>
                    </div>
                    {dayEvents.length === 0 && (
                        <div className="flex-1 hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                    )}
                </div>
            )
            day = addDays(day, 1)
        }
        rows.push(<div className="grid grid-cols-7" key={day.toString()}>{days}</div>)
        days = []
    }

    return (
        <div className="rounded-2xl border border-border overflow-hidden shadow-2xl">
            <div className="grid grid-cols-7 bg-muted/20 border-b border-border">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                    <div key={d} className="py-2 sm:py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                        <span className="sm:hidden">{d.slice(0, 1)}</span>
                        <span className="hidden sm:inline">{d}</span>
                    </div>
                ))}
            </div>
            {rows}
        </div>
    )
}

// ── Week View ───────────────────────────────────────────────────────────────

function WeekView({
    date, getEvents, onEventClick, onCellClick, onEventDrop
}: {
    date: Date
    getEvents: (d: Date) => CalendarEvent[]
    onEventClick: (e: CalendarEvent) => void
    onCellClick: (d: Date) => void
    onEventDrop: (eventId: string, newDate: Date) => void
}) {
    const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)
    const startDate = startOfWeek(date)
    const days = []
    const hours = Array.from({ length: 13 }, (_, i) => i + 8) // 8am to 8pm

    for (let i = 0; i < 7; i++) {
        const day = addDays(startDate, i)
        const dayEvents = getEvents(day)
        days.push(
            <div key={i} className="flex-1 min-w-[100px] sm:min-w-[150px] bg-card/40 border-r border-border last:border-0 group">
                <div className="text-center p-2 sm:p-4 border-b border-border sticky top-0 bg-card/60 backdrop-blur-sm z-10">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{format(day, "EEE")}</p>
                    <p className={cn("text-lg font-black w-10 h-10 flex items-center justify-center rounded-xl mx-auto transition-all", isToday(day) ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20" : "text-foreground")}>
                        {format(day, "d")}
                    </p>
                </div>
                {/* All-day events at top */}
                <div className="px-1 sm:px-2 py-1 border-b border-border min-h-[28px]">
                    {dayEvents.filter(e => {
                        const s = new Date(e.start)
                        return s.getHours() === 0 && s.getMinutes() === 0
                    }).map(event => (
                        <div
                            key={event.id}
                            data-event
                            draggable={event.source === "TASK"}
                            onDragStart={(e) => handleDragStart(e, event)}
                            onDragEnd={handleDragEnd}
                            onClick={() => onEventClick(event)}
                            className={cn(
                                "text-[10px] p-1.5 rounded-lg border font-bold truncate mb-0.5 cursor-pointer hover:brightness-110",
                                event.source === "TASK" && "cursor-grab active:cursor-grabbing"
                            )}
                            style={{ backgroundColor: `${event.color}15`, borderColor: `${event.color}40`, color: event.color }}
                        >
                            {event.title}
                        </div>
                    ))}
                </div>
                {/* Time slots */}
                <div className="divide-y divide-white/5">
                    {hours.map(hour => {
                        const slotDate = new Date(day)
                        slotDate.setHours(hour, 0, 0, 0)
                        const slotKey = slotDate.toISOString()
                        const slotEvents = dayEvents.filter(e => {
                            const s = new Date(e.start)
                            return s.getHours() === hour && !(s.getHours() === 0 && s.getMinutes() === 0)
                        })
                        const isDragOver = dragOverSlot === slotKey

                        return (
                            <div
                                key={hour}
                                className={cn(
                                    "min-h-[48px] p-1 sm:p-2 transition-all cursor-pointer hover:bg-muted/10",
                                    isDragOver && "bg-primary/10 ring-1 ring-primary/30 ring-inset"
                                )}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('[data-event]')) return
                                    onCellClick(slotDate)
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = "move"
                                    setDragOverSlot(slotKey)
                                }}
                                onDragLeave={() => setDragOverSlot(null)}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    setDragOverSlot(null)
                                    const eventId = e.dataTransfer.getData("text/plain")
                                    if (eventId) onEventDrop(eventId, slotDate)
                                }}
                            >
                                <span className="text-[8px] font-bold text-muted-foreground/40 block mb-0.5">
                                    {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                                </span>
                                {slotEvents.map(event => (
                                    <div
                                        key={event.id}
                                        data-event
                                        draggable={event.source === "TASK"}
                                        onDragStart={(e) => handleDragStart(e, event)}
                                        onDragEnd={handleDragEnd}
                                        onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                                        className={cn(
                                            "text-[10px] p-2 rounded-lg border font-bold shadow-md transition-all hover:brightness-110 cursor-pointer mb-1",
                                            event.source === "TASK" && "cursor-grab active:cursor-grabbing"
                                        )}
                                        style={{ backgroundColor: `${event.color}15`, borderColor: `${event.color}40`, color: event.color }}
                                    >
                                        <div className="flex items-center gap-1 opacity-60 mb-0.5">
                                            <Clock className="h-2.5 w-2.5" />
                                            {format(new Date(event.start), 'h:mm a')}
                                        </div>
                                        <span className="truncate block">{event.title}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full rounded-2xl border border-border overflow-hidden shadow-2xl bg-muted/10 min-h-[600px]">
            {days}
        </div>
    )
}

// ── Day View ────────────────────────────────────────────────────────────────

function DayView({
    date, getEvents, onEventClick, onCellClick, onEventDrop
}: {
    date: Date
    getEvents: (d: Date) => CalendarEvent[]
    onEventClick: (e: CalendarEvent) => void
    onCellClick: (d: Date) => void
    onEventDrop: (eventId: string, newDate: Date) => void
}) {
    const [dragOverHour, setDragOverHour] = useState<number | null>(null)
    const [dragSelectStart, setDragSelectStart] = useState<number | null>(null)
    const [dragSelectEnd, setDragSelectEnd] = useState<number | null>(null)
    const [isDragSelecting, setIsDragSelecting] = useState(false)
    const dayEvents = getEvents(date)
    const hours = Array.from({ length: 24 }, (_, i) => i)

    const handleSlotMouseDown = (hour: number) => {
        setDragSelectStart(hour)
        setDragSelectEnd(hour)
        setIsDragSelecting(true)
    }

    const handleSlotMouseEnter = (hour: number) => {
        if (isDragSelecting && dragSelectStart !== null) {
            setDragSelectEnd(hour)
        }
    }

    const handleSlotMouseUp = () => {
        if (isDragSelecting && dragSelectStart !== null && dragSelectEnd !== null) {
            const startHour = Math.min(dragSelectStart, dragSelectEnd)
            const endHour = Math.max(dragSelectStart, dragSelectEnd)
            if (startHour !== endHour) {
                // Multi-hour selection: create event spanning the range
                const slotDate = new Date(date)
                slotDate.setHours(startHour, 0, 0, 0)
                onCellClick(slotDate)
            } else {
                const slotDate = new Date(date)
                slotDate.setHours(startHour, 0, 0, 0)
                onCellClick(slotDate)
            }
        }
        setDragSelectStart(null)
        setDragSelectEnd(null)
        setIsDragSelecting(false)
    }

    const isInDragRange = (hour: number) => {
        if (dragSelectStart === null || dragSelectEnd === null || !isDragSelecting) return false
        const min = Math.min(dragSelectStart, dragSelectEnd)
        const max = Math.max(dragSelectStart, dragSelectEnd)
        return hour >= min && hour <= max
    }

    return (
        <div className="h-full flex flex-col gap-4 sm:gap-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border shadow-xl">
                <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">{format(date, "EEEE")}</p>
                    <h2 className="text-xl sm:text-3xl font-black">{format(date, "MMMM d, yyyy")}</h2>
                </div>
                {isToday(date) && <Badge className="bg-primary/10 text-primary border-primary/20 font-black px-4 py-1.5 uppercase tracking-widest text-[10px]">Today</Badge>}
            </div>

            <div className="flex-1 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col">
                <div className="p-4 sm:p-8 border-b border-border">
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-6 border-l-2 border-primary pl-4">Schedule</h3>
                    <div className="space-y-4">
                        {dayEvents.map(event => (
                            <div
                                key={event.id}
                                data-event
                                draggable={event.source === "TASK"}
                                onDragStart={(e) => handleDragStart(e, event)}
                                onDragEnd={handleDragEnd}
                                onClick={() => onEventClick(event)}
                                className={cn(
                                    "flex items-center gap-3 sm:gap-6 p-3 sm:p-5 rounded-xl sm:rounded-2xl border transition-all hover:translate-x-1 cursor-pointer group min-h-[44px] touch-manipulation",
                                    event.source === "TASK" && "cursor-grab active:cursor-grabbing"
                                )}
                                style={{ backgroundColor: `${event.color}10`, borderColor: `${event.color}20` }}
                            >
                                <div className="text-right min-w-[60px] sm:min-w-[80px]">
                                    <p className="text-xs font-black flex items-center gap-2 justify-end">
                                        <Clock className="h-3 w-3 opacity-40" />
                                        {format(new Date(event.start), 'h:mm a')}
                                    </p>
                                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Start Time</p>
                                </div>
                                <div className="h-10 w-[2px] rounded-full" style={{ backgroundColor: event.color }} />
                                <div className="flex-1">
                                    <p className="text-sm font-black leading-tight mb-0.5">{event.title}</p>
                                    <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">{event.source} EVENT</p>
                                </div>
                                <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-40 transition-opacity" />
                            </div>
                        ))}
                        {dayEvents.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <CalendarIcon className="h-12 w-12 text-muted-foreground/20 mb-4" />
                                <p className="text-lg font-medium text-foreground mb-1">No events</p>
                                <p className="text-sm text-muted-foreground mb-4 max-w-sm">No events scheduled for this day. Click a time slot below to add one.</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 sm:p-8 bg-muted/5 flex-1">
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-4 sm:mb-6 border-l-2 border-border pl-4">Availability</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 select-none" onMouseUp={handleSlotMouseUp} onMouseLeave={() => { if (isDragSelecting) handleSlotMouseUp() }}>
                        {hours.slice(8, 20).map(hour => {
                            const slotDate = new Date(date)
                            slotDate.setHours(hour, 0, 0, 0)
                            const isDragOver = dragOverHour === hour
                            const isSelected = isInDragRange(hour)

                            return (
                                <div
                                    key={hour}
                                    className={cn(
                                        "p-4 rounded-xl border border-border bg-background/20 flex flex-col gap-1 items-center justify-center opacity-40 hover:opacity-100 hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer",
                                        isDragOver && "opacity-100 bg-primary/10 border-primary/30 ring-2 ring-primary/20",
                                        isSelected && "opacity-100 bg-primary/15 border-primary/30 ring-1 ring-primary/20"
                                    )}
                                    onMouseDown={() => handleSlotMouseDown(hour)}
                                    onMouseEnter={() => handleSlotMouseEnter(hour)}
                                    onClick={() => { if (!isDragSelecting) onCellClick(slotDate) }}
                                    onDragOver={(e) => {
                                        e.preventDefault()
                                        e.dataTransfer.dropEffect = "move"
                                        setDragOverHour(hour)
                                    }}
                                    onDragLeave={() => setDragOverHour(null)}
                                    onDrop={(e) => {
                                        e.preventDefault()
                                        setDragOverHour(null)
                                        const eventId = e.dataTransfer.getData("text/plain")
                                        if (eventId) onEventDrop(eventId, slotDate)
                                    }}
                                >
                                    <span className="text-[10px] font-black">{hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Event Detail Modal ──────────────────────────────────────────────────────

function EventDetailModal({ event, onClose, onNavigate, onEditTask }: { event: CalendarEvent, onClose: () => void, onNavigate: (url: string) => void, onEditTask?: (taskId: string) => void }) {
    const sourceLabels: Record<string, string> = { GOOGLE: "Google Calendar", APPLE: "Apple Calendar", SYSTEM: "CRM -- Stay Event", TASK: "CRM Task", EVENT: "Calendar Event" }
    const isAllDay = event.start instanceof Date && event.start.getHours() === 0 && event.start.getMinutes() === 0

    return (
        <Sheet open={true} onOpenChange={(open) => { if (!open) onClose() }}>
            <SheetContent className="lg:max-w-[420px] p-0 flex flex-col gap-0">
                <div className="p-4 sm:p-6 border-b border-border flex items-start justify-between gap-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-1 h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: event.color || "#6366f1" }} />
                        <div className="min-w-0">
                            <SheetTitle className="text-base font-black tracking-tight leading-tight truncate pr-4">{event.title}</SheetTitle>
                            <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: event.color || undefined }}>
                                {sourceLabels[event.source] || event.source}
                                {event.calendarName && event.source === "GOOGLE" && ` · ${event.calendarName}`}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    <div className="rounded-2xl bg-muted/20 border border-border p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><CalendarIcon className="h-4 w-4 text-primary" /></div>
                            <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Date</p>
                                <p className="text-sm font-bold mt-0.5">{format(new Date(event.start), "EEEE, MMMM d, yyyy")}</p>
                            </div>
                        </div>
                        {!isAllDay && (
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Clock className="h-4 w-4 text-primary" /></div>
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Time</p>
                                    <p className="text-sm font-bold mt-0.5">{format(new Date(event.start), "h:mm a")} {String.fromCharCode(8594)} {format(new Date(event.end), "h:mm a")}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    {event.description && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Notes</p>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{event.description}</p>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium">{sourceLabels[event.source]}</span>
                    </div>
                    {(event.source === "TASK" || event.source === "EVENT") && onEditTask && (
                        <Button variant="outline" className="w-full h-9 gap-2 text-sm font-semibold" onClick={() => onEditTask(event.id.replace(/^(task|event)-/, ""))}>
                            <Pencil className="h-3.5 w-3.5" />
                            {event.source === "EVENT" ? "Edit Event" : "Edit Task"}
                        </Button>
                    )}
                </div>
                {event.navigationUrl && (
                    <div className="p-4 sm:p-6 border-t border-border safe-bottom">
                        <Button className="w-full h-11 gap-3 font-black tracking-wide shadow-lg" style={{ backgroundColor: event.color, color: "white" }} onClick={() => onNavigate(event.navigationUrl!)}>
                            View Opportunity
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                        <p className="text-[10px] text-muted-foreground text-center mt-3 font-medium">Opens the associated opportunity</p>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
