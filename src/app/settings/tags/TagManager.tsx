"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Search, Edit2, Trash2, Tag as TagIcon, X, Check } from "lucide-react"
import { getTags, createTag, updateTag, deleteTag } from "./actions"
import { toast } from "sonner"

interface Tag {
    id: string;
    name: string;
    color: string;
}

const COLORS = [
    "#3b82f6", // Blue
    "#ef4444", // Red
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#6b7280", // Gray
]

export function TagManager() {
    const [tags, setTags] = useState<Tag[]>([])
    const [search, setSearch] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [editColor, setEditColor] = useState("#3b82f6")
    const [newName, setNewName] = useState("")
    const [newColor, setNewColor] = useState("#3b82f6")
    const [isAdding, setIsAdding] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

    const fetchTags = async () => {
        setIsLoading(true)
        const res = await getTags()
        if (res.success) setTags(res.tags as Tag[])
        setIsLoading(false)
    }

    useEffect(() => { fetchTags() }, [])

    const filteredTags = tags.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleAdd = async () => {
        if (!newName.trim()) return
        const res = await createTag(newName.trim(), newColor)
        if (res.success) {
            toast.success("Tag created")
            setNewName("")
            setNewColor("#3b82f6")
            setIsAdding(false)
            fetchTags()
        } else {
            toast.error(res.error || "Failed to create tag")
        }
    }

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return
        const res = await updateTag(id, editName.trim(), editColor)
        if (res.success) {
            toast.success("Tag updated")
            setEditingId(null)
            setEditName("")
            fetchTags()
        } else {
            toast.error(res.error || "Failed to update tag")
        }
    }

    const handleDelete = async (id: string) => {
        const res = await deleteTag(id)
        setDeleteTarget(null)
        if (res.success) {
            toast.success("Tag deleted")
        } else {
            toast.error("Failed to delete tag")
        }
        fetchTags()
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-600">
                    <TagIcon className="h-5 w-5" />
                    Tags & Labels
                </CardTitle>
                <CardDescription>
                    Create colored labels to categorize and filter your deals and contacts.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search tags..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <Button size="sm" onClick={() => { setIsAdding(true); setEditingId(null); }} disabled={isAdding}>
                        <Plus className="h-4 w-4 mr-1" /> Add Tag
                    </Button>
                </div>

                {isAdding && (
                    <div className="flex flex-col gap-3 p-3 border rounded-lg bg-indigo-50/10 border-indigo-200/20">
                        <div className="flex items-center gap-2">
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Tag name..."
                                className="h-8 flex-1"
                                autoFocus
                                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                            />
                            <div className="flex gap-1">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setNewColor(c)}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform ${newColor === c ? 'scale-110 border-white ring-2 ring-indigo-500' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewName(""); }}>Cancel</Button>
                            <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>Save Tag</Button>
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                    {isLoading ? (
                        <div className="text-center text-sm text-muted-foreground py-8">Loading...</div>
                    ) : filteredTags.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-8">No tags found</div>
                    ) : filteredTags.map((tag) => (
                        <div key={tag.id} className="flex items-center justify-between px-3 py-2 border rounded-lg hover:bg-muted/30 transition-colors">
                            {editingId === tag.id ? (
                                <div className="flex flex-col gap-2 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="h-8 flex-1"
                                            autoFocus
                                        />
                                        <div className="flex gap-1">
                                            {COLORS.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setEditColor(c)}
                                                    className={`w-5 h-5 rounded-full border-2 ${editColor === c ? 'border-indigo-500 scale-110' : 'border-transparent opacity-70'}`}
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-1">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdate(tag.id)}>
                                            <Check className="h-4 w-4 text-indigo-600" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                        <span className="text-sm font-medium">{tag.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color); }}>
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setDeleteTarget(tag.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Tag</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove this tag from all contacts and opportunities. Continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    )
}
