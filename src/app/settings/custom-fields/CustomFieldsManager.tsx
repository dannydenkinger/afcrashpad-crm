"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, GripVertical, X, Layers } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
} from "./actions"
import type { CustomField } from "./types"

const FIELD_TYPES = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "dropdown", label: "Dropdown" },
    { value: "checkbox", label: "Checkbox" },
    { value: "url", label: "URL" },
    { value: "email", label: "Email" },
]

const FIELD_TYPE_COLORS: Record<string, string> = {
    text: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    number: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    date: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    dropdown: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    checkbox: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    url: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
    email: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
}

interface FieldFormState {
    name: string
    type: string
    entityType: string
    required: boolean
    options: string[]
}

const DEFAULT_FORM: FieldFormState = {
    name: "",
    type: "text",
    entityType: "contact",
    required: false,
    options: [],
}

export function CustomFieldsManager() {
    const [fields, setFields] = useState<CustomField[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingField, setEditingField] = useState<CustomField | null>(null)
    const [form, setForm] = useState<FieldFormState>(DEFAULT_FORM)
    const [saving, setSaving] = useState(false)
    const [newOption, setNewOption] = useState("")
    const [activeTab, setActiveTab] = useState<"contact" | "deal">("contact")

    useEffect(() => {
        loadFields()
    }, [])

    async function loadFields() {
        setLoading(true)
        try {
            const data = await getCustomFields()
            setFields(data)
        } catch (err) {
            toast.error("Failed to load custom fields")
        } finally {
            setLoading(false)
        }
    }

    function openCreateDialog() {
        setEditingField(null)
        setForm({ ...DEFAULT_FORM, entityType: activeTab })
        setNewOption("")
        setDialogOpen(true)
    }

    function openEditDialog(field: CustomField) {
        setEditingField(field)
        setForm({
            name: field.name,
            type: field.type,
            entityType: field.entityType,
            required: field.required,
            options: [...field.options],
        })
        setNewOption("")
        setDialogOpen(true)
    }

    async function handleSave() {
        if (!form.name.trim()) {
            toast.error("Field name is required")
            return
        }
        if (form.type === "dropdown" && form.options.length === 0) {
            toast.error("Dropdown fields require at least one option")
            return
        }

        setSaving(true)
        try {
            if (editingField) {
                await updateCustomField({
                    id: editingField.id,
                    name: form.name.trim(),
                    type: form.type,
                    entityType: form.entityType,
                    required: form.required,
                    options: form.options,
                })
                toast.success("Custom field updated")
            } else {
                await createCustomField({
                    name: form.name.trim(),
                    type: form.type,
                    entityType: form.entityType,
                    required: form.required,
                    options: form.options,
                })
                toast.success("Custom field created")
            }
            setDialogOpen(false)
            loadFields()
        } catch (err: any) {
            toast.error(err.message || "Failed to save custom field")
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(field: CustomField) {
        if (!confirm(`Delete custom field "${field.name}"? This will not remove existing values from records.`)) return
        try {
            await deleteCustomField(field.id)
            toast.success("Custom field deleted")
            loadFields()
        } catch (err: any) {
            toast.error(err.message || "Failed to delete custom field")
        }
    }

    function addOption() {
        const trimmed = newOption.trim()
        if (!trimmed) return
        if (form.options.includes(trimmed)) {
            toast.error("Option already exists")
            return
        }
        setForm((prev) => ({ ...prev, options: [...prev.options, trimmed] }))
        setNewOption("")
    }

    function removeOption(option: string) {
        setForm((prev) => ({ ...prev, options: prev.options.filter((o) => o !== option) }))
    }

    const contactFields = fields.filter((f) => f.entityType === "contact")
    const dealFields = fields.filter((f) => f.entityType === "deal")
    const displayedFields = activeTab === "contact" ? contactFields : dealFields

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Custom Fields
                    </CardTitle>
                    <CardDescription>
                        Define custom data fields for contacts and deals. These fields appear in detail views.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Tab selector */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant={activeTab === "contact" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setActiveTab("contact")}
                        >
                            Contacts ({contactFields.length})
                        </Button>
                        <Button
                            variant={activeTab === "deal" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setActiveTab("deal")}
                        >
                            Deals ({dealFields.length})
                        </Button>
                        <div className="flex-1" />
                        <Button size="sm" onClick={openCreateDialog}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add Field
                        </Button>
                    </div>

                    {/* Field list */}
                    {loading ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">Loading custom fields...</div>
                    ) : displayedFields.length === 0 ? (
                        <div className="text-center py-8 border rounded-lg border-dashed">
                            <p className="text-sm text-muted-foreground">No custom fields defined for {activeTab === "contact" ? "contacts" : "deals"}.</p>
                            <Button variant="link" size="sm" onClick={openCreateDialog} className="mt-2">
                                Create your first custom field
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {displayedFields.map((field) => (
                                <div key={field.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors group">
                                    <GripVertical className="h-4 w-4 text-muted-foreground/30" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{field.name}</span>
                                            {field.required && (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Required</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge className={`text-[10px] px-1.5 py-0 border-0 ${FIELD_TYPE_COLORS[field.type] || ""}`}>
                                                {FIELD_TYPES.find((t) => t.value === field.type)?.label || field.type}
                                            </Badge>
                                            {field.type === "dropdown" && field.options.length > 0 && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    {field.options.length} option{field.options.length !== 1 ? "s" : ""}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(field)}>
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(field)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingField ? "Edit Custom Field" : "Add Custom Field"}</DialogTitle>
                        <DialogDescription>
                            {editingField
                                ? "Update the custom field configuration."
                                : "Define a new custom field for your records."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="field-name">Field Name</Label>
                            <Input
                                id="field-name"
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g. Preferred Move-In Date"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Field Type</Label>
                                <Select value={form.type} onValueChange={(v) => setForm((prev) => ({ ...prev, type: v, options: v !== "dropdown" ? [] : prev.options }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FIELD_TYPES.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Entity Type</Label>
                                <Select value={form.entityType} onValueChange={(v) => setForm((prev) => ({ ...prev, entityType: v }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="contact">Contact</SelectItem>
                                        <SelectItem value="deal">Deal</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                checked={form.required}
                                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, required: checked }))}
                            />
                            <Label className="cursor-pointer">Required field</Label>
                        </div>

                        {form.type === "dropdown" && (
                            <div className="space-y-2">
                                <Label>Dropdown Options</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={newOption}
                                        onChange={(e) => setNewOption(e.target.value)}
                                        placeholder="Add option..."
                                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
                                    />
                                    <Button type="button" size="sm" variant="outline" onClick={addOption}>
                                        Add
                                    </Button>
                                </div>
                                {form.options.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {form.options.map((option) => (
                                            <Badge key={option} variant="secondary" className="gap-1 pr-1">
                                                {option}
                                                <button onClick={() => removeOption(option)} className="ml-1 hover:text-destructive">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Saving..." : editingField ? "Update Field" : "Create Field"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
