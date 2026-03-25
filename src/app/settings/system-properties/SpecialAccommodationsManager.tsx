"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Search, Edit2, Trash2, Home, X, Check } from "lucide-react"
import { getSpecialAccommodations, createSpecialAccommodation, updateSpecialAccommodation, deleteSpecialAccommodation } from "./actions"
import { toast } from "sonner"

interface AccommodationItem {
    id: string;
    name: string;
    order?: number;
}

export function SpecialAccommodationsManager() {
    const [items, setItems] = useState<AccommodationItem[]>([])
    const [search, setSearch] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [newName, setNewName] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

    const fetchItems = async () => {
        setIsLoading(true)
        const res = await getSpecialAccommodations()
        if (res.success) setItems((res.items as AccommodationItem[]).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)))
        setIsLoading(false)
    }

    useEffect(() => { fetchItems() }, [])

    const filteredItems = items.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleAdd = async () => {
        if (!newName.trim()) return
        const res = await createSpecialAccommodation(newName.trim())
        if (res.success) {
            toast.success("Accommodation added")
            setNewName("")
            setIsAdding(false)
            fetchItems()
        } else {
            toast.error(res.error || "Failed to add accommodation")
        }
    }

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return
        const res = await updateSpecialAccommodation(id, editName.trim())
        if (res.success) {
            toast.success("Accommodation updated")
            setEditingId(null)
            setEditName("")
            fetchItems()
        } else {
            toast.error(res.error || "Failed to update accommodation")
        }
    }

    const handleDelete = async (id: string) => {
        const res = await deleteSpecialAccommodation(id)
        setDeleteTarget(null)
        if (res.success) {
            toast.success("Accommodation deleted")
            fetchItems()
        } else {
            toast.error("Failed to delete accommodation")
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-600">
                    <Home className="h-5 w-5" />
                    Special Accommodations
                </CardTitle>
                <CardDescription>
                    Configure accommodation options for opportunities (e.g. Pets, Spouse, Dependents).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search accommodations..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <Button size="sm" onClick={() => { setIsAdding(true); setEditingId(null); }} disabled={isAdding}>
                        <Plus className="h-4 w-4 mr-1" /> Add Option
                    </Button>
                </div>

                {isAdding && (
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-emerald-50/10 border-emerald-200/20">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. Traveling with Pet"
                            className="h-8 flex-1"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        />
                        <Button size="sm" variant="ghost" onClick={handleAdd} disabled={!newName.trim()}>
                            <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewName(""); }}>
                            <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                )}

                <div className="space-y-1">
                    {isLoading ? (
                        <div className="text-center text-sm text-muted-foreground py-8">Loading...</div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-8">No accommodations found</div>
                    ) : filteredItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-3 py-2 border rounded-lg hover:bg-muted/30 transition-colors">
                            {editingId === item.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="h-7 text-sm flex-1"
                                        autoFocus
                                        onKeyDown={(e) => e.key === "Enter" && handleUpdate(item.id)}
                                    />
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdate(item.id)}>
                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <span className="text-sm font-medium">{item.name}</span>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingId(item.id); setEditName(item.name); }}>
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setDeleteTarget(item.id)}>
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
                        <AlertDialogTitle>Remove Accommodation</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove this accommodation option. Opportunities using it will keep the value but it won&apos;t appear in the selector. Continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    )
}
