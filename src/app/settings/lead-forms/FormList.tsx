"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Pencil, Copy, Trash2, Link2, ToggleLeft, ToggleRight, BarChart3, FileText } from "lucide-react"
import { toast } from "sonner"
import { deleteLeadForm, duplicateLeadForm, toggleLeadFormStatus } from "./actions"
import { EmbedCodeDialog } from "./EmbedCodeDialog"
import type { LeadForm } from "./types"
import { EmptyState } from "@/components/ui/EmptyState"
import { IconButton } from "@/components/ui/IconButton"

interface Props {
    forms: LeadForm[]
    onEdit: (formId: string) => void
    onCreate: () => void
    onRefresh: () => void
}

export function FormList({ forms, onEdit, onCreate, onRefresh }: Props) {
    const [embedForm, setEmbedForm] = useState<LeadForm | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<LeadForm | null>(null)

    const handleDelete = async () => {
        if (!deleteTarget) return
        const res = await deleteLeadForm(deleteTarget.id)
        if (res.success) { toast.success("Form deleted"); onRefresh() }
        else toast.error("Failed to delete form")
        setDeleteTarget(null)
    }

    const handleDuplicate = async (form: LeadForm) => {
        const res = await duplicateLeadForm(form.id)
        if (res) { toast.success("Form duplicated"); onRefresh() }
        else toast.error("Failed to duplicate")
    }

    const handleToggle = async (form: LeadForm) => {
        const res = await toggleLeadFormStatus(form.id)
        if (res.success) { toast.success(`Form ${form.status === "active" ? "deactivated" : "activated"}`); onRefresh() }
        else toast.error("Failed to toggle status")
    }

    if (forms.length === 0) {
        return (
            <div className="border rounded-lg border-dashed">
                <EmptyState
                    Icon={FileText}
                    accent="primary"
                    title="No lead forms yet"
                    description="Create a customizable form to capture leads from your website or share as a link."
                    action={{ label: "Create form", onClick: onCreate }}
                    compact
                />
            </div>
        )
    }

    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">{forms.length} form{forms.length !== 1 ? "s" : ""}</p>
                <Button size="sm" onClick={onCreate}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Create Form
                </Button>
            </div>

            <div className="space-y-2">
                {forms.map(form => (
                    <div key={form.id} className="flex items-center gap-3 p-3 border rounded-lg group hover:bg-muted/30 transition-colors">
                        <div className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: form.style?.accentColor || "#2563eb" }}>
                            <span className="text-white text-sm font-bold">{form.name?.charAt(0)?.toUpperCase()}</span>
                        </div>

                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(form.id)}>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{form.name}</span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${
                                    form.status === "active"
                                        ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                                        : "text-muted-foreground"
                                }`}>
                                    {form.status === "active" ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                <span>{form.submissionCount || 0} submission{form.submissionCount !== 1 ? "s" : ""}</span>
                                {form.viewCount ? <span>{form.viewCount} view{form.viewCount !== 1 ? "s" : ""}</span> : null}
                                <span>{form.fields?.length || 0} fields</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                            <IconButton label="Edit" className="h-8 w-8" onClick={() => onEdit(form.id)}>
                                <Pencil className="h-3.5 w-3.5" />
                            </IconButton>
                            <IconButton label="Share or embed" className="h-8 w-8" onClick={() => setEmbedForm(form)}>
                                <Link2 className="h-3.5 w-3.5" />
                            </IconButton>
                            <IconButton
                                label={form.status === "active" ? "Deactivate" : "Activate"}
                                className="h-8 w-8"
                                onClick={() => handleToggle(form)}
                            >
                                {form.status === "active" ? <ToggleRight className="h-3.5 w-3.5 text-green-600" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                            </IconButton>
                            <IconButton label="Duplicate" className="h-8 w-8" onClick={() => handleDuplicate(form)}>
                                <Copy className="h-3.5 w-3.5" />
                            </IconButton>
                            <IconButton
                                label="Delete"
                                className="h-8 w-8 text-destructive opacity-50 hover:opacity-100"
                                onClick={() => setDeleteTarget(form)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </IconButton>
                        </div>
                    </div>
                ))}
            </div>

            {embedForm && (
                <EmbedCodeDialog
                    open={!!embedForm}
                    onClose={() => setEmbedForm(null)}
                    formId={embedForm.id}
                    formName={embedForm.name}
                />
            )}

            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Form</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This will deactivate the form and it will no longer accept submissions.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete Form
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
