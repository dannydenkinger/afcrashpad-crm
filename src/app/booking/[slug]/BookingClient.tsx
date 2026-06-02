"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Calendar, CheckCircle2, Clock, Loader2, ArrowRight } from "lucide-react"
import { submitBookingAction } from "./actions"

interface DayBlock {
    date: string
    dow: number
    slots: Array<{ start: string; end: string }>
}

interface AppointmentTypeOpt {
    id: string
    name: string
    durationMinutes: number
    description?: string
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function BookingClient({
    slug,
    pageName,
    workspaceName,
    timezone,
    slotMinutes,
    intro,
    appointmentTypes,
    slotsByType,
}: {
    slug: string
    pageName: string
    workspaceName: string
    timezone: string
    slotMinutes: number
    intro?: string
    appointmentTypes: AppointmentTypeOpt[]
    slotsByType: Record<string, DayBlock[]>
}) {
    const hasMultipleTypes = appointmentTypes.length > 0
    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(
        // Auto-select if there's only one type, otherwise wait for user
        hasMultipleTypes && appointmentTypes.length === 1 ? appointmentTypes[0].id : null,
    )

    const days: DayBlock[] = useMemo(() => {
        if (!hasMultipleTypes) return slotsByType.__default ?? []
        if (!selectedTypeId) return []
        return slotsByType[selectedTypeId] ?? []
    }, [hasMultipleTypes, selectedTypeId, slotsByType])

    const selectedType = useMemo(
        () => appointmentTypes.find((t) => t.id === selectedTypeId) ?? null,
        [appointmentTypes, selectedTypeId],
    )

    const effectiveDuration = selectedType?.durationMinutes ?? slotMinutes

    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [notes, setNotes] = useState("")
    const [submitted, setSubmitted] = useState<{ when: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    // Reset date/slot when the type changes
    const handleTypeChange = (typeId: string) => {
        setSelectedTypeId(typeId)
        setSelectedDate(null)
        setSelectedSlot(null)
    }

    // Default-select the first day whenever the days list changes
    const firstDate = days[0]?.date ?? null
    useEffect(() => {
        if (selectedDate === null && firstDate) setSelectedDate(firstDate)
    }, [firstDate, selectedDate])

    const day = useMemo(
        () => days.find((d) => d.date === selectedDate),
        [days, selectedDate],
    )

    const handleSubmit = () => {
        setError(null)
        if (!selectedSlot || !name.trim() || !email.includes("@")) {
            setError("Pick a time and fill in name + email")
            return
        }
        if (hasMultipleTypes && !selectedTypeId) {
            setError("Pick a meeting type")
            return
        }
        startTransition(async () => {
            const res = await submitBookingAction({
                slug,
                startsAt: selectedSlot,
                name: name.trim(),
                email: email.trim(),
                notes: notes.trim() || undefined,
                appointmentTypeId: selectedTypeId || undefined,
            })
            if (!res.success) {
                setError(res.error || "Failed to book")
                return
            }
            setSubmitted({ when: res.startsAt ?? selectedSlot })
        })
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl font-semibold text-slate-900">
                        You&apos;re booked
                    </h1>
                    <div className="text-sm text-slate-600 space-y-1.5">
                        {selectedType && (
                            <p className="font-medium text-slate-900">
                                {selectedType.name}{" "}
                                <span className="text-slate-500 font-normal">· {selectedType.durationMinutes} min</span>
                            </p>
                        )}
                        <p>
                            <span className="font-semibold text-slate-900">
                                {formatLocal(submitted.when, timezone)}
                            </span>
                        </p>
                    </div>
                    <p className="text-xs text-slate-400">
                        A confirmation email is on its way with a link to cancel if you need to.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-6 border-b">
                    <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
                        {workspaceName}
                    </div>
                    <h1 className="text-2xl font-semibold text-slate-900">{pageName}</h1>
                    {intro && (
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                            {intro}
                        </p>
                    )}
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {effectiveDuration}-minute meeting · times shown in {timezone}
                    </p>
                </div>

                {/* Appointment type picker — only when multiple types are configured */}
                {hasMultipleTypes && (
                    <div className="p-6 border-b bg-slate-50/40">
                        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
                            What kind of meeting?
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {appointmentTypes.map((t) => {
                                const isSelected = selectedTypeId === t.id
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => handleTypeChange(t.id)}
                                        className={`text-left p-3 rounded-lg border transition-colors ${
                                            isSelected
                                                ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200"
                                                : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-sm text-slate-900">{t.name}</span>
                                            <span className="text-[11px] text-slate-500 font-mono shrink-0">
                                                {t.durationMinutes}m
                                            </span>
                                        </div>
                                        {t.description && (
                                            <p className="text-xs text-slate-500 mt-1 leading-snug">{t.description}</p>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {hasMultipleTypes && !selectedTypeId ? (
                    <div className="p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        Pick a meeting type to see available times
                    </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] divide-y md:divide-y-0 md:divide-x">
                    {/* Day picker */}
                    <div className="p-4 max-h-[480px] overflow-y-auto">
                        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
                            <Calendar className="w-3 h-3 inline mr-1.5" />
                            Pick a day
                        </div>
                        {days.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                No availability in the next few weeks. Try again later.
                            </p>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {days.map((d) => (
                                    <button
                                        key={d.date}
                                        type="button"
                                        onClick={() => {
                                            setSelectedDate(d.date)
                                            setSelectedSlot(null)
                                        }}
                                        className={`text-left p-2 rounded-md border transition-colors ${
                                            selectedDate === d.date
                                                ? "border-indigo-500 bg-indigo-50"
                                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                        }`}
                                    >
                                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                                            {DAY_NAMES[d.dow]}
                                        </div>
                                        <div className="text-sm font-semibold text-slate-900 tabular-nums">
                                            {d.date.slice(5)}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            {d.slots.length} slot{d.slots.length === 1 ? "" : "s"}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Slot picker */}
                    <div className="p-4 max-h-[480px] overflow-y-auto">
                        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
                            <Clock className="w-3 h-3 inline mr-1.5" />
                            Pick a time
                        </div>
                        {!day ? (
                            <p className="text-sm text-slate-500">Pick a day first.</p>
                        ) : day.slots.length === 0 ? (
                            <p className="text-sm text-slate-500">No slots available on this day. Try another date.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {day.slots.map((s) => (
                                    <button
                                        key={s.start}
                                        type="button"
                                        onClick={() => setSelectedSlot(s.start)}
                                        className={`w-full text-left text-sm py-2 px-3 rounded-md border transition-colors tabular-nums ${
                                            selectedSlot === s.start
                                                ? "border-indigo-500 bg-indigo-500 text-white"
                                                : "border-slate-200 hover:border-slate-300 text-slate-700"
                                        }`}
                                    >
                                        {formatTimeOnly(s.start, timezone)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                )}

                {/* Form */}
                {selectedSlot && (
                    <div className="p-6 border-t bg-slate-50/40 space-y-3">
                        <div className="text-xs text-slate-500">
                            Booking for{" "}
                            <strong className="text-slate-900">
                                {formatLocal(selectedSlot, timezone)}
                            </strong>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                className="px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                disabled={isPending}
                            />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Your email"
                                className="px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                disabled={isPending}
                            />
                        </div>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Anything else (optional)"
                            rows={3}
                            className="w-full px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            disabled={isPending}
                        />
                        {error && (
                            <p className="text-xs text-red-600">{error}</p>
                        )}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isPending || !selectedSlot || !name.trim() || !email.trim()}
                            className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Book the meeting
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function formatLocal(iso: string, tz: string): string {
    try {
        return new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(new Date(iso))
    } catch {
        return iso
    }
}

function formatTimeOnly(iso: string, tz: string): string {
    try {
        return new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            hour: "numeric",
            minute: "2-digit",
        }).format(new Date(iso))
    } catch {
        return iso
    }
}
