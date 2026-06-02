"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarClock, Mail, ExternalLink, Search, Clock, User, Loader2, Settings, Plus, X } from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"
import { format, isBefore } from "date-fns"
import { toast } from "sonner"
import { listMyAppointments, createManualAppointment, cancelManualAppointment } from "./actions"
import type { AppointmentRow } from "./actions"

const STATUS_COLOR: Record<string, string> = {
    confirmed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    cancelled: "bg-muted text-muted-foreground border-border",
}

function defaultStart(): string {
    const d = new Date()
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() + 1)
    return toLocalInputValue(d)
}

function toLocalInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AppointmentsPanel() {
    const [items, setItems] = useState<AppointmentRow[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming")
    const [search, setSearch] = useState("")
    const [createOpen, setCreateOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [cancelingId, setCancelingId] = useState<string | null>(null)

    // Create-form state
    const [fName, setFName] = useState("")
    const [fEmail, setFEmail] = useState("")
    const [fNotes, setFNotes] = useState("")
    const [fStart, setFStart] = useState(defaultStart())
    const [fDuration, setFDuration] = useState("30")

    function resetForm() {
        setFName("")
        setFEmail("")
        setFNotes("")
        setFStart(defaultStart())
        setFDuration("30")
    }

    async function load() {
        setLoading(true)
        try {
            const rows = await listMyAppointments()
            setItems(rows)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let cancelled = false
        async function init() {
            setLoading(true)
            try {
                const rows = await listMyAppointments()
                if (!cancelled) setItems(rows)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        init()
        return () => {
            cancelled = true
        }
    }, [])

    async function handleCreate() {
        if (!fName.trim() || !fEmail.trim()) {
            toast.error("Name and email are required")
            return
        }
        setCreating(true)
        const startsAt = new Date(fStart)
        const res = await createManualAppointment({
            contactName: fName.trim(),
            contactEmail: fEmail.trim(),
            notes: fNotes.trim() || undefined,
            startsAt,
            durationMinutes: parseInt(fDuration, 10),
        })
        setCreating(false)
        if (res.success) {
            toast.success("Appointment created")
            setCreateOpen(false)
            resetForm()
            await load()
        } else {
            toast.error(res.error || "Failed to create appointment")
        }
    }

    async function handleCancel(id: string) {
        if (!confirm("Cancel this appointment? The contact will not be notified automatically.")) return
        setCancelingId(id)
        const res = await cancelManualAppointment(id)
        setCancelingId(null)
        if (res.success) {
            toast.success("Appointment cancelled")
            await load()
        } else {
            toast.error(res.error || "Failed to cancel")
        }
    }

    const filtered = useMemo(() => {
        if (!items) return []
        const now = new Date()
        const q = search.trim().toLowerCase()
        return items.filter((a) => {
            if (filter === "upcoming") {
                if (a.status === "cancelled") return false
                if (isBefore(new Date(a.startsAt), now)) return false
            } else if (filter === "past") {
                if (a.status !== "cancelled" && !isBefore(new Date(a.startsAt), now)) return false
            }
            if (q) {
                const hay =
                    `${a.contactName ?? ""} ${a.contactEmail ?? ""} ${a.notes ?? ""}`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            return true
        })
    }, [items, filter, search])

    const counts = useMemo(() => {
        if (!items) return { upcoming: 0, past: 0, all: 0 }
        const now = new Date()
        let upcoming = 0
        let past = 0
        for (const a of items) {
            if (a.status === "cancelled") {
                past++
                continue
            }
            if (isBefore(new Date(a.startsAt), now)) past++
            else upcoming++
        }
        return { upcoming, past, all: items.length }
    }, [items])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!items || items.length === 0) {
        return (
            <>
                <Card className="border-dashed">
                    <CardContent className="py-2">
                        <EmptyState
                            Icon={CalendarClock}
                            accent="blue"
                            title="No appointments yet"
                            description="Either share your public booking page so people can book themselves in, or add one manually below."
                            action={{ label: "New appointment", onClick: () => setCreateOpen(true) }}
                            secondaryAction={{ label: "Configure booking page", href: "/settings/booking" }}
                        />
                    </CardContent>
                </Card>
                <CreateAppointmentDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    creating={creating}
                    fName={fName} setFName={setFName}
                    fEmail={fEmail} setFEmail={setFEmail}
                    fNotes={fNotes} setFNotes={setFNotes}
                    fStart={fStart} setFStart={setFStart}
                    fDuration={fDuration} setFDuration={setFDuration}
                    onSubmit={handleCreate}
                />
            </>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/40 border w-fit">
                    {(["upcoming", "past", "all"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                                filter === f
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {f}
                            <span className="ml-1.5 text-[10px] opacity-60">({counts[f]})</span>
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 min-w-0 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, email, or notes"
                        className="pl-8 h-9 text-sm"
                    />
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Link href="/settings/booking">
                        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs">
                            <Settings className="h-3.5 w-3.5" />
                            Booking settings
                        </Button>
                    </Link>
                    <Button size="sm" className="h-9 gap-2 text-xs" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-3.5 w-3.5" />
                        New appointment
                    </Button>
                </div>
            </div>

            {filtered.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        No {filter === "all" ? "" : filter} appointments match your search.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {filtered.map((a) => {
                        const start = new Date(a.startsAt)
                        const end = new Date(a.endsAt)
                        const isPast = isBefore(start, new Date())
                        return (
                            <div
                                key={a.id}
                                className={`group rounded-xl border bg-card p-3 sm:p-4 transition-all hover:shadow-sm ${
                                    a.status === "cancelled" ? "opacity-60" : ""
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                                        <CalendarClock className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-sm flex items-center gap-1.5">
                                                <User className="h-3 w-3 text-muted-foreground/60" />
                                                {a.contactName || "Unknown"}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] px-1.5 py-0 capitalize ${
                                                    STATUS_COLOR[a.status] ||
                                                    "bg-muted text-muted-foreground border-border"
                                                }`}
                                            >
                                                {a.status}
                                            </Badge>
                                            {isPast && a.status !== "cancelled" && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border"
                                                >
                                                    Past
                                                </Badge>
                                            )}
                                            {a.appointmentTypeName && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] px-1.5 py-0 bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400"
                                                >
                                                    {a.appointmentTypeName}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                            {a.contactEmail && (
                                                <span className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3" />
                                                    {a.contactEmail}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {format(start, "EEE MMM d, h:mm a")} – {format(end, "h:mm a")}
                                            </span>
                                        </div>
                                        {a.notes && (
                                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                                                {a.notes}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {a.contactId && (
                                            <Link href={`/contacts/${a.contactId}`}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-xs gap-1.5"
                                                >
                                                    Open contact
                                                    <ExternalLink className="h-3 w-3" />
                                                </Button>
                                            </Link>
                                        )}
                                        {a.status !== "cancelled" && !isPast && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-xs gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                                onClick={() => handleCancel(a.id)}
                                                disabled={cancelingId === a.id}
                                            >
                                                {cancelingId === a.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <X className="h-3 w-3" />
                                                )}
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <CreateAppointmentDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                creating={creating}
                fName={fName} setFName={setFName}
                fEmail={fEmail} setFEmail={setFEmail}
                fNotes={fNotes} setFNotes={setFNotes}
                fStart={fStart} setFStart={setFStart}
                fDuration={fDuration} setFDuration={setFDuration}
                onSubmit={handleCreate}
            />
        </div>
    )
}

function CreateAppointmentDialog({
    open, onOpenChange, creating,
    fName, setFName,
    fEmail, setFEmail,
    fNotes, setFNotes,
    fStart, setFStart,
    fDuration, setFDuration,
    onSubmit,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    creating: boolean
    fName: string
    setFName: (v: string) => void
    fEmail: string
    setFEmail: (v: string) => void
    fNotes: string
    setFNotes: (v: string) => void
    fStart: string
    setFStart: (v: string) => void
    fDuration: string
    setFDuration: (v: string) => void
    onSubmit: () => void
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>New appointment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Contact name *</Label>
                            <Input
                                value={fName}
                                onChange={(e) => setFName(e.target.value)}
                                placeholder="Jane Doe"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Email *</Label>
                            <Input
                                type="email"
                                value={fEmail}
                                onChange={(e) => setFEmail(e.target.value)}
                                placeholder="jane@example.com"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Start time *</Label>
                            <Input
                                type="datetime-local"
                                value={fStart}
                                onChange={(e) => setFStart(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Duration</Label>
                            <Select value={fDuration} onValueChange={setFDuration}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="15">15 minutes</SelectItem>
                                    <SelectItem value="30">30 minutes</SelectItem>
                                    <SelectItem value="45">45 minutes</SelectItem>
                                    <SelectItem value="60">1 hour</SelectItem>
                                    <SelectItem value="90">1.5 hours</SelectItem>
                                    <SelectItem value="120">2 hours</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label className="text-xs">Notes</Label>
                        <Textarea
                            value={fNotes}
                            onChange={(e) => setFNotes(e.target.value)}
                            placeholder="Optional context or agenda"
                            className="mt-1 min-h-[60px]"
                        />
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                        We&apos;ll link to the contact if their email matches an existing one. No email is sent.
                    </p>

                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={creating}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={onSubmit} disabled={creating}>
                            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create appointment
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
