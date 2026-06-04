"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Search, Edit2, Trash2, MapPin, X, Check, CalendarRange } from "lucide-react"
import { getBases, createBase, updateBase, deleteBase, type BasePeriod } from "./actions"
import { toast } from "sonner"

interface Base {
    id: string;
    name: string;
    zipCode: string;
    periods: BasePeriod[];
}

interface DraftState {
    name: string;
    zipCode: string;
    periods: BasePeriod[];
}

const emptyDraft = (): DraftState => ({ name: "", zipCode: "", periods: [] })

export function BasesManager() {
    const [bases, setBases] = useState<Base[]>([])
    const [search, setSearch] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [draft, setDraft] = useState<DraftState>(emptyDraft())
    const [isAdding, setIsAdding] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const fetchBases = async () => {
        setIsLoading(true)
        const res = await getBases()
        if (res.success) setBases(res.bases as Base[])
        setIsLoading(false)
    }

    useEffect(() => { fetchBases() }, [])

    const filteredBases = bases.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.zipCode || "").toLowerCase().includes(search.toLowerCase())
    )

    // ── Draft / period helpers ──
    const addPeriod = () => setDraft(d => ({ ...d, periods: [...d.periods, { startDate: "", endDate: "", rate: 0 }] }))
    const removePeriod = (idx: number) => setDraft(d => ({ ...d, periods: d.periods.filter((_, i) => i !== idx) }))
    const updatePeriod = (idx: number, field: keyof BasePeriod, value: string) => setDraft(d => ({
        ...d,
        periods: d.periods.map((p, i) => i === idx ? { ...p, [field]: field === "rate" ? Number(value) || 0 : value } : p),
    }))

    const startAdd = () => { setIsAdding(true); setEditingId(null); setDraft(emptyDraft()) }
    const startEdit = (base: Base) => {
        setEditingId(base.id)
        setIsAdding(false)
        setDraft({ name: base.name, zipCode: base.zipCode || "", periods: base.periods.map(p => ({ ...p })) })
    }
    const cancelEdit = () => { setEditingId(null); setIsAdding(false); setDraft(emptyDraft()) }

    const handleAdd = async () => {
        if (!draft.name.trim()) return
        setSaving(true)
        const res = await createBase({ name: draft.name.trim(), zipCode: draft.zipCode.trim(), periods: draft.periods })
        setSaving(false)
        if (res.success) {
            toast.success("Base added")
            cancelEdit()
            fetchBases()
        } else {
            toast.error(res.error || "Failed to add base")
        }
    }

    const handleUpdate = async (id: string) => {
        if (!draft.name.trim()) return
        setSaving(true)
        const res = await updateBase(id, { name: draft.name.trim(), zipCode: draft.zipCode.trim(), periods: draft.periods })
        setSaving(false)
        if (res.success) {
            toast.success("Base updated")
            cancelEdit()
            fetchBases()
        } else {
            toast.error(res.error || "Failed to update base")
        }
    }

    const handleDelete = async (id: string) => {
        const res = await deleteBase(id)
        setDeleteTarget(null)
        if (res.success) {
            toast.success("Base deleted")
            fetchBases()
        } else {
            toast.error(res.error || "Failed to delete base")
        }
    }

    // ── Shared period editor ──
    const periodEditor = () => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <CalendarRange className="h-3.5 w-3.5" /> Seasonal lodging rates
                </Label>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={addPeriod}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add period
                </Button>
            </div>
            {draft.periods.length === 0 ? (
                <p className="text-xs text-muted-foreground">No seasonal periods. Add one to set a date-range lodging rate.</p>
            ) : (
                <div className="space-y-2">
                    {draft.periods.map((p, idx) => (
                        <div key={idx} className="flex flex-wrap items-end gap-2">
                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Start</Label>
                                <Input type="date" value={p.startDate} onChange={(e) => updatePeriod(idx, "startDate", e.target.value)} className="h-8 w-[150px]" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">End</Label>
                                <Input type="date" value={p.endDate} onChange={(e) => updatePeriod(idx, "endDate", e.target.value)} className="h-8 w-[150px]" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Rate ($)</Label>
                                <Input type="number" min={0} step="0.01" value={p.rate || ""} onChange={(e) => updatePeriod(idx, "rate", e.target.value)} placeholder="0" className="h-8 w-[110px]" />
                            </div>
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => removePeriod(idx)}>
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )

    const baseFormFields = () => (
        <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Base name</Label>
                <Input value={draft.name} onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Luke AFB, AZ" className="h-8" autoFocus />
            </div>
            <div className="flex flex-col gap-1 w-[140px]">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Zip code</Label>
                <Input value={draft.zipCode} onChange={(e) => setDraft(d => ({ ...d, zipCode: e.target.value }))} placeholder="e.g. 85309" className="h-8" />
            </div>
        </div>
    )

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search bases…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
                <Button size="sm" onClick={startAdd} disabled={isAdding}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add base
                </Button>
            </div>

            {isAdding && (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
                    {baseFormFields()}
                    {periodEditor()}
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" onClick={handleAdd} disabled={!draft.name.trim() || saving}>
                            <Check className="h-4 w-4 mr-1" /> Save base
                        </Button>
                    </div>
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                {bases.length} bases {search && `• ${filteredBases.length} matching`}
            </p>

            <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {isLoading ? (
                    <div className="text-center text-sm text-muted-foreground py-8">Loading…</div>
                ) : filteredBases.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">No bases found</div>
                ) : filteredBases.map((base) => (
                    <div key={base.id} className="border rounded-lg hover:bg-muted/30 transition-colors">
                        {editingId === base.id ? (
                            <div className="space-y-3 p-3">
                                {baseFormFields()}
                                {periodEditor()}
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                        <X className="h-4 w-4 mr-1" /> Cancel
                                    </Button>
                                    <Button size="sm" onClick={() => handleUpdate(base.id)} disabled={!draft.name.trim() || saving}>
                                        <Check className="h-4 w-4 mr-1" /> Save
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between px-3 py-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="text-sm font-medium truncate">{base.name}</span>
                                    {base.zipCode && <span className="text-xs text-muted-foreground">· {base.zipCode}</span>}
                                    {base.periods.length > 0 && (
                                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                                            <CalendarRange className="h-3 w-3" /> {base.periods.length} {base.periods.length === 1 ? "period" : "periods"}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(base)}>
                                        <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setDeleteTarget(base.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove base</AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the base and all of its seasonal lodging periods. Deals already referencing this base name keep their value. Continue?
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
        </div>
    )
}
