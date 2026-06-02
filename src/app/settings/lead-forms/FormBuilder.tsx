"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
    ArrowLeft, Palette, Eye, Save, Loader2, Plus, Trash2, Layers, Bell, BarChart3,
    Copy, GripVertical, Undo2, Redo2, Check, Monitor, Smartphone,
    PanelLeftClose, PanelLeft,
} from "lucide-react"
import { toast } from "sonner"
import {
    DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor,
    useDroppable, useSensor, useSensors,
    type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core"
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { getLeadForm, updateLeadForm } from "./actions"
import { FieldPalette } from "./FieldPalette"
import { FieldPropertiesEditor } from "./FieldPropertiesEditor"
import { StyleSettings } from "./StyleSettings"
import { NotificationSettings } from "./NotificationSettings"
import { FormAnalytics } from "./FormAnalytics"
import { FormFieldRenderer } from "@/components/forms/FormFieldRenderer"
import { FIELD_TYPE_CONFIG } from "./types"
import type { LeadForm, FormField, FormPage, FieldType } from "./types"

// ── Empty-canvas drop target ─────────────────────────────────────────────────

const QUICK_ADD: { type: FieldType; label: string }[] = [
    { type: "short_text", label: "Short text" },
    { type: "email", label: "Email" },
    { type: "phone", label: "Phone" },
    { type: "long_text", label: "Long text" },
    { type: "dropdown", label: "Dropdown" },
    { type: "checkbox", label: "Checkboxes" },
]

function EmptyCanvasDrop({
    isPaletteDragging,
    textColor,
    onQuickAdd,
}: {
    isPaletteDragging: boolean
    textColor: string
    onQuickAdd: (type: FieldType) => void
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: "canvas-empty",
        data: { kind: "empty" },
    })
    return (
        <div
            ref={setNodeRef}
            style={{
                padding: "40px 24px",
                textAlign: "center",
                border: `2px dashed ${isOver ? "#2563eb" : `${textColor}20`}`,
                borderRadius: "12px",
                backgroundColor: isOver ? "rgba(37, 99, 235, 0.05)" : "transparent",
                transition: "all 0.15s ease",
            }}
        >
            <p style={{ fontSize: "15px", fontWeight: 600, color: `${textColor}80`, marginBottom: "4px" }}>
                {isPaletteDragging ? "Drop to add field" : "Add your first field"}
            </p>
            <p style={{ fontSize: "12px", color: `${textColor}50`, marginBottom: "16px" }}>
                {isPaletteDragging
                    ? "Release to drop the field here"
                    : "Drag from the palette, or pick a common type below"}
            </p>
            {!isPaletteDragging && (
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        justifyContent: "center",
                        maxWidth: "440px",
                        margin: "0 auto",
                    }}
                >
                    {QUICK_ADD.map((item) => (
                        <button
                            key={item.type}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onQuickAdd(item.type)
                            }}
                            style={{
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: `1px solid ${textColor}20`,
                                backgroundColor: "rgba(255,255,255,0.6)",
                                color: textColor,
                                fontSize: "12px",
                                fontWeight: 500,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "#2563eb"
                                e.currentTarget.style.backgroundColor = "rgba(37, 99, 235, 0.05)"
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = `${textColor}20`
                                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.6)"
                            }}
                        >
                            + {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Drop slot between/around fields ──────────────────────────────────────────

function DropSlot({ index, isActive }: { index: number; isActive: boolean }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `slot:${index}`,
        data: { kind: "slot", index },
    })
    if (!isActive) return null
    return (
        <div
            ref={setNodeRef}
            className={`mx-auto transition-all`}
            style={{
                height: isOver ? 36 : 8,
                marginTop: isOver ? -4 : -8,
                marginBottom: isOver ? 4 : 0,
            }}
        >
            <div
                className={`h-full w-full rounded-md transition-all ${
                    isOver
                        ? "bg-primary/10 border-2 border-dashed border-primary/60"
                        : "bg-transparent"
                }`}
            />
        </div>
    )
}

// ── Build a fresh field of the given type ────────────────────────────────────

function makeField(type: FieldType): FormField {
    const config = FIELD_TYPE_CONFIG[type]
    return {
        id: crypto.randomUUID().replace(/-/g, "").slice(0, 8),
        type,
        label: config.defaultLabel,
        placeholder: "",
        required: type === "email",
        width: "full",
        ...(["dropdown", "radio", "checkbox"].includes(type) && { options: ["Option 1", "Option 2", "Option 3"] }),
        ...(type === "rating" && { ratingMax: 5 }),
        ...(type === "scale" && { scaleMin: 1, scaleMax: 10 }),
        ...(type === "full_name" && { nameFields: ["first", "last"] as any }),
        ...(type === "address" && { addressFields: ["street", "city", "state", "zip", "country"] as any }),
    } as FormField
}

// ── Sortable Field Wrapper ───────────────────────────────────────────────────

function SortableFieldWrapper({
    field, isSelected, onSelect, onDuplicate, onDelete, children,
}: {
    field: FormField; isSelected: boolean; onSelect: () => void
    onDuplicate: () => void; onDelete: () => void; children: React.ReactNode
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative group rounded-lg transition-all ${isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:ring-1 hover:ring-border"}`}
            onClick={(e) => { e.stopPropagation(); onSelect() }}
        >
            {/* Drag handle + action bar */}
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-0.5 z-10">
                <button {...attributes} {...listeners} className="p-1 rounded hover:bg-muted cursor-grab active:cursor-grabbing" title="Drag to reorder">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
            </div>
            <div className="absolute -right-1 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 z-10 -translate-y-1/2">
                <button onClick={(e) => { e.stopPropagation(); onDuplicate() }} className="p-1 rounded-md bg-background border shadow-sm hover:bg-muted" title="Duplicate field">
                    <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1 rounded-md bg-background border shadow-sm hover:bg-destructive hover:text-white" title="Delete field">
                    <Trash2 className="h-3 w-3" />
                </button>
            </div>
            {children}
        </div>
    )
}

// ── Main FormBuilder ─────────────────────────────────────────────────────────

interface Props {
    formId: string
    onBack: () => void
}

export function FormBuilder({ formId, onBack }: Props) {
    const [form, setForm] = useState<LeadForm | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
    const [showStyleSettings, setShowStyleSettings] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const [showAnalytics, setShowAnalytics] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [currentPageIdx, setCurrentPageIdx] = useState(0)
    const [lastSaved, setLastSaved] = useState<string | null>(null)
    const [showMobileProperties, setShowMobileProperties] = useState(false)
    const [activePaletteType, setActivePaletteType] = useState<FieldType | null>(null)
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
    const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop")
    const [paletteCollapsed, setPaletteCollapsed] = useState(false)

    // Undo/Redo
    const [history, setHistory] = useState<LeadForm[]>([])
    const [historyIdx, setHistoryIdx] = useState(-1)
    const isUndoRedo = useRef(false)

    // Auto-save timer
    const autoSaveTimer = useRef<NodeJS.Timeout | null>(null)

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    useEffect(() => { loadForm() }, [formId])

    // Unsaved changes warning
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (hasChanges) { e.preventDefault(); e.returnValue = "" }
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [hasChanges])

    // Auto-save every 10 seconds when there are changes
    useEffect(() => {
        if (!hasChanges || !form) return
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
        autoSaveTimer.current = setTimeout(() => {
            handleSave(true)
        }, 10000)
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
    }, [form, hasChanges])

    // Keyboard shortcuts: Cmd+S save, Delete delete, Cmd+D duplicate,
    // Esc deselect, Cmd+Z undo, Cmd+Shift+Z redo. Skipped while typing.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            const inEditableField =
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT" ||
                target.isContentEditable
            const mod = e.metaKey || e.ctrlKey

            // Esc always works — deselect or close mobile properties
            if (e.key === "Escape") {
                if (showMobileProperties) {
                    e.preventDefault()
                    setShowMobileProperties(false)
                    return
                }
                if (selectedFieldId) {
                    e.preventDefault()
                    setSelectedFieldId(null)
                    return
                }
            }

            // Cmd+S save (works even from inputs so users can hit save mid-edit)
            if (mod && e.key.toLowerCase() === "s") {
                e.preventDefault()
                if (hasChanges && !saving) handleSave(false)
                return
            }

            // The rest skip when typing
            if (inEditableField) return

            // Cmd+Z undo / Cmd+Shift+Z redo
            if (mod && e.key.toLowerCase() === "z") {
                e.preventDefault()
                if (e.shiftKey) redo()
                else undo()
                return
            }

            // Selected-field shortcuts
            if (selectedFieldId) {
                if (e.key === "Backspace" || e.key === "Delete") {
                    e.preventDefault()
                    deleteField(selectedFieldId)
                    return
                }
                if (mod && e.key.toLowerCase() === "d") {
                    e.preventDefault()
                    duplicateField(selectedFieldId)
                    return
                }
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFieldId, hasChanges, saving, showMobileProperties, historyIdx, history, form])

    async function loadForm() {
        setLoading(true)
        const f = await getLeadForm(formId)
        setForm(f)
        if (f) {
            setHistory([f])
            setHistoryIdx(0)
        }
        setLoading(false)
    }

    const pushHistory = useCallback((newForm: LeadForm) => {
        if (isUndoRedo.current) { isUndoRedo.current = false; return }
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIdx + 1)
            newHistory.push(newForm)
            if (newHistory.length > 50) newHistory.shift()
            return newHistory
        })
        setHistoryIdx(prev => Math.min(prev + 1, 49))
    }, [historyIdx])

    const updateForm = useCallback((newForm: LeadForm) => {
        setForm(newForm)
        setHasChanges(true)
        pushHistory(newForm)
    }, [pushHistory])

    const undo = () => {
        if (historyIdx <= 0) return
        isUndoRedo.current = true
        const newIdx = historyIdx - 1
        setHistoryIdx(newIdx)
        setForm(history[newIdx])
        setHasChanges(true)
    }

    const redo = () => {
        if (historyIdx >= history.length - 1) return
        isUndoRedo.current = true
        const newIdx = historyIdx + 1
        setHistoryIdx(newIdx)
        setForm(history[newIdx])
        setHasChanges(true)
    }

    // ── Field helpers ────────────────────────────────────────────────

    const getCurrentFields = (): FormField[] => {
        if (!form) return []
        if (form.isMultiStep && form.pages?.length) return form.pages[currentPageIdx]?.fields || []
        return form.fields
    }

    const setCurrentFields = (fields: FormField[]) => {
        if (!form) return
        let newForm: LeadForm
        if (form.isMultiStep && form.pages?.length) {
            const newPages = [...form.pages]
            newPages[currentPageIdx] = { ...newPages[currentPageIdx], fields }
            newForm = { ...form, pages: newPages }
        } else {
            newForm = { ...form, fields }
        }
        updateForm(newForm)
    }

    const addField = (type: FieldType) => {
        const newField = makeField(type)
        setCurrentFields([...getCurrentFields(), newField])
        setSelectedFieldId(newField.id)
    }

    const addFieldAt = (type: FieldType, index: number) => {
        const newField = makeField(type)
        const fields = getCurrentFields()
        const clamped = Math.max(0, Math.min(index, fields.length))
        const next = [...fields.slice(0, clamped), newField, ...fields.slice(clamped)]
        setCurrentFields(next)
        setSelectedFieldId(newField.id)
    }

    const duplicateField = (fieldId: string) => {
        const fields = getCurrentFields()
        const sourceIdx = fields.findIndex(f => f.id === fieldId)
        if (sourceIdx < 0) return
        const source = fields[sourceIdx]
        const copy: FormField = {
            ...JSON.parse(JSON.stringify(source)),
            id: crypto.randomUUID().replace(/-/g, "").slice(0, 8),
            label: `${source.label} (copy)`,
        }
        const newFields = [...fields]
        newFields.splice(sourceIdx + 1, 0, copy)
        setCurrentFields(newFields)
        setSelectedFieldId(copy.id)
        toast.success("Field duplicated")
    }

    const updateField = (updatedField: FormField) => {
        setCurrentFields(getCurrentFields().map(f => f.id === updatedField.id ? updatedField : f))
    }

    const deleteField = (fieldId: string) => {
        setCurrentFields(getCurrentFields().filter(f => f.id !== fieldId))
        if (selectedFieldId === fieldId) setSelectedFieldId(null)
    }

    const handleDragStart = (event: DragStartEvent) => {
        const id = String(event.active.id)
        if (id.startsWith("palette:")) {
            const type = id.slice("palette:".length) as FieldType
            setActivePaletteType(type)
        } else {
            setActiveFieldId(id)
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        setActivePaletteType(null)
        setActiveFieldId(null)
        if (!over) return
        const activeId = String(active.id)
        const overId = String(over.id)

        // Palette → canvas
        if (activeId.startsWith("palette:")) {
            const type = activeId.slice("palette:".length) as FieldType
            const fields = getCurrentFields()
            if (overId.startsWith("slot:")) {
                const idx = Number(overId.slice("slot:".length))
                addFieldAt(type, idx)
            } else if (overId === "canvas-empty") {
                addField(type)
            } else {
                const idx = fields.findIndex((f) => f.id === overId)
                addFieldAt(type, idx >= 0 ? idx + 1 : fields.length)
            }
            return
        }

        // Reorder existing field
        if (activeId === overId) return
        const fields = getCurrentFields()
        const oldIndex = fields.findIndex(f => f.id === activeId)
        const newIndex = fields.findIndex(f => f.id === overId)
        if (oldIndex < 0 || newIndex < 0) return
        setCurrentFields(arrayMove(fields, oldIndex, newIndex))
    }

    // ── Multi-step ───────────────────────────────────────────────────

    const toggleMultiStep = () => {
        if (!form) return
        if (!form.isMultiStep) {
            const page: FormPage = { id: crypto.randomUUID().replace(/-/g, "").slice(0, 8), title: "Page 1", fields: form.fields }
            updateForm({ ...form, isMultiStep: true, pages: [page] })
        } else {
            const allFields = form.pages?.flatMap(p => p.fields) || form.fields
            updateForm({ ...form, isMultiStep: false, pages: undefined, fields: allFields })
            setCurrentPageIdx(0)
        }
    }

    const addPage = () => {
        if (!form?.pages) return
        const newPage: FormPage = {
            id: crypto.randomUUID().replace(/-/g, "").slice(0, 8),
            title: `Page ${form.pages.length + 1}`,
            fields: [],
        }
        updateForm({ ...form, pages: [...form.pages, newPage] })
        setCurrentPageIdx(form.pages.length)
    }

    const deletePage = (idx: number) => {
        if (!form?.pages || form.pages.length <= 1) return
        const newPages = form.pages.filter((_, i) => i !== idx)
        updateForm({ ...form, pages: newPages })
        setCurrentPageIdx(Math.min(currentPageIdx, newPages.length - 1))
    }

    const updatePageTitle = (idx: number, title: string) => {
        if (!form?.pages) return
        const newPages = [...form.pages]
        newPages[idx] = { ...newPages[idx], title }
        updateForm({ ...form, pages: newPages })
    }

    // ── Save ─────────────────────────────────────────────────────────

    const handleSave = async (isAutoSave = false) => {
        if (!form) return
        setSaving(true)
        const res = await updateLeadForm(formId, {
            name: form.name,
            fields: form.isMultiStep ? (form.pages?.flatMap(p => p.fields) || []) : form.fields,
            style: form.style,
            pages: form.pages,
            isMultiStep: form.isMultiStep,
            showReviewPage: form.showReviewPage,
            notifications: form.notifications,
            spamProtection: form.spamProtection,
        })
        if (res.success) {
            if (!isAutoSave) toast.success("Form saved")
            setHasChanges(false)
            setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
        } else if (!isAutoSave) {
            toast.error("Failed to save")
        }
        setSaving(false)
    }

    const handleBack = () => {
        if (hasChanges && !confirm("You have unsaved changes. Leave anyway?")) return
        onBack()
    }

    // ── Render ────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading form builder...</p>
            </div>
        )
    }
    if (!form) {
        return (
            <div className="text-center py-16">
                <p className="text-sm text-muted-foreground">Form not found</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={onBack}>Go Back</Button>
            </div>
        )
    }

    const currentFields = getCurrentFields()
    const selectedField = currentFields.find(f => f.id === selectedFieldId) || null
    const selectedFieldIdx = currentFields.findIndex(f => f.id === selectedFieldId)

    return (
        <div className="flex flex-col h-full -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <Input
                    value={form.name}
                    onChange={e => updateForm({ ...form, name: e.target.value })}
                    className="h-8 text-sm font-semibold max-w-[180px] border-0 bg-transparent focus-visible:bg-muted focus-visible:ring-0 px-2"
                />

                {/* Undo/Redo */}
                <div className="flex items-center border rounded-md">
                    <button onClick={undo} disabled={historyIdx <= 0} className="p-1.5 hover:bg-muted disabled:opacity-30" title="Undo (⌘Z)">
                        <Undo2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={redo} disabled={historyIdx >= history.length - 1} className="p-1.5 hover:bg-muted disabled:opacity-30 border-l" title="Redo (⌘⇧Z)">
                        <Redo2 className="h-3.5 w-3.5" />
                    </button>
                </div>

                <div className="flex items-center gap-1.5 ml-1">
                    <Label className="text-xs text-muted-foreground hidden md:inline">Multi-step</Label>
                    <Switch checked={form.isMultiStep || false} onCheckedChange={toggleMultiStep} />
                </div>

                <div className="flex-1" />

                {/* Save status */}
                {lastSaved && !hasChanges && (
                    <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-500" /> Saved {lastSaved}
                    </span>
                )}
                {hasChanges && (
                    <span className="text-[10px] text-amber-500 hidden sm:inline">Unsaved changes</span>
                )}

                {/* Action buttons — hidden on mobile, shown in dropdown or row */}
                <div className="hidden sm:flex items-center gap-1.5">
                    {/* Device preview toggle */}
                    <div className="flex items-center border rounded-md h-7 p-0.5 mr-1">
                        <button
                            onClick={() => setPreviewDevice("desktop")}
                            className={`flex items-center gap-1 px-1.5 h-6 rounded text-[10px] font-medium transition-colors ${
                                previewDevice === "desktop"
                                    ? "bg-muted text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                            title="Desktop preview"
                        >
                            <Monitor className="h-3 w-3" />
                        </button>
                        <button
                            onClick={() => setPreviewDevice("mobile")}
                            className={`flex items-center gap-1 px-1.5 h-6 rounded text-[10px] font-medium transition-colors ${
                                previewDevice === "mobile"
                                    ? "bg-muted text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                            title="Mobile preview (375px)"
                        >
                            <Smartphone className="h-3 w-3" />
                        </button>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setShowStyleSettings(true)}>
                        <Palette className="h-3 w-3 sm:mr-1" /><span className="hidden lg:inline">Style</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setShowNotifications(true)}>
                        <Bell className="h-3 w-3 sm:mr-1" /><span className="hidden lg:inline">Notify</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setShowAnalytics(true)}>
                        <BarChart3 className="h-3 w-3 sm:mr-1" /><span className="hidden lg:inline">Analytics</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => window.open(`/forms/${formId}`, "_blank")}>
                        <Eye className="h-3 w-3 sm:mr-1" /><span className="hidden lg:inline">Preview</span>
                    </Button>
                </div>
                <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleSave(false)}
                    disabled={saving || !hasChanges}
                    title="Save (⌘S)"
                >
                    {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                    Save
                </Button>
            </div>

            {/* Page tabs (multi-step) */}
            {form.isMultiStep && form.pages && (
                <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/20 shrink-0 overflow-x-auto">
                    {form.pages.map((page, idx) => (
                        <div key={page.id} className="flex items-center gap-0.5 shrink-0">
                            <button
                                onClick={() => { setCurrentPageIdx(idx); setSelectedFieldId(null) }}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                    currentPageIdx === idx ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground border"
                                }`}
                            >
                                <input
                                    value={page.title || `Page ${idx + 1}`}
                                    onChange={e => updatePageTitle(idx, e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    className={`bg-transparent border-0 outline-none text-xs font-medium w-20 text-center ${
                                        currentPageIdx === idx ? "text-primary-foreground" : "text-inherit"
                                    }`}
                                />
                            </button>
                            {form.pages!.length > 1 && (
                                <button onClick={() => deletePage(idx)} className="p-0.5 rounded text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}
                    <button onClick={addPage} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0">
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Three-panel layout (DndContext wraps all three so palette → canvas works) */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left: Field Palette (collapsible) */}
                <div
                    className={`relative border-r overflow-y-auto shrink-0 hidden md:block transition-[width] duration-200 ${
                        paletteCollapsed ? "w-9" : "w-[200px]"
                    }`}
                >
                    {/* Collapse toggle — sits at the top of the panel */}
                    <button
                        type="button"
                        onClick={() => setPaletteCollapsed((v) => !v)}
                        className="absolute top-1.5 right-1.5 z-10 h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                        title={paletteCollapsed ? "Expand fields panel" : "Collapse fields panel"}
                        aria-label={paletteCollapsed ? "Expand fields panel" : "Collapse fields panel"}
                    >
                        {paletteCollapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
                    </button>
                    {paletteCollapsed ? (
                        <div className="pt-9 px-1.5 flex flex-col items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 [writing-mode:vertical-rl]">
                            Fields
                        </div>
                    ) : (
                        <div className="p-2.5 pt-9">
                            <FieldPalette onAdd={addField} />
                        </div>
                    )}
                </div>

                {/* Center: Form Preview with DnD */}
                <div className="flex-1 overflow-y-auto bg-muted/30" onClick={() => setSelectedFieldId(null)}>
                    <div className="p-4 sm:p-6">
                        {/* Mobile: add field + action buttons */}
                        <div className="md:hidden flex gap-2 mb-4">
                            <select onChange={e => { if (e.target.value) addField(e.target.value as FieldType); e.target.value = "" }}
                                className="flex-1 h-9 px-3 text-sm border rounded-lg bg-background" defaultValue="">
                                <option value="" disabled>+ Add Field</option>
                                {Object.entries(FIELD_TYPE_CONFIG).map(([type, config]) => (
                                    <option key={type} value={type}>{config.label}</option>
                                ))}
                            </select>
                            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowStyleSettings(true)}>
                                <Palette className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => window.open(`/forms/${formId}`, "_blank")}>
                                <Eye className="h-4 w-4" />
                            </Button>
                        </div>

                        {form.isMultiStep && (
                            <div className="text-center mb-3">
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                    <Layers className="h-3 w-3 inline mr-1" />
                                    Page {currentPageIdx + 1} of {form.pages?.length || 1}
                                </span>
                            </div>
                        )}

                        {/* WYSIWYG form preview with drag-and-drop. Width tracks
                            the device toggle so users can see mobile layout without
                            opening a separate tab. */}
                        <div
                            className="rounded-xl shadow-sm border overflow-visible mx-auto transition-[max-width] duration-200"
                            style={{
                                backgroundColor: form.style.backgroundColor,
                                maxWidth: previewDevice === "mobile" ? "375px" : "640px",
                            }}
                        >
                            <div style={{
                                fontFamily: form.style.fontFamily,
                                padding: `${form.style.formPadding ?? 40}px 24px`,
                                position: "relative",
                            }}>
                                {/* Background image */}
                                {form.style.backgroundImageUrl && (
                                    <div style={{
                                        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                                        backgroundImage: `url(${form.style.backgroundImageUrl})`,
                                        backgroundSize: "cover", backgroundPosition: "center",
                                        opacity: (form.style.backgroundOverlayOpacity ?? 100) / 100,
                                        borderRadius: "inherit", zIndex: 0,
                                    }} />
                                )}

                                <div style={{ position: "relative", zIndex: 1 }}>
                                    {/* Logo */}
                                    {form.style.logoUrl && (
                                        <div style={{ textAlign: "center", marginBottom: "24px" }}>
                                            <img src={form.style.logoUrl} alt="" style={{ maxHeight: "48px", maxWidth: "200px", objectFit: "contain" }} />
                                        </div>
                                    )}

                                    {/* Header image */}
                                    {form.style.headerImageUrl && (
                                        <div style={{ marginBottom: "24px", borderRadius: "8px", overflow: "hidden" }}>
                                            <img src={form.style.headerImageUrl} alt="" style={{ width: "100%", height: "auto" }} />
                                        </div>
                                    )}

                                    {/* Title */}
                                    {form.style.title && (
                                        <h1 style={{ fontSize: "28px", fontWeight: 700, color: form.style.textColor, textAlign: "center", margin: "0 0 8px 0", fontFamily: form.style.fontFamily }}>
                                            {form.style.title}
                                        </h1>
                                    )}

                                    {/* Description */}
                                    {form.style.description && (
                                        <p style={{ fontSize: "15px", color: `${form.style.textColor}99`, textAlign: "center", margin: "0 0 28px 0", lineHeight: "1.5", fontFamily: form.style.fontFamily }}>
                                            {form.style.description}
                                        </p>
                                    )}

                                    {/* Draggable fields (DndContext is outer — covers palette → canvas + reorder) */}
                                    <SortableContext items={currentFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: `${form.style.fieldSpacing ?? 20}px` }}>
                                            {currentFields.map((field, idx) => (
                                                <div key={field.id}>
                                                    <DropSlot index={idx} isActive={!!activePaletteType} />
                                                    <SortableFieldWrapper
                                                        field={field}
                                                        isSelected={selectedFieldId === field.id}
                                                        onSelect={() => setSelectedFieldId(field.id)}
                                                        onDuplicate={() => duplicateField(field.id)}
                                                        onDelete={() => deleteField(field.id)}
                                                    >
                                                        <div style={{ pointerEvents: "none" }}>
                                                            <FormFieldRenderer
                                                                field={field}
                                                                style={form.style}
                                                                value={field.type === "rating" ? 3 : field.type === "scale" ? 5 : ""}
                                                                onChange={() => {}}
                                                            />
                                                        </div>
                                                    </SortableFieldWrapper>
                                                </div>
                                            ))}
                                            <DropSlot index={currentFields.length} isActive={!!activePaletteType && currentFields.length > 0} />
                                        </div>
                                    </SortableContext>

                                    {currentFields.length === 0 && (
                                        <EmptyCanvasDrop
                                            isPaletteDragging={!!activePaletteType}
                                            textColor={form.style.textColor}
                                            onQuickAdd={addField}
                                        />
                                    )}

                                    {/* Submit button preview */}
                                    {currentFields.length > 0 && (
                                        <div style={{
                                            marginTop: `${form.style.fieldSpacing ?? 20}px`,
                                            textAlign: form.style.buttonAlignment === "center" ? "center" : form.style.buttonAlignment === "right" ? "right" : "left",
                                        }}>
                                            <button type="button" disabled style={{
                                                width: form.style.buttonWidth === "full" ? "100%" : "auto",
                                                padding: "14px 32px",
                                                backgroundColor: form.style.buttonColor,
                                                color: form.style.buttonTextColor,
                                                border: "none",
                                                borderRadius: form.style.borderRadius === "full" ? "9999px" : form.style.borderRadius === "lg" ? "12px" : form.style.borderRadius === "md" ? "8px" : form.style.borderRadius === "sm" ? "4px" : "0",
                                                fontSize: "15px",
                                                fontWeight: 600,
                                                fontFamily: form.style.fontFamily,
                                                cursor: "default",
                                                opacity: 0.9,
                                            }}>
                                                {form.style.buttonText}
                                            </button>
                                        </div>
                                    )}

                                    {/* Powered by */}
                                    <p style={{ textAlign: "center", fontSize: "11px", color: "#9ca3af", marginTop: "32px" }}>
                                        Powered by Vesta CRM
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Properties Editor */}
                <div className={`${showMobileProperties ? "fixed inset-0 z-50 bg-background p-4 overflow-y-auto" : "w-[280px] border-l p-3 overflow-y-auto shrink-0 hidden md:block"}`}>
                    {showMobileProperties && (
                        <div className="flex items-center justify-between mb-3 md:hidden">
                            <span className="text-sm font-semibold">Field Properties</span>
                            <Button variant="ghost" size="sm" onClick={() => setShowMobileProperties(false)}>Done</Button>
                        </div>
                    )}
                    {selectedField ? (
                        <FieldPropertiesEditor
                            field={selectedField}
                            allFields={currentFields}
                            onChange={updateField}
                            onDelete={() => deleteField(selectedField.id)}
                            onDuplicate={() => duplicateField(selectedField.id)}
                            onMoveUp={() => {
                                const fields = getCurrentFields()
                                const idx = fields.findIndex(f => f.id === selectedField.id)
                                if (idx > 0) setCurrentFields(arrayMove(fields, idx, idx - 1))
                            }}
                            onMoveDown={() => {
                                const fields = getCurrentFields()
                                const idx = fields.findIndex(f => f.id === selectedField.id)
                                if (idx < fields.length - 1) setCurrentFields(arrayMove(fields, idx, idx + 1))
                            }}
                            isFirst={selectedFieldIdx === 0}
                            isLast={selectedFieldIdx === currentFields.length - 1}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2">
                            <GripVertical className="h-8 w-8 opacity-20" />
                            <p className="text-sm font-medium">No field selected</p>
                            <p className="text-xs max-w-[200px]">Click a field in the preview to edit its properties, or drag to reorder</p>
                        </div>
                    )}
                </div>
            </div>
            <DragOverlay dropAnimation={null}>
                {activePaletteType ? (
                    <div className="rounded-lg border bg-background shadow-lg px-3 py-2 text-xs font-medium flex items-center gap-2 pointer-events-none">
                        <Plus className="h-3 w-3 text-primary" />
                        Adding {FIELD_TYPE_CONFIG[activePaletteType].label}…
                    </div>
                ) : activeFieldId ? (
                    <div className="rounded-lg border bg-background shadow-lg px-3 py-2 text-xs font-medium pointer-events-none opacity-90">
                        Reordering field…
                    </div>
                ) : null}
            </DragOverlay>
            </DndContext>

            {/* Mobile: floating edit button when field is selected */}
            {selectedField && !showMobileProperties && (
                <div className="md:hidden fixed bottom-6 right-6 z-40">
                    <Button className="rounded-full h-12 w-12 shadow-lg" onClick={() => setShowMobileProperties(true)}>
                        <Palette className="h-5 w-5" />
                    </Button>
                </div>
            )}

            <StyleSettings open={showStyleSettings} onClose={() => setShowStyleSettings(false)} style={form.style}
                onChange={s => updateForm({ ...form, style: s })} isMultiStep={form.isMultiStep} />
            <NotificationSettings open={showNotifications} onClose={() => setShowNotifications(false)}
                notifications={form.notifications}
                onChange={n => updateForm({ ...form, notifications: n })} />
            <FormAnalytics open={showAnalytics} onClose={() => setShowAnalytics(false)} form={form} />
        </div>
    )
}
