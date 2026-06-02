"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { CheckCircle2, ClipboardCopy, ExternalLink, Loader2, Save, Plus, Trash2 } from "lucide-react"
import { saveBookingPageAction } from "./actions"
import type { AppointmentType, BookingPage, DayHours } from "@/lib/booking/store"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function BookingConfigForm({
    initial,
    appUrl,
    workspaceFallbackName,
}: {
    initial: BookingPage | null
    appUrl: string
    workspaceFallbackName: string
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [copied, setCopied] = useState(false)

    const [name, setName] = useState(initial?.name ?? `Book a meeting with ${workspaceFallbackName}`)
    const [slug, setSlug] = useState(initial?.slug ?? "")
    const [timezone, setTimezone] = useState(initial?.timezone ?? defaultTz())
    const [slotDuration, setSlotDuration] = useState(initial?.slotDurationMinutes ?? 30)
    const [buffer, setBuffer] = useState(initial?.bufferMinutes ?? 0)
    const [advanceNotice, setAdvanceNotice] = useState(initial?.advanceNoticeHours ?? 4)
    const [maxPerDay, setMaxPerDay] = useState(initial?.maxPerDay ?? 0)
    const [futureWindow, setFutureWindow] = useState(initial?.futureWindowDays ?? 30)
    const [intro, setIntro] = useState(initial?.intro ?? "")

    const [hours, setHours] = useState<Partial<Record<number, DayHours>>>(
        initial?.hoursByDay ?? {
            1: { start: 9, end: 17 },
            2: { start: 9, end: 17 },
            3: { start: 9, end: 17 },
            4: { start: 9, end: 17 },
            5: { start: 9, end: 17 },
        },
    )
    const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
        initial?.appointmentTypes ?? [],
    )

    const slugify = (s: string) =>
        s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

    const addAppointmentType = () => {
        let baseId = "meeting"
        let suffix = 1
        while (appointmentTypes.some((t) => t.id === baseId)) {
            suffix++
            baseId = `meeting-${suffix}`
        }
        setAppointmentTypes((prev) => [
            ...prev,
            { id: baseId, name: "New meeting type", durationMinutes: 30, description: "" },
        ])
    }

    const updateAppointmentType = (idx: number, patch: Partial<AppointmentType>) => {
        setAppointmentTypes((prev) => {
            const next = [...prev]
            const merged = { ...next[idx], ...patch }
            // If the user edited the name and the id was auto-derived from the previous name,
            // re-derive a slug. We treat the id as auto-derived if it matches slugify(prevName).
            if (patch.name !== undefined && next[idx].id === slugify(next[idx].name)) {
                let nextId = slugify(patch.name) || `meeting-${idx + 1}`
                if (next.some((t, i) => i !== idx && t.id === nextId)) {
                    nextId = `${nextId}-${idx + 1}`
                }
                merged.id = nextId
            }
            next[idx] = merged
            return next
        })
    }

    const removeAppointmentType = (idx: number) => {
        setAppointmentTypes((prev) => prev.filter((_, i) => i !== idx))
    }

    const publicUrl = slug ? `${appUrl}/booking/${slug}` : ""

    const toggleDay = (dow: number, open: boolean) => {
        setHours((prev) => {
            const next = { ...prev }
            if (open) next[dow] = next[dow] ?? { start: 9, end: 17 }
            else delete next[dow]
            return next
        })
    }

    const setDayHours = (dow: number, patch: Partial<DayHours>) => {
        setHours((prev) => {
            const next = { ...prev }
            const existing = next[dow] ?? { start: 9, end: 17 }
            next[dow] = { ...existing, ...patch }
            return next
        })
    }

    const handleSave = () => {
        if (!slug.trim()) {
            toast.error("URL slug is required")
            return
        }
        startTransition(async () => {
            // Convert to string-keyed for action schema
            const hoursPayload: Record<string, DayHours> = {}
            for (const [k, v] of Object.entries(hours)) {
                if (v) hoursPayload[k] = v
            }
            // Validate appointment types client-side for nicer errors
            const cleanTypes = appointmentTypes.map((t) => ({
                ...t,
                description: t.description?.trim() || undefined,
            }))
            for (const t of cleanTypes) {
                if (!t.id.trim() || !/^[a-z0-9-]+$/.test(t.id)) {
                    toast.error(`Appointment type ID "${t.id}" must be lowercase letters, numbers, and hyphens.`)
                    return
                }
                if (!t.name.trim()) {
                    toast.error("Each appointment type needs a name.")
                    return
                }
                if (!Number.isInteger(t.durationMinutes) || t.durationMinutes < 5) {
                    toast.error(`"${t.name}" duration must be at least 5 minutes.`)
                    return
                }
            }
            if (new Set(cleanTypes.map((t) => t.id)).size !== cleanTypes.length) {
                toast.error("Each appointment type needs a unique ID.")
                return
            }

            const res = await saveBookingPageAction({
                name,
                slug,
                timezone,
                slotDurationMinutes: slotDuration,
                bufferMinutes: buffer,
                advanceNoticeHours: advanceNotice,
                maxPerDay,
                futureWindowDays: futureWindow,
                intro: intro.trim() || undefined,
                hoursByDay: hoursPayload,
                appointmentTypes: cleanTypes,
            })
            if (!res.success) {
                toast.error(res.error || "Failed to save")
                return
            }
            toast.success("Booking page saved")
            router.refresh()
        })
    }

    const copyUrl = () => {
        if (!publicUrl) return
        navigator.clipboard?.writeText(publicUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className="space-y-5">
            {publicUrl && (
                <div className="space-y-1.5 pb-4 border-b">
                    <Label className="text-xs">Public booking URL</Label>
                    <div className="flex items-center gap-1.5">
                        <Input
                            value={publicUrl}
                            readOnly
                            className="font-mono text-[12px] bg-muted/40"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={copyUrl}
                            className="shrink-0"
                        >
                            {copied ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                                <ClipboardCopy className="w-3.5 h-3.5" />
                            )}
                        </Button>
                        <a href={publicUrl} target="_blank" rel="noreferrer">
                            <Button type="button" variant="outline" size="sm">
                                <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                        </a>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs">Page heading</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">URL slug</Label>
                    <Input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="acme-team"
                        className="font-mono"
                        disabled={isPending}
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs">Intro (optional, shown above the calendar)</Label>
                <textarea
                    value={intro}
                    onChange={(e) => setIntro(e.target.value)}
                    rows={2}
                    placeholder="A short note to set expectations"
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/20"
                    disabled={isPending}
                />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">Slot duration (min)</Label>
                    <Input
                        type="number"
                        min={5}
                        max={480}
                        value={slotDuration}
                        onChange={(e) => setSlotDuration(parseInt(e.target.value) || 30)}
                        disabled={isPending}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Buffer between (min)</Label>
                    <Input
                        type="number"
                        min={0}
                        max={120}
                        value={buffer}
                        onChange={(e) => setBuffer(parseInt(e.target.value) || 0)}
                        disabled={isPending}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Min notice (hours)</Label>
                    <Input
                        type="number"
                        min={0}
                        max={168}
                        value={advanceNotice}
                        onChange={(e) => setAdvanceNotice(parseInt(e.target.value) || 0)}
                        disabled={isPending}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Max per day (0 = unlimited)</Label>
                    <Input
                        type="number"
                        min={0}
                        max={50}
                        value={maxPerDay}
                        onChange={(e) => setMaxPerDay(parseInt(e.target.value) || 0)}
                        disabled={isPending}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs">Timezone (IANA)</Label>
                    <Input
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        placeholder="America/New_York"
                        className="font-mono"
                        disabled={isPending}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">Future window (days)</Label>
                    <Input
                        type="number"
                        min={1}
                        max={180}
                        value={futureWindow}
                        onChange={(e) => setFutureWindow(parseInt(e.target.value) || 30)}
                        disabled={isPending}
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs">Business hours</Label>
                <div className="space-y-1.5">
                    {DAY_NAMES.map((dayName, dow) => {
                        const day = hours[dow]
                        const open = !!day
                        return (
                            <div key={dow} className="flex items-center gap-2">
                                <label className="flex items-center gap-2 w-20 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={open}
                                        onChange={(e) => toggleDay(dow, e.target.checked)}
                                        disabled={isPending}
                                    />
                                    {dayName}
                                </label>
                                {open && day ? (
                                    <>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={23}
                                            value={day.start}
                                            onChange={(e) =>
                                                setDayHours(dow, { start: parseInt(e.target.value) || 0 })
                                            }
                                            className="w-20 h-8 text-xs tabular-nums"
                                            disabled={isPending}
                                        />
                                        <span className="text-xs text-muted-foreground">to</span>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={24}
                                            value={day.end}
                                            onChange={(e) =>
                                                setDayHours(dow, { end: parseInt(e.target.value) || 0 })
                                            }
                                            className="w-20 h-8 text-xs tabular-nums"
                                            disabled={isPending}
                                        />
                                        <span className="text-[10px] text-muted-foreground/70">
                                            (24-hour)
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-xs text-muted-foreground/70">Closed</span>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Appointment types — optional. When empty the page acts as a single-type page using the slot duration above. */}
            <div className="space-y-2 pt-3 border-t">
                <div className="flex items-center justify-between">
                    <div>
                        <Label className="text-xs">Appointment types</Label>
                        <p className="text-[11px] text-muted-foreground">
                            Optional. Add multiple meeting types (e.g. Discovery 30m, Demo 60m) and visitors pick one before seeing slots.
                            Leave empty for a single-type booking page.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addAppointmentType}
                        disabled={isPending || appointmentTypes.length >= 20}
                        className="h-8 text-xs gap-1.5 shrink-0"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add type
                    </Button>
                </div>
                {appointmentTypes.length > 0 && (
                    <div className="space-y-2">
                        {appointmentTypes.map((t, i) => (
                            <div key={i} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_36px] gap-2 items-end">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-muted-foreground">Name</Label>
                                        <Input
                                            value={t.name}
                                            onChange={(e) => updateAppointmentType(i, { name: e.target.value })}
                                            placeholder="Discovery call"
                                            disabled={isPending}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-muted-foreground">Duration (min)</Label>
                                        <Input
                                            type="number"
                                            min={5}
                                            max={480}
                                            value={t.durationMinutes}
                                            onChange={(e) => updateAppointmentType(i, { durationMinutes: parseInt(e.target.value) || 30 })}
                                            disabled={isPending}
                                            className="h-9 text-sm tabular-nums"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-muted-foreground">URL ID</Label>
                                        <Input
                                            value={t.id}
                                            onChange={(e) => updateAppointmentType(i, { id: e.target.value })}
                                            placeholder="discovery"
                                            disabled={isPending}
                                            className="h-9 text-sm font-mono"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeAppointmentType(i)}
                                        disabled={isPending}
                                        className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                                        aria-label="Remove appointment type"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">Description (optional)</Label>
                                    <Input
                                        value={t.description ?? ""}
                                        onChange={(e) => updateAppointmentType(i, { description: e.target.value })}
                                        placeholder="A brief note shown under the type name on the public page"
                                        disabled={isPending}
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-3 border-t">
                <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    Save
                </Button>
            </div>
        </div>
    )
}

function defaultTz(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
        return "America/New_York"
    }
}
