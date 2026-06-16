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
    ArrowLeft,
    Pencil,
    Home,
    CheckSquare,
    Search
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
const AppointmentsPanel = dynamic(() => import("./AppointmentsPanel").then(mod => mod.AppointmentsPanel), { ssr: false })

type ViewMode = "month" | "week" | "day"

export default function CalendarPage() {
    const [activeTab, setActiveTab] = useState("calendar")
    const [currentDate, setCurrentDate] = useState(new Date())
    const [viewMode, setViewMode] = useState<ViewMode>("week")
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [calSearch, setCalSearch] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [activeSources, setActiveSources] = useState<string[]>(["APPLE", "SYSTEM", "TASK", "EVENT", "APPOINTMENT"])
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
        const q = calSearch.trim().toLowerCase()
        return events.filter(e => {
            if (!isSameDay(new Date(e.start), day)) return false;
            if (e.source === "GOOGLE") {
                if (!(e.calendarId && activeGoogleCalendars.includes(e.calendarId))) return false;
            } else if (!activeSources.includes(e.source)) {
                return false;
            }
            if (q && !(e.title || "").toLowerCase().includes(q)) return false;
            return true;
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
                            { value: "appointments", label: "Appts" },
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
                                                            {event.source === "GOOGLE" ? "Google" : event.source === "APPLE" ? "iCal" : event.source === "TASK" ? "Task" : event.source === "EVENT" ? "Event" : event.source === "APPOINTMENT" ? "Booking" : "Stay"}
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

                {activeTab === "appointments" && (
                    <div className="flex-1 overflow-y-auto pb-28 p-4">
                        <AppointmentsPanel />
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
                                { id: "SYSTEM", label: "Opportunity dates", color: "#10B981" },
                                { id: "TASK", label: "CRM Tasks", color: "#F59E0B" },
                                { id: "EVENT", label: "CRM Events", color: "#6366F1" },
                                { id: "APPOINTMENT", label: "Booking appointments", color: "#06B6D4" }
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
                        onCancelAppointment={async (id) => {
                            if (!confirm("Cancel this appointment? The contact will not be notified automatically.")) return
                            const { cancelManualAppointment } = await import("./actions")
                            const res = await cancelManualAppointment(id)
                            if (res.success) {
                                toast.success("Appointment cancelled")
                                setSelectedEvent(null)
                                loadEvents()
                            } else {
                                toast.error(res.error || "Failed to cancel")
                            }
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
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            Calendar
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Stay organized and on track with your personalized calendar.
                        </p>
                    </div>
                    {activeTab === "calendar" && (
                        <div className="flex items-center gap-2 md:hidden">
                            <Button variant="outline" size="sm" className="h-9 gap-2 touch-manipulation" onClick={() => setFilterSheetOpen(true)}>
                                <Filter className="h-4 w-4" />
                                Filters
                            </Button>
                            <Button size="sm" className="h-9 gap-2 shadow-sm touch-manipulation" onClick={() => { setClickedDate(null); setIsCreateDialogOpen(true); }}>
                                <Plus className="h-4 w-4" />
                                New
                            </Button>
                        </div>
                    )}
                </div>
                <div className="mt-4 flex items-stretch gap-3">
                    <TabsList variant="line" className="flex-1 justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 h-auto overflow-x-auto no-scrollbar">
                        {[
                            { value: "calendar", label: "Calendar", Icon: CalendarIcon },
                            { value: "appointments", label: "Appointments", Icon: Clock },
                            { value: "bookings", label: "Bookings", Icon: Home },
                            { value: "tasks", label: "Tasks", Icon: CheckSquare },
                        ].map(({ value, label, Icon }) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="flex-none gap-1.5 rounded-none px-3 py-2 text-xs font-semibold after:bg-primary data-[state=active]:text-primary"
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {activeTab === "calendar" && (
                        <div className="hidden md:flex items-center gap-2 border-b border-border">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    value={calSearch}
                                    onChange={(e) => setCalSearch(e.target.value)}
                                    placeholder="Search events..."
                                    className="h-8 w-36 lg:w-48 rounded-lg border border-border bg-muted/20 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                            </div>
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-xs font-medium" onClick={() => setFilterSheetOpen(true)}>
                                <Filter className="h-3.5 w-3.5" />
                                Filter
                            </Button>
                            <Button size="sm" className="h-8 gap-1.5 rounded-lg text-xs font-medium shadow-sm" onClick={() => { setClickedDate(null); setIsCreateDialogOpen(true); }}>
                                <Plus className="h-3.5 w-3.5" />
                                New
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Appointments Tab (booking-page meetings) */}
            <TabsContent value="appointments" className="flex-1 overflow-y-auto m-0 p-4 sm:p-6 lg:p-8">
                <AppointmentsPanel />
            </TabsContent>

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
                                { id: "SYSTEM", label: "Opportunity dates", color: "#10B981" },
                                { id: "TASK", label: "CRM Tasks", color: "#F59E0B" },
                                { id: "EVENT", label: "CRM Events", color: "#6366F1" },
                                { id: "APPOINTMENT", label: "Booking appointments", color: "#06B6D4" }
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
                    <div className="px-4 sm:px-6 py-3 border-b bg-card/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        {/* Left: month label + Today + prev/next */}
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <h2 className="text-base sm:text-lg font-semibold tracking-tight capitalize truncate">
                                {format(currentDate, "MMMM yyyy")}
                            </h2>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs font-medium touch-manipulation" onClick={() => setCurrentDate(new Date())}>
                                Today
                            </Button>
                            {viewMode === "month" && (
                                <div className="flex items-center rounded-lg border border-border bg-muted/20">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-lg rounded-r-none touch-manipulation" onClick={prevTime}>
                                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                    <div className="h-4 w-px bg-border" />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-lg rounded-l-none touch-manipulation" onClick={nextTime}>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>
                            )}
                            {isLoading && (
                                <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                    Syncing
                                </span>
                            )}
                        </div>
                        {/* Right: view toggle + date-range pill */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex items-center rounded-lg bg-muted/40 p-0.5 border border-border">
                                {(["day", "week", "month"] as ViewMode[]).map(m => (
                                    <Button
                                        key={m}
                                        variant={viewMode === m ? "secondary" : "ghost"}
                                        size="sm"
                                        className={cn("h-7 rounded-md px-3 text-xs font-medium capitalize touch-manipulation", viewMode === m ? "shadow-sm" : "text-muted-foreground")}
                                        onClick={() => setViewMode(m)}
                                    >
                                        {m}
                                    </Button>
                                ))}
                            </div>
                            <div className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-muted/20 text-xs font-medium text-muted-foreground">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                <span>
                                    {viewMode === "week"
                                        ? `${format(startOfWeek(currentDate), "d MMM")} - ${format(endOfWeek(currentDate), "d MMM yyyy")}`
                                        : viewMode === "day"
                                        ? format(currentDate, "d MMM yyyy")
                                        : format(currentDate, "MMMM yyyy")}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-2 sm:p-4 md:p-6">
                        {viewMode === "month" && <MonthView date={currentDate} getEvents={getEventsForDay} onEventClick={setSelectedEvent} onCellClick={handleCellClick} onEventDrop={handleEventDrop} />}
                        {viewMode === "week" && <WeekView date={currentDate} getEvents={getEventsForDay} onEventClick={setSelectedEvent} onCellClick={handleCellClick} onEventDrop={handleEventDrop} onPrev={prevTime} onNext={nextTime} />}
                        {viewMode === "day" && <DayView date={currentDate} getEvents={getEventsForDay} onEventClick={setSelectedEvent} onCellClick={handleCellClick} onEventDrop={handleEventDrop} onPrev={prevTime} onNext={nextTime} />}
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
                            { id: "TASK", label: "CRM Tasks", color: "#F59E0B" },
                            { id: "EVENT", label: "CRM Events", color: "#6366F1" },
                            { id: "APPOINTMENT", label: "Booking appointments", color: "#06B6D4" }
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
                                    style={eventBlockStyle(event.color)}
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
                                    style={eventBlockStyle(event.color)}
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
        rows.push(<div className="grid grid-cols-7 flex-1 min-h-0" key={day.toString()}>{days}</div>)
        days = []
    }

    return (
        <div className="rounded-2xl border border-border overflow-hidden shadow-2xl h-full flex flex-col">
            <div className="grid grid-cols-7 bg-muted/20 border-b border-border shrink-0">
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

// ── Time grid (shared by Week & Day views) ──────────────────────────────────

const HOUR_HEIGHT = 64 // px per hour row in the week/day time grids

const isAllDayEvent = (e: CalendarEvent) => {
    const s = new Date(e.start)
    return s.getHours() === 0 && s.getMinutes() === 0
}

const formatHourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`

const formatTimeShort = (d: Date) => format(d, d.getMinutes() === 0 ? "h a" : "h:mm a")

/** Frosted pastel block style — theme-aware: a soft tint of the event's own
 *  color, readable foreground text, and a full-color left accent. Matches the
 *  "Apple-like" treatment we settled on for the system pills. */
const eventBlockStyle = (color?: string) => ({
    backgroundColor: `${color || "#6366f1"}24`,
    color: "var(--foreground)",
    borderLeft: `3px solid ${color || "#6366f1"}`,
})

/**
 * Lay out timed events into duration-sized, overlap-aware blocks. Returns
 * absolute top/height (px) plus left/width (%) so overlapping events split
 * the column into side-by-side lanes (Google-Calendar style).
 */
function layoutTimedEvents(events: CalendarEvent[]) {
    const items = events
        .map(event => {
            const s = new Date(event.start)
            const e = new Date(event.end)
            const startMin = s.getHours() * 60 + s.getMinutes()
            let endMin = e.getHours() * 60 + e.getMinutes()
            // Same-day clamp; default 30-min height for zero/negative/cross-day spans
            if (!(e > s) || endMin <= startMin) endMin = Math.min(startMin + 30, 24 * 60)
            return { event, startMin, endMin, lane: 0, cols: 1 }
        })
        .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

    const out: typeof items = []
    let cluster: typeof items = []
    let clusterEnd = -1
    const flush = () => {
        const laneEnds: number[] = []
        cluster.forEach(it => {
            let placed = false
            for (let i = 0; i < laneEnds.length; i++) {
                if (it.startMin >= laneEnds[i]) { it.lane = i; laneEnds[i] = it.endMin; placed = true; break }
            }
            if (!placed) { it.lane = laneEnds.length; laneEnds.push(it.endMin) }
        })
        cluster.forEach(it => { it.cols = laneEnds.length })
        out.push(...cluster)
        cluster = []
        clusterEnd = -1
    }
    items.forEach(it => {
        if (cluster.length && it.startMin >= clusterEnd) flush()
        cluster.push(it)
        clusterEnd = Math.max(clusterEnd, it.endMin)
    })
    flush()

    return out.map(it => ({
        event: it.event,
        top: (it.startMin / 60) * HOUR_HEIGHT,
        height: Math.max(((it.endMin - it.startMin) / 60) * HOUR_HEIGHT, 28),
        leftPct: (it.lane / it.cols) * 100,
        widthPct: 100 / it.cols,
    }))
}

/**
 * Shared time-grid renderer used by the Week (7 days) and Day (1 day) views.
 * Left time gutter + one column per day, with horizontal hour lines, an
 * all-day row, duration-sized event blocks, and a live current-time line.
 */
function TimeGridView({
    days, getEvents, onEventClick, onCellClick, onEventDrop, onPrev, onNext,
}: {
    days: Date[]
    getEvents: (d: Date) => CalendarEvent[]
    onEventClick: (e: CalendarEvent) => void
    onCellClick: (d: Date) => void
    onEventDrop: (eventId: string, newDate: Date) => void
    onPrev?: () => void
    onNext?: () => void
}) {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [dragOverKey, setDragOverKey] = useState<string | null>(null)
    const [now, setNow] = useState(() => new Date())

    // Tick the current-time line every minute
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60_000)
        return () => clearInterval(t)
    }, [])

    // Open scrolled to ~7am so the working day is in view
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 8
    }, [])

    const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT
    const hasToday = days.some(d => isToday(d))

    return (
        <div className="flex flex-col h-full min-h-[600px] rounded-2xl border border-border bg-card/40 overflow-hidden shadow-sm">
            {/* Day header row */}
            <div className="flex shrink-0 border-b border-border bg-card/60 backdrop-blur-sm">
                <div className="w-14 sm:w-16 shrink-0 border-r border-border flex items-center justify-center gap-0.5">
                    {onPrev && (
                        <button onClick={onPrev} aria-label="Previous" className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {onNext && (
                        <button onClick={onNext} aria-label="Next" className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                {days.map((day, i) => (
                    <div key={i} className={cn("flex-1 min-w-0 flex items-center justify-center gap-1.5 py-3 border-r border-border last:border-r-0", isToday(day) && "bg-primary/[0.05]")}>
                        <span className={cn("text-[10px] font-semibold uppercase tracking-wider", isToday(day) ? "text-foreground" : "text-muted-foreground")}>{format(day, "EEE")}</span>
                        <span className={cn("text-base font-bold leading-none", isToday(day) ? "text-foreground" : "text-foreground/80")}>{format(day, "d")}</span>
                    </div>
                ))}
            </div>

            {/* All-day row */}
            <div className="flex shrink-0 border-b border-border bg-card/20">
                <div className="w-14 sm:w-16 shrink-0 border-r border-border flex items-start justify-end pr-2 pt-1.5">
                    <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground/60">All day</span>
                </div>
                {days.map((day, i) => {
                    const allDay = getEvents(day).filter(isAllDayEvent)
                    return (
                        <div key={i} className="flex-1 min-w-0 border-r border-border last:border-r-0 p-1 space-y-0.5 min-h-[32px]">
                            {allDay.map(event => (
                                <button
                                    key={event.id}
                                    data-event
                                    onClick={() => onEventClick(event)}
                                    className="block w-full text-left text-[10px] font-medium px-1.5 py-1 rounded-md truncate hover:brightness-110 transition"
                                    style={eventBlockStyle(event.color)}
                                >
                                    {event.title}
                                </button>
                            ))}
                        </div>
                    )
                })}
            </div>

            {/* Scrollable time grid */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
                <div className="flex relative" style={{ height: 24 * HOUR_HEIGHT }}>
                    {/* Time gutter */}
                    <div className="w-14 sm:w-16 shrink-0 relative border-r border-border">
                        {hours.map(h => (
                            <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/70 tabular-nums" style={{ top: h * HOUR_HEIGHT }}>
                                {h === 0 ? "" : formatHourLabel(h)}
                            </div>
                        ))}
                        {hasToday && (
                            <div className="absolute right-1.5 -translate-y-1/2 z-10 rounded bg-blue-500 px-1 py-px text-[9px] font-semibold text-white tabular-nums whitespace-nowrap shadow-sm" style={{ top: nowTop }}>
                                {format(now, "h:mm a")}
                            </div>
                        )}
                    </div>

                    {/* Day columns */}
                    {days.map((day, di) => {
                        const blocks = layoutTimedEvents(getEvents(day).filter(e => !isAllDayEvent(e)))
                        return (
                            <div key={di} className={cn("flex-1 min-w-0 relative border-r border-border last:border-r-0", isToday(day) && "bg-primary/[0.03]")}>
                                {/* Hour cells: grid lines + click/drop targets */}
                                {hours.map(h => {
                                    const slotDate = new Date(day)
                                    slotDate.setHours(h, 0, 0, 0)
                                    const key = `${di}-${h}`
                                    return (
                                        <div
                                            key={h}
                                            className={cn(
                                                "absolute inset-x-0 border-t border-border/40 cursor-pointer transition-colors hover:bg-muted/10",
                                                dragOverKey === key && "bg-primary/10 ring-1 ring-inset ring-primary/30",
                                            )}
                                            style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                                            onClick={() => onCellClick(slotDate)}
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverKey(key) }}
                                            onDragLeave={() => setDragOverKey(null)}
                                            onDrop={(e) => {
                                                e.preventDefault()
                                                setDragOverKey(null)
                                                const id = e.dataTransfer.getData("text/plain")
                                                if (id) onEventDrop(id, slotDate)
                                            }}
                                        />
                                    )
                                })}

                                {/* Event blocks */}
                                {blocks.map(({ event, top, height, leftPct, widthPct }) => (
                                    <button
                                        key={event.id}
                                        data-event
                                        draggable={event.source === "TASK"}
                                        onDragStart={(e) => handleDragStart(e, event)}
                                        onDragEnd={handleDragEnd}
                                        onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
                                        className={cn(
                                            "absolute z-10 rounded-lg px-2 py-1 text-left overflow-hidden shadow-sm hover:shadow-md hover:brightness-[1.04] transition",
                                            event.source === "TASK" && "cursor-grab active:cursor-grabbing",
                                        )}
                                        style={{
                                            top,
                                            height,
                                            left: `calc(${leftPct}% + 2px)`,
                                            width: `calc(${widthPct}% - 4px)`,
                                            ...eventBlockStyle(event.color),
                                        }}
                                    >
                                        <span className="block text-[10px] leading-tight opacity-70 truncate">
                                            {new Date(event.end).getTime() > new Date(event.start).getTime()
                                                ? `${formatTimeShort(new Date(event.start))} - ${formatTimeShort(new Date(event.end))}`
                                                : formatTimeShort(new Date(event.start))}
                                        </span>
                                        <span className="block text-[11px] font-semibold leading-tight truncate">{event.title}</span>
                                    </button>
                                ))}

                                {/* Current-time line (today only) */}
                                {isToday(day) && (
                                    <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                                        <div className="relative border-t-2 border-blue-500">
                                            <div className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-blue-500 shadow-sm" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ── Week View ───────────────────────────────────────────────────────────────

function WeekView({
    date, getEvents, onEventClick, onCellClick, onEventDrop, onPrev, onNext,
}: {
    date: Date
    getEvents: (d: Date) => CalendarEvent[]
    onEventClick: (e: CalendarEvent) => void
    onCellClick: (d: Date) => void
    onEventDrop: (eventId: string, newDate: Date) => void
    onPrev?: () => void
    onNext?: () => void
}) {
    const startDate = startOfWeek(date)
    const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i))
    return <TimeGridView days={days} getEvents={getEvents} onEventClick={onEventClick} onCellClick={onCellClick} onEventDrop={onEventDrop} onPrev={onPrev} onNext={onNext} />
}

// ── Day View ────────────────────────────────────────────────────────────────

function DayView({
    date, getEvents, onEventClick, onCellClick, onEventDrop, onPrev, onNext,
}: {
    date: Date
    getEvents: (d: Date) => CalendarEvent[]
    onEventClick: (e: CalendarEvent) => void
    onCellClick: (d: Date) => void
    onEventDrop: (eventId: string, newDate: Date) => void
    onPrev?: () => void
    onNext?: () => void
}) {
    return <TimeGridView days={[date]} getEvents={getEvents} onEventClick={onEventClick} onCellClick={onCellClick} onEventDrop={onEventDrop} onPrev={onPrev} onNext={onNext} />
}

// ── Event Detail Modal ──────────────────────────────────────────────────────

function EventDetailModal({ event, onClose, onNavigate, onEditTask, onCancelAppointment }: { event: CalendarEvent, onClose: () => void, onNavigate: (url: string) => void, onEditTask?: (taskId: string) => void, onCancelAppointment?: (id: string) => void }) {
    const sourceLabels: Record<string, string> = { GOOGLE: "Google Calendar", APPLE: "Apple Calendar", SYSTEM: "CRM -- Stay Event", TASK: "CRM Task", EVENT: "Calendar Event", APPOINTMENT: "Booking Appointment" }
    const isAllDay = event.start instanceof Date && event.start.getHours() === 0 && event.start.getMinutes() === 0
    const navLabel = event.source === "APPOINTMENT" ? "View Contact" : event.source === "SYSTEM" ? "View Opportunity" : "Open"

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
                    {event.source === "APPOINTMENT" && onCancelAppointment && (
                        <Button
                            variant="outline"
                            className="w-full h-9 gap-2 text-sm font-semibold border-rose-500/30 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                            onClick={() => onCancelAppointment(event.id.replace(/^appointment-/, ""))}
                        >
                            <X className="h-3.5 w-3.5" />
                            Cancel appointment
                        </Button>
                    )}
                </div>
                {event.navigationUrl && (
                    <div className="p-4 sm:p-6 border-t border-border safe-bottom">
                        <Button className="w-full h-11 gap-3 font-black tracking-wide shadow-lg" style={{ backgroundColor: event.color, color: "white" }} onClick={() => onNavigate(event.navigationUrl!)}>
                            {navLabel}
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
