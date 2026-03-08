"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Search, Edit2, Trash2, Megaphone, X, Check } from "lucide-react"
import { getLeadSources, createLeadSource, updateLeadSource, deleteLeadSource } from "./actions"

interface LeadSource {
    id: string;
    name: string;
}

export function LeadSourceManager() {
    const [sources, setSources] = useState<LeadSource[]>([])
    const [search, setSearch] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [newName, setNewName] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

    const fetchSources = async () => {
        setIsLoading(true)
        const res = await getLeadSources()
        if (res.success) setSources(res.sources as LeadSource[])
        setIsLoading(false)
    }

    useEffect(() => { fetchSources() }, [])

    const filteredSources = sources.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleAdd = async () => {
        if (!newName.trim()) return
        const res = await createLeadSource(newName.trim())
        if (res.success) {
            setNewName("")
            setIsAdding(false)
            fetchSources()
        } else {
            alert(res.error)
        }
    }

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return
        const res = await updateLeadSource(id, editName.trim())
        if (res.success) {
            setEditingId(null)
            setEditName("")
            fetchSources()
        } else {
            alert(res.error)
        }
    }

    const handleDelete = async (id: string) => {
        await deleteLeadSource(id)
        setDeleteTarget(null)
        fetchSources()
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                    <Megaphone className="h-5 w-5" />
                    Lead Sources
                </CardTitle>
                <CardDescription>
                    Manage the referral channels and marketing sources for your deals.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search sources..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <Button size="sm" onClick={() => { setIsAdding(true); setEditingId(null); }} disabled={isAdding}>
                        <Plus className="h-4 w-4 mr-1" /> Add Source
                    </Button>
                </div>

                {isAdding && (
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-blue-50/10 border-blue-200/20">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. Word of Mouth"
                            className="h-8 flex-1"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        />
                        <Button size="sm" variant="ghost" onClick={handleAdd} disabled={!newName.trim()}>
                            <Check className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewName(""); }}>
                            <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                )}

                <div className="space-y-1">
                    {isLoading ? (
                        <div className="text-center text-sm text-muted-foreground py-8">Loading...</div>
                    ) : filteredSources.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-8">No lead sources found</div>
                    ) : filteredSources.map((source) => (
                        <div key={source.id} className="flex items-center justify-between px-3 py-2 border rounded-lg hover:bg-muted/30 transition-colors">
                            {editingId === source.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="h-7 text-sm flex-1"
                                        autoFocus
                                        onKeyDown={(e) => e.key === "Enter" && handleUpdate(source.id)}
                                    />
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdate(source.id)}>
                                        <Check className="h-3.5 w-3.5 text-blue-600" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <span className="text-sm font-medium">{source.name}</span>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingId(source.id); setEditName(source.name); }}>
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setDeleteTarget(source.id)}>
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
                        <AlertDialogTitle>Remove Lead Source</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove this lead source. Opportunities using it will remain but without a linked source. Continue?
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
