"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { CalendarClock, Save, Loader2 } from "lucide-react"
import { getPipelinePrioritySettings, updatePipelinePrioritySettings } from "./actions"
import { toast } from "sonner"

export function PipelinePrioritySettings() {
    const [urgentDays, setUrgentDays] = useState(14)
    const [soonDays, setSoonDays] = useState(30)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState<"success" | "error" | null>(null)

    useEffect(() => {
        getPipelinePrioritySettings().then((res) => {
            if (res.success && res.settings) {
                setUrgentDays(res.settings.urgentDays)
                setSoonDays(res.settings.soonDays)
            }
            setIsLoading(false)
        })
    }, [])

    const handleSave = async () => {
        const u = Math.max(0, Math.floor(Number(urgentDays)) || 14)
        const s = Math.max(u, Math.floor(Number(soonDays)) || 30)
        setUrgentDays(u)
        setSoonDays(s)
        setIsSaving(true)
        setMessage(null)
        const res = await updatePipelinePrioritySettings({ urgentDays: u, soonDays: s })
        setIsSaving(false)
        setMessage(res.success ? "success" : "error")
        if (res.success) {
            toast.success("Priority settings saved")
            setTimeout(() => setMessage(null), 3000)
        } else {
            toast.error("Failed to save priority settings")
        }
    }

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        Pipeline priority date ranges
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Pipeline priority date ranges
                </CardTitle>
                <CardDescription>
                    Kanban cards and the pipeline table color deals by how soon the stay starts: Urgent (red), Soon (yellow), Planned (blue). Set the day thresholds below.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-6 max-w-md">
                    <div className="grid gap-2">
                        <Label htmlFor="urgent-days">Urgent (red) — stay starts in ≤ ___ days</Label>
                        <Input
                            id="urgent-days"
                            type="number"
                            min={0}
                            value={urgentDays}
                            onChange={(e) => setUrgentDays(Number(e.target.value) || 0)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="soon-days">Soon (yellow) — stay starts in ≤ ___ days</Label>
                        <Input
                            id="soon-days"
                            type="number"
                            min={urgentDays}
                            value={soonDays}
                            onChange={(e) => setSoonDays(Number(e.target.value) || urgentDays)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSaving ? "Saving…" : "Save"}
                        </Button>
                        {message === "success" && (
                            <span className="text-sm text-green-600">Saved.</span>
                        )}
                        {message === "error" && (
                            <span className="text-sm text-destructive">Failed to save.</span>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
