"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Search, Edit2, Trash2, UserCircle, X, Check } from "lucide-react"
import { getContactStatuses, createContactStatus, updateContactStatus, deleteContactStatus } from "./actions"

interface StatusItem {
    id: string;
    name: string;
    order?: number;
}

export function StatusManager() {
    const [items, setItems] = useState<StatusItem[]>([])
    const [search, setSearch] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [newName, setNewName] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

    const fetchItems = async () => {
        setIsLoading(true)
        const res = await getContactStatuses()
        if (res.success) setItems((res.items as StatusItem[]).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)))
        setIsLoading(false)
    }

    useEffect(() => { fetchItems() }, [])

    const filteredItems = items.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleAdd = async () => {
        if (!newName.trim()) return
        const res = await createContactStatus(newName.trim())
        if (res.success) {
            setNewName("")
            setIsAdding(false)
            fetchItems()
        } else {
            alert(res.error)
        }
    }

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return
        const res = await updateContactStatus(id, editName.trim())
        if (res.success) {
            setEditingId(null)
            setEditName("")
            fetchItems()
        } else {
            alert(res.error)
        }
    }

    const handleDelete = async (id: string) => {
        const res = await deleteContactStatus(id)
        setDeleteTarget(null)
        if (res.success) fetchItems()
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                    <UserCircle className="h-5 w-5" />
                    Contact Statuses
                </CardTitle>
                <CardDescription>
                    Configure status options for contacts (e.g. Lead, Active, Vendor, Host, Currently Staying).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search statuses..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <Button size="sm" onClick={() => { setIsAdding(true); setEditingId(null); }} disabled={isAdding}>
                        <Plus className="h-4 w-4 mr-1" /> Add Status
                    </Button>
                </div>

                {isAdding && (
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-amber-50/10 border-amber-200/20">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. Currently Staying"
                            className="h-8 flex-1"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        />
                        <Button size="sm" variant="ghost" onClick={handleAdd} disabled={!newName.trim()}>
                            <Check className="h-4 w-4 text-amber-600" />
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
                        <div className="text-center text-sm text-muted-foreground py-8">No statuses found</div>
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
                                        <Check className="h-3.5 w-3.5 text-amber-600" />
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
                        <AlertDialogTitle>Remove Status</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove this status. Contacts using it may show an empty status. Continue?
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
