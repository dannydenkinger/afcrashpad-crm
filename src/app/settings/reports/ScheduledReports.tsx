"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Trash2, Edit2, Clock, Mail, BarChart3, Users, DollarSign, X } from "lucide-react"
import { toast } from "sonner"
import {
    getScheduledReports,
    createScheduledReport,
    updateScheduledReport,
    deleteScheduledReport,
} from "./actions"
import type { ScheduledReport } from "./types"

const REPORT_TYPES = [
    { value: "pipeline_summary", label: "Pipeline Summary", icon: BarChart3, description: "Deal stages, values, and movements" },
    { value: "contacts_summary", label: "Contacts Summary", icon: Users, description: "New contacts, lead sources, statuses" },
    { value: "revenue_summary", label: "Revenue Summary", icon: DollarSign, description: "Revenue, profit, and commission data" },
] as const

const FREQUENCIES = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
] as const

function getReportTypeLabel(type: string) {
    return REPORT_TYPES.find(r => r.value === type)?.label || type
}

function getReportTypeIcon(type: string) {
    return REPORT_TYPES.find(r => r.value === type)?.icon || BarChart3
}

function getFrequencyLabel(freq: string) {
    return FREQUENCIES.find(f => f.value === freq)?.label || freq
}

export function ScheduledReports() {
    const [reports, setReports] = useState<ScheduledReport[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Form state
    const [formFrequency, setFormFrequency] = useState("weekly")
    const [formReportType, setFormReportType] = useState("pipeline_summary")
    const [formRecipients, setFormRecipients] = useState<string[]>([])
    const [recipientInput, setRecipientInput] = useState("")

    useEffect(() => {
        async function load() {
            const res = await getScheduledReports()
            if (res.success && res.reports) setReports(res.reports)
            setIsLoading(false)
        }
        load()
    }, [])

    const handleOpenCreate = () => {
        setEditingReport(null)
        setFormFrequency("weekly")
        setFormReportType("pipeline_summary")
        setFormRecipients([])
        setRecipientInput("")
        setIsDialogOpen(true)
    }

    const handleOpenEdit = (report: ScheduledReport) => {
        setEditingReport(report)
        setFormFrequency(report.frequency)
        setFormReportType(report.reportType)
        setFormRecipients([...report.recipients])
        setRecipientInput("")
        setIsDialogOpen(true)
    }

    const handleAddRecipient = () => {
        const email = recipientInput.trim().toLowerCase()
        if (!email) return
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            toast.error("Please enter a valid email address.")
            return
        }
        if (formRecipients.includes(email)) {
            toast.error("This email is already added.")
            return
        }
        setFormRecipients(prev => [...prev, email])
        setRecipientInput("")
    }

    const handleRemoveRecipient = (email: string) => {
        setFormRecipients(prev => prev.filter(r => r !== email))
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleAddRecipient()
        }
    }

    const handleSave = async () => {
        if (formRecipients.length === 0) {
            toast.error("Add at least one recipient email.")
            return
        }

        setIsSaving(true)

        if (editingReport) {
            const res = await updateScheduledReport(editingReport.id, {
                frequency: formFrequency,
                reportType: formReportType,
                recipients: formRecipients,
            })
            if (res.success) {
                setReports(prev =>
                    prev.map(r =>
                        r.id === editingReport.id
                            ? { ...r, frequency: formFrequency as any, reportType: formReportType as any, recipients: formRecipients }
                            : r
                    )
                )
                toast.success("Scheduled report updated.")
            } else {
                toast.error(res.error || "Failed to update report.")
            }
        } else {
            const res = await createScheduledReport({
                frequency: formFrequency,
                reportType: formReportType,
                recipients: formRecipients,
            })
            if (res.success && res.id) {
                setReports(prev => [
                    {
                        id: res.id!,
                        userId: "",
                        frequency: formFrequency as any,
                        reportType: formReportType as any,
                        recipients: formRecipients,
                        enabled: true,
                        lastSentAt: null,
                        createdAt: new Date().toISOString(),
                    },
                    ...prev,
                ])
                toast.success("Scheduled report created.")
            } else {
                toast.error(res.error || "Failed to create report.")
            }
        }

        setIsSaving(false)
        setIsDialogOpen(false)
    }

    const handleToggle = async (id: string, enabled: boolean) => {
        setReports(prev => prev.map(r => (r.id === id ? { ...r, enabled } : r)))
        const res = await updateScheduledReport(id, { enabled })
        if (!res.success) {
            setReports(prev => prev.map(r => (r.id === id ? { ...r, enabled: !enabled } : r)))
            toast.error("Failed to toggle report.")
        }
    }

    const handleDelete = async (id: string) => {
        const res = await deleteScheduledReport(id)
        if (res.success) {
            setReports(prev => prev.filter(r => r.id !== id))
            toast.success("Scheduled report deleted.")
        } else {
            toast.error(res.error || "Failed to delete report.")
        }
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-12 text-center text-muted-foreground">Loading scheduled reports...</CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-500" />
                        Scheduled Reports
                    </CardTitle>
                    <CardDescription>Configure automated report emails sent on a recurring schedule.</CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Report
                </Button>
            </CardHeader>
            <CardContent>
                {reports.length === 0 ? (
                    <div className="flex items-center justify-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
                        <div className="text-center">
                            <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No scheduled reports yet.</p>
                            <Button variant="link" className="mt-1" onClick={handleOpenCreate}>
                                Create your first scheduled report
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reports.map(report => {
                            const Icon = getReportTypeIcon(report.reportType)
                            return (
                                <div
                                    key={report.id}
                                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                                >
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-semibold">{getReportTypeLabel(report.reportType)}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {getFrequencyLabel(report.frequency)}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">
                                                To: {report.recipients.join(", ")}
                                            </p>
                                            {report.lastSentAt && (
                                                <p className="text-xs text-muted-foreground">
                                                    Last sent: {new Date(report.lastSentAt).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Switch
                                            checked={report.enabled}
                                            onCheckedChange={v => handleToggle(report.id, v)}
                                        />
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(report)}>
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                                            onClick={() => handleDelete(report.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>

            {/* Create / Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingReport ? "Edit Scheduled Report" : "Create Scheduled Report"}</DialogTitle>
                        <DialogDescription>
                            Configure an automated report email to be sent on a recurring schedule.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 pt-2">
                        {/* Report Type */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Report Type</Label>
                            <Select value={formReportType} onValueChange={setFormReportType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {REPORT_TYPES.map(rt => (
                                        <SelectItem key={rt.value} value={rt.value}>
                                            <div className="flex flex-col">
                                                <span>{rt.label}</span>
                                                <span className="text-xs text-muted-foreground">{rt.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Frequency */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Frequency</Label>
                            <Select value={formFrequency} onValueChange={setFormFrequency}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FREQUENCIES.map(f => (
                                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Recipients */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Recipients</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="email"
                                    placeholder="Enter email address"
                                    value={recipientInput}
                                    onChange={e => setRecipientInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="flex-1"
                                />
                                <Button type="button" variant="outline" size="sm" onClick={handleAddRecipient}>
                                    Add
                                </Button>
                            </div>
                            {formRecipients.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {formRecipients.map(email => (
                                        <Badge key={email} variant="secondary" className="flex items-center gap-1 pr-1">
                                            <Mail className="h-3 w-3" />
                                            {email}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRecipient(email)}
                                                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Saving..." : editingReport ? "Save Changes" : "Create Report"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
