"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
    Loader2,
    Plus,
    Trash2,
    FileText,
    ArrowLeft,
    Wand2,
    Download,
} from "lucide-react"
import {
    getDocumentTemplates,
    createDocumentTemplate,
    deleteDocumentTemplate,
    generateDocumentFromTemplate,
} from "./template-actions"
import { AVAILABLE_MERGE_FIELDS } from "./types"

interface Template {
    id: string
    name: string
    description: string
    content: string
    category: string
    mergeFields: string[]
    createdAt: string
}

interface DocumentTemplateDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contactId: string
    onDocumentGenerated?: () => void
}

type View = "list" | "create" | "preview"

export function DocumentTemplateDialog({
    open,
    onOpenChange,
    contactId,
    onDocumentGenerated,
}: DocumentTemplateDialogProps) {
    const [view, setView] = useState<View>("list")
    const [templates, setTemplates] = useState<Template[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedContent, setGeneratedContent] = useState<string | null>(null)
    const [generatedName, setGeneratedName] = useState("")

    // Create form state
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [content, setContent] = useState("")
    const [category, setCategory] = useState("General")
    const [selectedMergeFields, setSelectedMergeFields] = useState<string[]>([])

    const fetchTemplates = async () => {
        setIsLoading(true)
        const res = await getDocumentTemplates()
        if (res.success) {
            setTemplates(res.templates as unknown as Template[])
        }
        setIsLoading(false)
    }

    useEffect(() => {
        if (open) {
            fetchTemplates()
            setView("list")
        }
    }, [open])

    const handleCreate = async () => {
        if (!name.trim() || !content.trim()) return
        setIsSaving(true)
        const res = await createDocumentTemplate(
            name,
            description,
            content,
            category,
            selectedMergeFields
        )
        if (res.success) {
            resetForm()
            setView("list")
            fetchTemplates()
        }
        setIsSaving(false)
    }

    const handleDelete = async (templateId: string) => {
        const res = await deleteDocumentTemplate(templateId)
        if (res.success) fetchTemplates()
    }

    const handleGenerate = async (templateId: string) => {
        setIsGenerating(true)
        const res = await generateDocumentFromTemplate(templateId, contactId)
        if (res.success && res.content) {
            setGeneratedContent(res.content)
            setGeneratedName(res.name || "Generated Document")
            setView("preview")
            onDocumentGenerated?.()
        }
        setIsGenerating(false)
    }

    const handleDownloadPDF = () => {
        if (!generatedContent) return
        // Create a printable HTML page and trigger print/save as PDF
        const printWindow = window.open("", "_blank")
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${generatedName}</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
                        h1, h2, h3 { margin-top: 1.5em; }
                        table { border-collapse: collapse; width: 100%; }
                        td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    </style>
                </head>
                <body>${generatedContent}</body>
                </html>
            `)
            printWindow.document.close()
            printWindow.print()
        }
    }

    const resetForm = () => {
        setName("")
        setDescription("")
        setContent("")
        setCategory("General")
        setSelectedMergeFields([])
    }

    const toggleMergeField = (field: string) => {
        setSelectedMergeFields(prev =>
            prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
        )
    }

    const insertMergeField = (field: string) => {
        setContent(prev => prev + `{{${field}}}`)
        if (!selectedMergeFields.includes(field)) {
            setSelectedMergeFields(prev => [...prev, field])
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 border-none shadow-md bg-card/95 backdrop-blur-md">
                <DialogHeader className="px-5 py-4 border-b border-border/40 shrink-0">
                    <div className="flex items-center gap-3">
                        {view !== "list" && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => { setView("list"); setGeneratedContent(null) }}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <div>
                            <DialogTitle className="text-sm font-semibold">
                                {view === "list" && "Document Templates"}
                                {view === "create" && "Create Template"}
                                {view === "preview" && "Generated Document"}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                {view === "list" && "Create reusable templates with merge fields for contacts"}
                                {view === "create" && "Design an HTML template with merge field placeholders"}
                                {view === "preview" && generatedName}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto min-h-0 p-5">
                    {/* LIST VIEW */}
                    {view === "list" && (
                        <div className="space-y-4">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-9 text-xs gap-1.5 border-dashed"
                                onClick={() => { resetForm(); setView("create") }}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Create New Template
                            </Button>

                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="text-center py-10">
                                    <FileText className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                                    <p className="text-sm text-muted-foreground">No templates yet.</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">
                                        Create a template with merge fields like {"{{contactName}}"} to auto-fill contact data.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {templates.map(template => (
                                        <div
                                            key={template.id}
                                            className="p-4 rounded-xl border bg-background hover:bg-muted/10 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-sm font-medium truncate">{template.name}</h4>
                                                        <Badge variant="secondary" className="text-[10px] shrink-0">
                                                            {template.category}
                                                        </Badge>
                                                    </div>
                                                    {template.description && (
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                                                    )}
                                                    {template.mergeFields?.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {template.mergeFields.map(field => (
                                                                <Badge key={field} variant="outline" className="text-[10px] font-mono">
                                                                    {`{{${field}}}`}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-xs gap-1"
                                                        onClick={() => handleGenerate(template.id)}
                                                        disabled={isGenerating}
                                                    >
                                                        {isGenerating ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <Wand2 className="h-3 w-3" />
                                                        )}
                                                        Generate
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-500 hover:text-red-600"
                                                        onClick={() => handleDelete(template.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* CREATE VIEW */}
                    {view === "create" && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Template Name</Label>
                                    <Input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. Lease Agreement"
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Category</Label>
                                    <Input
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        placeholder="e.g. Agreements, Forms"
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Description</Label>
                                <Input
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Brief description of this template"
                                    className="h-9 text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Merge Fields</Label>
                                <p className="text-[10px] text-muted-foreground">
                                    Click a field to insert it into the template content. Fields use {"{{fieldName}}"} syntax.
                                </p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {AVAILABLE_MERGE_FIELDS.map(field => (
                                        <button
                                            key={field.key}
                                            onClick={() => insertMergeField(field.key)}
                                            className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                                                selectedMergeFields.includes(field.key)
                                                    ? "bg-primary/10 border-primary/30 text-primary"
                                                    : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50"
                                            }`}
                                        >
                                            {field.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Template Content (HTML)</Label>
                                <Textarea
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    placeholder={`<h1>Crashpad Lease Agreement</h1>\n<p>This agreement is between AFCrashpad and <strong>{{contactName}}</strong>.</p>\n<p>Move-in date: {{stayStartDate}}</p>\n<p>Move-out date: {{stayEndDate}}</p>\n<p>Date: {{currentDate}}</p>`}
                                    className="min-h-[200px] text-xs font-mono"
                                />
                            </div>

                            {content && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Preview</Label>
                                    <div
                                        className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-4 bg-white dark:bg-background text-xs"
                                        dangerouslySetInnerHTML={{ __html: content }}
                                    />
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <Button
                                    size="sm"
                                    onClick={handleCreate}
                                    disabled={isSaving || !name.trim() || !content.trim()}
                                >
                                    {isSaving && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                                    Save Template
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* PREVIEW VIEW (after generating) */}
                    {view === "preview" && generatedContent && (
                        <div className="space-y-4">
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-white dark:bg-background"
                                dangerouslySetInnerHTML={{ __html: generatedContent }}
                            />
                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={handleDownloadPDF}
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Print / Save as PDF
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => { setView("list"); setGeneratedContent(null); onOpenChange(false) }}
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
