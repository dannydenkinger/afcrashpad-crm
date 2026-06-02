"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Edit2, Trash2, X, Check, FileCheck2, GripVertical } from "lucide-react"
import { toast } from "sonner"
import {
    DndContext, KeyboardSensor, PointerSensor, closestCenter,
    useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext, arrayMove, sortableKeyboardCoordinates,
    useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
    getRequiredDocs, createRequiredDoc, updateRequiredDoc, deleteRequiredDoc, reorderRequiredDocs,
    type RequiredDoc,
} from "./actions"
import { EmptyState } from "@/components/ui/EmptyState"

export function RequiredDocsManager() {
    const [docs, setDocs] = useState<RequiredDoc[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editLabel, setEditLabel] = useState("")
    const [newLabel, setNewLabel] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<RequiredDoc | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    async function fetchDocs() {
        setLoading(true)
        const list = await getRequiredDocs()
        setDocs(list)
        setLoading(false)
    }

    useEffect(() => { fetchDocs() }, [])

    async function handleAdd() {
        const label = newLabel.trim()
        if (!label) return
        const res = await createRequiredDoc(label)
        if (res.success) {
            toast.success("Added")
            setNewLabel("")
            setIsAdding(false)
            fetchDocs()
        } else {
            toast.error(res.error || "Failed to add")
        }
    }

    async function handleUpdate(id: string) {
        const label = editLabel.trim()
        if (!label) return
        const res = await updateRequiredDoc(id, label)
        if (res.success) {
            toast.success("Updated")
            setEditingId(null)
            setEditLabel("")
            fetchDocs()
        } else {
            toast.error(res.error || "Failed to update")
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return
        const res = await deleteRequiredDoc(deleteTarget.id)
        setDeleteTarget(null)
        if (res.success) {
            toast.success("Removed")
        } else {
            toast.error(res.error || "Failed to remove")
        }
        fetchDocs()
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = docs.findIndex((d) => d.id === active.id)
        const newIndex = docs.findIndex((d) => d.id === over.id)
        if (oldIndex < 0 || newIndex < 0) return
        const next = arrayMove(docs, oldIndex, newIndex)
        setDocs(next)
        const res = await reorderRequiredDocs(next.map((d) => d.id))
        if (!res.success) {
            toast.error("Failed to save order")
            fetchDocs()
        }
    }

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
                These checkboxes appear on every opportunity&apos;s <strong>Docs</strong> tab.
                Use them to track contracts, signed forms, or any paperwork that has to be
                completed for a deal. Reorder by dragging the handle. Remove all items to hide
                the checklist entirely.
            </p>

            {/* Add new */}
            {isAdding ? (
                <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-primary/5 border-primary/20">
                    <Input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="e.g. Statement of Work, NDA, W-9"
                        className="h-8 flex-1 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleAdd()
                            if (e.key === "Escape") { setIsAdding(false); setNewLabel("") }
                        }}
                    />
                    <Button size="sm" onClick={handleAdd} disabled={!newLabel.trim()} className="h-8 text-xs">
                        Add
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setIsAdding(false); setNewLabel("") }} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ) : (
                <Button size="sm" variant="outline" onClick={() => setIsAdding(true)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Add document type
                </Button>
            )}

            {/* List */}
            {loading ? (
                <div className="text-center text-xs text-muted-foreground py-6">Loading…</div>
            ) : docs.length === 0 ? (
                <EmptyState
                    Icon={FileCheck2}
                    accent="primary"
                    title="No required documents configured"
                    description="The checklist on opportunities is hidden until you add at least one item."
                    compact
                />
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={docs.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-1">
                            {docs.map((doc) => (
                                <SortableRow
                                    key={doc.id}
                                    doc={doc}
                                    editing={editingId === doc.id}
                                    editLabel={editLabel}
                                    onEditStart={() => { setEditingId(doc.id); setEditLabel(doc.label) }}
                                    onEditChange={setEditLabel}
                                    onEditSave={() => handleUpdate(doc.id)}
                                    onEditCancel={() => { setEditingId(null); setEditLabel("") }}
                                    onDelete={() => setDeleteTarget(doc)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Remove &ldquo;{deleteTarget?.label}&rdquo;?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This won&apos;t delete any uploaded files. Opportunities that already had
                            this item checked off will stop showing it. You can re-add it later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

function SortableRow({
    doc, editing, editLabel, onEditStart, onEditChange, onEditSave, onEditCancel, onDelete,
}: {
    doc: RequiredDoc
    editing: boolean
    editLabel: string
    onEditStart: () => void
    onEditChange: (v: string) => void
    onEditSave: () => void
    onEditCancel: () => void
    onDelete: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: doc.id })
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    }
    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-1.5 px-2 py-1.5 border rounded-lg bg-card hover:bg-muted/30 transition-colors group"
        >
            <button
                {...attributes}
                {...listeners}
                className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing p-1"
                aria-label="Drag to reorder"
                title="Drag to reorder"
            >
                <GripVertical className="h-3.5 w-3.5" />
            </button>
            <FileCheck2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

            {editing ? (
                <div className="flex items-center gap-1.5 flex-1">
                    <Input
                        value={editLabel}
                        onChange={(e) => onEditChange(e.target.value)}
                        className="h-7 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onEditSave()
                            if (e.key === "Escape") onEditCancel()
                        }}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEditSave}>
                        <Check className="h-3.5 w-3.5 text-primary" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEditCancel}>
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ) : (
                <>
                    <span className="text-sm font-medium flex-1 truncate">{doc.label}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={onEditStart}
                            title="Rename"
                        >
                            <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={onDelete}
                            title="Remove"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
