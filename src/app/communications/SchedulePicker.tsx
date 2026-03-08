"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clock, X, CalendarDays } from "lucide-react"

interface SchedulePickerProps {
    onSchedule: (dateTime: string) => void
    onClose: () => void
    isSending: boolean
}

export default function SchedulePicker({ onSchedule, onClose, isSending }: SchedulePickerProps) {
    const now = new Date()
    // Default to 1 hour from now, rounded to nearest 15 min
    const defaultDate = new Date(now.getTime() + 3600000)
    defaultDate.setMinutes(Math.ceil(defaultDate.getMinutes() / 15) * 15, 0, 0)

    const [date, setDate] = useState(defaultDate.toISOString().split("T")[0])
    const [time, setTime] = useState(
        `${String(defaultDate.getHours()).padStart(2, "0")}:${String(defaultDate.getMinutes()).padStart(2, "0")}`
    )

    const handleSchedule = () => {
        const scheduled = new Date(`${date}T${time}`)
        if (scheduled <= new Date()) {
            return
        }
        onSchedule(scheduled.toISOString())
    }

    const isValid = (() => {
        try {
            const scheduled = new Date(`${date}T${time}`)
            return scheduled > new Date()
        } catch {
            return false
        }
    })()

    // Quick options
    const quickOptions = [
        { label: "In 1 hour", getDate: () => { const d = new Date(Date.now() + 3600000); return d } },
        { label: "In 3 hours", getDate: () => { const d = new Date(Date.now() + 3 * 3600000); return d } },
        { label: "Tomorrow 9 AM", getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d } },
        { label: "Tomorrow 2 PM", getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(14, 0, 0, 0); return d } },
        { label: "Monday 9 AM", getDate: () => { const d = new Date(); const daysUntilMon = ((1 - d.getDay()) + 7) % 7 || 7; d.setDate(d.getDate() + daysUntilMon); d.setHours(9, 0, 0, 0); return d } },
    ]

    const setQuickOption = (getDate: () => Date) => {
        const d = getDate()
        setDate(d.toISOString().split("T")[0])
        setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`)
    }

    return (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border rounded-xl shadow-lg p-4 z-50">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Schedule Send
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Quick options */}
            <div className="flex flex-wrap gap-1.5 mb-3">
                {quickOptions.map(opt => (
                    <button
                        key={opt.label}
                        onClick={() => setQuickOption(opt.getDate)}
                        className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors border bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Custom date/time */}
            <div className="flex items-center gap-2 mb-3">
                <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={now.toISOString().split("T")[0]}
                    className="h-8 text-xs flex-1"
                />
                <Input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-8 text-xs w-28"
                />
            </div>

            {!isValid && (
                <p className="text-[10px] text-destructive mb-2">Please select a time in the future.</p>
            )}

            <Button
                onClick={handleSchedule}
                disabled={!isValid || isSending}
                size="sm"
                className="w-full h-8 text-xs"
            >
                <Clock className="h-3 w-3 mr-1" />
                {isSending ? "Scheduling..." : "Schedule"}
            </Button>
        </div>
    )
}
