"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Phone, PhoneCall, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { logCall } from "./actions"

type Direction = "inbound" | "outbound"
type Outcome = "connected" | "voicemail" | "no_answer" | "wrong_number"

const OUTCOME_OPTIONS: { value: Outcome; label: string }[] = [
    { value: "connected", label: "Connected" },
    { value: "voicemail", label: "Left voicemail" },
    { value: "no_answer", label: "No answer" },
    { value: "wrong_number", label: "Wrong number" },
]

/**
 * Click-to-dial + manual call logging. Sits below the phone input on contact
 * and deal detail sheets. "Call" opens a tel: link in the native dialer AND
 * opens the log dialog so the user can record the outcome when the call ends.
 * "Log call" opens the dialog directly — useful for inbound or after-the-fact.
 */
export function PhoneActions({
    contactId,
    phone,
    onLogged,
}: {
    contactId: string
    phone: string | undefined | null
    onLogged?: () => void
}) {
    const [open, setOpen] = useState(false)
    const [direction, setDirection] = useState<Direction>("outbound")
    const [outcome, setOutcome] = useState<Outcome>("connected")
    const [duration, setDuration] = useState("")
    const [notes, setNotes] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const phoneClean = (phone || "").trim()
    const telHref = phoneClean ? `tel:${phoneClean.replace(/[^0-9+]/g, "")}` : ""

    const reset = () => {
        setDirection("outbound")
        setOutcome("connected")
        setDuration("")
        setNotes("")
    }

    const open_log = (preset: Direction) => {
        setDirection(preset)
        setOpen(true)
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        const res = await logCall({
            contactId,
            direction,
            outcome,
            durationMinutes: duration ? Math.max(0, parseInt(duration, 10) || 0) : null,
            notes: notes.trim() || undefined,
        })
        setSubmitting(false)
        if (res.success) {
            toast.success("Call logged")
            setOpen(false)
            reset()
            onLogged?.()
        } else {
            toast.error(res.error || "Failed to log call")
        }
    }

    return (
        <>
            <div className="flex items-center gap-2 mt-1">
                {telHref && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => {
                            window.location.href = telHref
                            // Open the log dialog right away so the user can fill it in when the call ends
                            setTimeout(() => open_log("outbound"), 100)
                        }}
                    >
                        <PhoneCall className="h-3 w-3" />
                        Call
                    </Button>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => open_log("inbound")}
                >
                    <Phone className="h-3 w-3" />
                    Log call
                </Button>
            </div>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Log call</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Direction</Label>
                                <div className="flex rounded-md border p-0.5 bg-muted/40">
                                    {(["outbound", "inbound"] as const).map((d) => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => setDirection(d)}
                                            className={`flex-1 py-1 px-2 rounded text-xs font-medium capitalize transition-colors ${
                                                direction === d
                                                    ? "bg-background shadow-sm text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Duration (min)</Label>
                                <Input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    max="720"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    placeholder="—"
                                    className="h-9 text-sm tabular-nums"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Outcome</Label>
                            <select
                                value={outcome}
                                onChange={(e) => setOutcome(e.target.value as Outcome)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                {OUTCOME_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Notes</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="What was discussed, next steps, etc."
                                className="min-h-[80px] text-sm"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                                {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                Save log
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
