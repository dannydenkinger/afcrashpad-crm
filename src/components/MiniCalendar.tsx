"use client"

import { useState } from "react"
import {
    startOfWeek,
    startOfMonth,
    endOfWeek,
    endOfMonth,
    addDays,
    addMonths,
    subMonths,
    isSameDay,
    isSameMonth,
    isToday,
    format,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface MiniCalendarProps {
    /** Currently selected/focused date */
    selectedDate?: Date
    /** Dates that have events (shown with a dot) */
    eventDates?: Date[]
    /** Called when a day is clicked */
    onDayClick?: (date: Date) => void
    /** External control for the displayed month */
    month?: Date
    onMonthChange?: (date: Date) => void
    /**
     * When true, the day cells flex to fill the available container height
     * (instead of the default fixed h-7). Used when the calendar lives in
     * a resizable container — e.g. the dashboard widget grid.
     */
    fillHeight?: boolean
}

export function MiniCalendar({
    selectedDate,
    eventDates = [],
    onDayClick,
    month: controlledMonth,
    onMonthChange,
    fillHeight = false,
}: MiniCalendarProps) {
    const [internalMonth, setInternalMonth] = useState(selectedDate || new Date())
    const currentMonth = controlledMonth || internalMonth

    const setMonth = (d: Date) => {
        if (onMonthChange) onMonthChange(d)
        else setInternalMonth(d)
    }

    const miniStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const miniEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 })
    const miniDays: Date[] = []
    let d = miniStart
    while (d <= miniEnd) {
        miniDays.push(d)
        d = addDays(d, 1)
    }

    const hasEvent = (day: Date) => eventDates.some(ed => isSameDay(ed, day))

    // Number of week rows in this month — 5 or 6 — used to make day cells
    // grow proportionally when fillHeight is on.
    const weekRows = Math.ceil(miniDays.length / 7)

    return (
        <div className={cn(fillHeight && "flex flex-col h-full min-h-0")}>
            <div className="flex items-center justify-between mb-2 shrink-0">
                <button
                    onClick={() => setMonth(subMonths(currentMonth, 1))}
                    className="p-1 rounded hover:bg-muted/30"
                >
                    <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-[11px] font-bold">
                    {format(currentMonth, "MMMM yyyy")}
                </span>
                <button
                    onClick={() => setMonth(addMonths(currentMonth, 1))}
                    className="p-1 rounded hover:bg-muted/30"
                >
                    <ChevronRight className="h-3 w-3" />
                </button>
            </div>
            <div
                className={cn(
                    "grid grid-cols-7 gap-0",
                    fillHeight && "flex-1 min-h-0",
                )}
                style={
                    fillHeight
                        ? {
                              gridTemplateRows: `auto repeat(${weekRows}, minmax(0, 1fr))`,
                          }
                        : undefined
                }
            >
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
                    <div
                        key={day}
                        className="text-[9px] font-bold text-muted-foreground/50 text-center py-1"
                    >
                        {day}
                    </div>
                ))}
                {miniDays.map((day, i) => {
                    const dayHasEvent = hasEvent(day)
                    return (
                        <button
                            key={i}
                            onClick={() => onDayClick?.(day)}
                            className={cn(
                                "relative w-full text-[10px] rounded-md transition-colors",
                                fillHeight ? "h-full min-h-[28px]" : "h-7",
                                !isSameMonth(day, currentMonth) && "text-muted-foreground/30",
                                isToday(day) && "bg-primary text-primary-foreground font-bold",
                                selectedDate &&
                                    isSameDay(day, selectedDate) &&
                                    !isToday(day) &&
                                    "bg-muted font-bold",
                                !isToday(day) &&
                                    !(selectedDate && isSameDay(day, selectedDate)) &&
                                    "hover:bg-muted/30"
                            )}
                        >
                            {day.getDate()}
                            {dayHasEvent && !isToday(day) && (
                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
