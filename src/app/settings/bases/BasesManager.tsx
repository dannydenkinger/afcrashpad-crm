"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Search, Edit2, Trash2, MapPin, X, Check } from "lucide-react"
import { getBases, createBase, updateBase, deleteBase } from "./actions"

interface Base {
    id: string;
    name: string;
}

export function BasesManager() {
    const [bases, setBases] = useState<Base[]>([])
    const [search, setSearch] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [newName, setNewName] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

    const fetchBases = async () => {
        setIsLoading(true)
        const res = await getBases()
        if (res.success) setBases((res.bases || []).map((b: any) => ({ id: b.id, name: b.name })))
        setIsLoading(false)
    }

    useEffect(() => { fetchBases() }, [])

    const filteredBases = bases.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleAdd = async () => {
        if (!newName.trim()) return
        await createBase({ name: newName.trim(), zipCode: "", periods: [] })
        setNewName("")
        setIsAdding(false)
        fetchBases()
    }

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return
        await updateBase(id, { name: editName.trim(), zipCode: "", periods: [] })
        setEditingId(null)
        setEditName("")
        fetchBases()
    }

    const handleDelete = async (id: string) => {
        await deleteBase(id)
        setDeleteTarget(null)
        fetchBases()
    }

    const startEdit = (base: Base) => {
        setEditingId(base.id)
        setEditName(base.name)
        setIsAdding(false)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Military Bases
                </CardTitle>
                <CardDescription>
                    Manage the base names available in dropdowns across the app.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Search + Add */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search bases..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <Button size="sm" onClick={() => { setIsAdding(true); setEditingId(null); }} disabled={isAdding}>
                        <Plus className="h-4 w-4 mr-1" /> Add Base
                    </Button>
                </div>

                {/* Inline Add */}
                {isAdding && (
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/20">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. Luke AFB, AZ"
                            className="h-8 flex-1"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        />
                        <Button size="sm" variant="ghost" onClick={handleAdd} disabled={!newName.trim()}>
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewName(""); }}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {/* Stats */}
                <p className="text-xs text-muted-foreground">
                    {bases.length} bases {search && `• ${filteredBases.length} matching`}
                </p>

                {/* Base List */}
                <div className="space-y-1 max-h-[500px] overflow-y-auto">
                    {isLoading ? (
                        <div className="text-center text-sm text-muted-foreground py-8">Loading...</div>
                    ) : filteredBases.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-8">No bases found</div>
                    ) : filteredBases.map((base) => (
                        <div key={base.id} className="flex items-center justify-between px-3 py-2 border rounded-lg hover:bg-muted/30 transition-colors">
                            {editingId === base.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="h-7 text-sm flex-1"
                                        autoFocus
                                        onKeyDown={(e) => e.key === "Enter" && handleUpdate(base.id)}
                                    />
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdate(base.id)}>
                                        <Check className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <span className="text-sm font-medium">{base.name}</span>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(base)}>
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setDeleteTarget(base.id)}>
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
                        <AlertDialogTitle>Remove Base</AlertDialogTitle>
                        <AlertDialogDescription>
                            Remove this base from the list?
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
