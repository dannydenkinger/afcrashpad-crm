"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    AtSign, Briefcase, Calendar, DollarSign, FileText, Mail, Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { getLeadForms, createLeadForm } from "./actions"
import { FormList } from "./FormList"
import { FormBuilder } from "./FormBuilder"
import type { LeadForm } from "./types"
import { FORM_STARTERS } from "@/lib/lead-forms/starters"
import { cn } from "@/lib/utils"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    FileText, Mail, Sparkles, AtSign, Calendar, DollarSign, Briefcase,
}

const ACCENT_TONE: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
}

export function LeadFormsTab({ chromeless = false }: { chromeless?: boolean } = {}) {
    const [forms, setForms] = useState<LeadForm[]>([])
    const [loading, setLoading] = useState(true)
    const [editingFormId, setEditingFormId] = useState<string | null>(null)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [newFormName, setNewFormName] = useState("")
    const [selectedStarterId, setSelectedStarterId] = useState<string>("blank")
    const [creating, setCreating] = useState(false)

    useEffect(() => { loadForms() }, [])

    async function loadForms() {
        setLoading(true)
        const data = await getLeadForms()
        setForms(data)
        setLoading(false)
    }

    function openCreate() {
        setNewFormName("")
        setSelectedStarterId("blank")
        setShowCreateDialog(true)
    }

    function pickStarter(starterId: string) {
        setSelectedStarterId(starterId)
        // Auto-fill the name field with the starter's default if user hasn't typed
        const starter = FORM_STARTERS.find((s) => s.id === starterId)
        if (starter && (!newFormName.trim() || FORM_STARTERS.some((s) => s.defaultName === newFormName))) {
            setNewFormName(starter.defaultName)
        }
    }

    async function handleCreate() {
        if (!newFormName.trim()) {
            toast.error("Please enter a form name")
            return
        }
        setCreating(true)
        try {
            const res = await createLeadForm(newFormName.trim(), selectedStarterId)
            const starter = FORM_STARTERS.find((s) => s.id === selectedStarterId)
            toast.success(starter && starter.id !== "blank" ? `Form created from "${starter.name}" template` : "Form created")
            setShowCreateDialog(false)
            setNewFormName("")
            setSelectedStarterId("blank")
            setEditingFormId(res.formId)
            loadForms()
        } catch (err: any) {
            toast.error(err.message || "Failed to create form")
        }
        setCreating(false)
    }

    if (editingFormId) {
        return (
            <FormBuilder
                formId={editingFormId}
                onBack={() => { setEditingFormId(null); loadForms() }}
            />
        )
    }

    const list = loading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Loading forms…</div>
    ) : (
        <FormList
            forms={forms}
            onEdit={setEditingFormId}
            onCreate={openCreate}
            onRefresh={loadForms}
        />
    )

    return (
        <>
            {chromeless ? (
                list
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Lead Forms
                        </CardTitle>
                        <CardDescription>
                            Create customizable lead capture forms. Share them as links or embed on your website.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>{list}</CardContent>
                </Card>
            )}

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create a form</DialogTitle>
                        <DialogDescription>
                            Pick a starter to skip the blank canvas — you can edit every field after.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* Template picker grid */}
                        <div>
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                                Start from
                            </Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[340px] overflow-y-auto pr-1">
                                {FORM_STARTERS.map((starter) => {
                                    const Icon = ICONS[starter.icon] || FileText
                                    const isSelected = selectedStarterId === starter.id
                                    return (
                                        <button
                                            key={starter.id}
                                            type="button"
                                            onClick={() => pickStarter(starter.id)}
                                            className={cn(
                                                "group relative text-left rounded-lg border p-3 transition-all",
                                                isSelected
                                                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "w-8 h-8 rounded-md flex items-center justify-center mb-2",
                                                    ACCENT_TONE[starter.accent] || ACCENT_TONE.primary,
                                                )}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="text-sm font-semibold leading-tight mb-0.5">
                                                {starter.name}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground leading-snug">
                                                {starter.description}
                                            </div>
                                            {starter.id !== "blank" && (
                                                <div className="mt-2 text-[10px] text-muted-foreground/70 tabular-nums">
                                                    {starter.fields.length} field{starter.fields.length === 1 ? "" : "s"}
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Form name */}
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Form name</Label>
                            <Input
                                value={newFormName}
                                onChange={(e) => setNewFormName(e.target.value)}
                                placeholder="e.g., Contact Form, Get a Quote, Book a Call"
                                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                                autoFocus
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={creating || !newFormName.trim()}>
                            {creating ? "Creating…" : "Create form"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
