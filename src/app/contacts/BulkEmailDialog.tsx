"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Mail, Loader2, Send, FileText, AlertCircle, CheckCircle2 } from "lucide-react"
import { getEmailTemplates } from "@/app/settings/automations/actions"
import { sendBulkEmail } from "./actions"
import { toast } from "sonner"

interface BulkEmailDialogProps {
    isOpen: boolean
    onClose: () => void
    contacts: { id: string; name: string; email: string }[]
}

export function BulkEmailDialog({ isOpen, onClose, contacts }: BulkEmailDialogProps) {
    const [templates, setTemplates] = useState<{ id: string; name: string; subject: string; body: string }[]>([])
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
    const [subject, setSubject] = useState("")
    const [body, setBody] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [result, setResult] = useState<{ sent: number; skipped: number; errors?: string[] } | null>(null)
    const [loadingTemplates, setLoadingTemplates] = useState(false)

    const recipientsWithEmail = contacts.filter(c => c.email)

    useEffect(() => {
        if (isOpen) {
            setLoadingTemplates(true)
            getEmailTemplates()
                .then(res => {
                    if (res.success && res.templates) {
                        setTemplates(res.templates as { id: string; name: string; subject: string; body: string }[])
                    }
                })
                .finally(() => setLoadingTemplates(false))

            // Reset state on open
            setSelectedTemplateId("")
            setSubject("")
            setBody("")
            setResult(null)
        }
    }, [isOpen])

    const handleTemplateChange = (templateId: string) => {
        setSelectedTemplateId(templateId)
        const template = templates.find(t => t.id === templateId)
        if (template) {
            setSubject(template.subject)
            setBody(template.body)
        }
    }

    const handleSend = async () => {
        if (!subject.trim() || !body.trim()) {
            toast.error("Subject and body are required")
            return
        }

        setIsSending(true)
        try {
            const contactIds = contacts.map(c => c.id)
            const res = await sendBulkEmail(contactIds, subject, body)
            if (res.success) {
                setResult({
                    sent: res.sent || 0,
                    skipped: res.skipped || 0,
                    errors: res.errors,
                })
                toast.success(`Email sent to ${res.sent} contact${(res.sent || 0) !== 1 ? "s" : ""}`)
            } else {
                toast.error(res.error || "Failed to send emails")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setIsSending(false)
        }
    }

    const mergeFields = [
        { tag: "{{name}}", label: "Name" },
        { tag: "{{email}}", label: "Email" },
        { tag: "{{phone}}", label: "Phone" },
        { tag: "{{businessName}}", label: "Business" },
        { tag: "{{status}}", label: "Status" },
    ]

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-primary" />
                        Send Bulk Email
                    </DialogTitle>
                    <DialogDescription>
                        Send an email to {contacts.length} selected contact{contacts.length !== 1 ? "s" : ""}.
                        {recipientsWithEmail.length < contacts.length && (
                            <span className="text-amber-600">
                                {" "}({contacts.length - recipientsWithEmail.length} without email will be skipped)
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
                    {!result ? (
                        <>
                            {/* Recipients count */}
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="gap-1">
                                    <Mail className="h-3 w-3" />
                                    {recipientsWithEmail.length} recipient{recipientsWithEmail.length !== 1 ? "s" : ""}
                                </Badge>
                            </div>

                            {/* Template selector */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Email Template (optional)
                                </label>
                                <select
                                    value={selectedTemplateId}
                                    onChange={(e) => handleTemplateChange(e.target.value)}
                                    disabled={loadingTemplates}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="">
                                        {loadingTemplates ? "Loading templates..." : "-- Select a template --"}
                                    </option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Subject */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Subject
                                </label>
                                <Input
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Email subject line..."
                                    className="h-9"
                                />
                            </div>

                            {/* Body */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Body (HTML supported)
                                </label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    placeholder="Write your email content here... Use merge fields like {{name}} to personalize."
                                    className="w-full min-h-[160px] p-3 rounded-lg border bg-background text-sm resize-y font-mono"
                                />
                            </div>

                            {/* Merge field hints */}
                            <div className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Available Merge Fields
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {mergeFields.map(f => (
                                        <Badge
                                            key={f.tag}
                                            variant="outline"
                                            className="text-xs cursor-pointer hover:bg-muted transition-colors"
                                            onClick={() => setBody(prev => prev + f.tag)}
                                        >
                                            {f.tag}
                                            <span className="ml-1 text-muted-foreground">{f.label}</span>
                                        </Badge>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">Click a merge field to insert it into the body.</p>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center gap-3 text-center">
                                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                                <div>
                                    <p className="text-base font-bold text-emerald-600">
                                        Email sent to {result.sent} contact{result.sent !== 1 ? "s" : ""}
                                    </p>
                                    {result.skipped > 0 && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {result.skipped} skipped (no email address)
                                        </p>
                                    )}
                                </div>
                            </div>

                            {result.errors && result.errors.length > 0 && (
                                <div className="border rounded-lg p-3 space-y-1">
                                    <p className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Send Errors
                                    </p>
                                    {result.errors.slice(0, 5).map((err, i) => (
                                        <p key={i} className="text-xs text-muted-foreground">{err}</p>
                                    ))}
                                    {result.errors.length > 5 && (
                                        <p className="text-xs text-muted-foreground italic">
                                            ...and {result.errors.length - 5} more
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSending}>
                        {result ? "Close" : "Cancel"}
                    </Button>
                    {!result && (
                        <Button
                            onClick={handleSend}
                            disabled={isSending || !subject.trim() || !body.trim() || recipientsWithEmail.length === 0}
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Send to {recipientsWithEmail.length} Contact{recipientsWithEmail.length !== 1 ? "s" : ""}
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
