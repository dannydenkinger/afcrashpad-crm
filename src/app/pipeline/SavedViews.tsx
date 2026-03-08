"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bookmark, ChevronDown, Save, Pencil, Trash2, Check, X, Loader2, Cloud } from "lucide-react"
import { getSavedViews, createSavedView, deleteSavedView, updateSavedViewName } from "@/app/saved-views/actions"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export interface PipelineViewState {
    activePipelineKey: string
    viewMode: "kanban" | "list"
    showBase: boolean
    showValue: boolean
    showPriority: boolean
    showDates: boolean
    showEndDate: boolean
    showLengthOfStay: boolean
    showQuickActions: boolean
    sortConfig: { key: string; direction: "asc" | "desc" } | null
}

interface SavedView {
    id: string
    name: string
    filters: PipelineViewState
}

const STORAGE_KEY = "pipeline-saved-views"

function loadViews(): SavedView[] {
    if (typeof window === "undefined") return []
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function persistViews(views: SavedView[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
}

interface SavedViewsProps {
    currentState: PipelineViewState
    onApplyView: (state: PipelineViewState) => void
}

export function SavedViews({ currentState, onApplyView }: SavedViewsProps) {
    const [views, setViews] = useState<SavedView[]>([])
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
    const [newViewName, setNewViewName] = useState("")
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        // Load from localStorage first for instant display
        setViews(loadViews())
        // Then sync from Firestore
        getSavedViews("pipeline").then((res) => {
            if (res.success && res.views && res.views.length > 0) {
                const firestoreViews: SavedView[] = res.views.map((v: any) => ({
                    id: v.id,
                    name: v.name,
                    filters: typeof v.filters === "string" ? JSON.parse(v.filters) : v.filters,
                }))
                setViews(firestoreViews)
                persistViews(firestoreViews)
            }
        }).catch(() => {})
    }, [])

    const saveCurrentView = useCallback(async () => {
        const name = newViewName.trim()
        if (!name) return
        setIsSaving(true)

        try {
            const res = await createSavedView({
                page: "pipeline",
                name,
                filters: currentState as unknown as Record<string, unknown>,
            })
            if (res.success && res.id) {
                const newView: SavedView = {
                    id: res.id,
                    name,
                    filters: { ...currentState },
                }
                const updated = [...views, newView]
                setViews(updated)
                persistViews(updated)
                toast.success("View saved")
            } else {
                // Fallback to localStorage only
                const newView: SavedView = {
                    id: crypto.randomUUID(),
                    name,
                    filters: { ...currentState },
                }
                const updated = [...views, newView]
                setViews(updated)
                persistViews(updated)
            }
        } catch {
            // Fallback to localStorage
            const newView: SavedView = {
                id: crypto.randomUUID(),
                name,
                filters: { ...currentState },
            }
            const updated = [...views, newView]
            setViews(updated)
            persistViews(updated)
        }

        setNewViewName("")
        setIsSaveDialogOpen(false)
        setIsSaving(false)
    }, [newViewName, currentState, views])

    const handleDeleteView = async (id: string) => {
        const updated = views.filter((v) => v.id !== id)
        setViews(updated)
        persistViews(updated)
        deleteSavedView(id).catch(() => {})
    }

    const startRename = (view: SavedView) => {
        setRenamingId(view.id)
        setRenameValue(view.name)
    }

    const confirmRename = async () => {
        if (!renamingId || !renameValue.trim()) return
        const updated = views.map((v) =>
            v.id === renamingId ? { ...v, name: renameValue.trim() } : v
        )
        setViews(updated)
        persistViews(updated)
        updateSavedViewName(renamingId, renameValue.trim()).catch(() => {})
        setRenamingId(null)
        setRenameValue("")
    }

    const cancelRename = () => {
        setRenamingId(null)
        setRenameValue("")
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="touch-manipulation min-h-[44px] sm:min-h-0 shrink-0">
                        <Bookmark className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Saved Views</span>
                        <span className="sm:hidden">Views</span>
                        {views.length > 0 && (
                            <span className="ml-1.5 text-xs text-muted-foreground">({views.length})</span>
                        )}
                        <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-70" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">
                        Saved Views
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {views.length === 0 && (
                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                            No saved views yet
                        </div>
                    )}

                    {views.map((view) => (
                        <div key={view.id} className="flex items-center group">
                            {renamingId === view.id ? (
                                <div className="flex items-center gap-1 w-full px-2 py-1">
                                    <Input
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") confirmRename()
                                            if (e.key === "Escape") cancelRename()
                                        }}
                                        className="h-7 text-sm flex-1"
                                        autoFocus
                                    />
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={confirmRename}>
                                        <Check className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={cancelRename}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <DropdownMenuItem
                                    className="cursor-pointer flex-1 pr-1"
                                    onClick={() => onApplyView(view.filters)}
                                >
                                    <Bookmark className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="truncate flex-1">{view.name}</span>
                                </DropdownMenuItem>
                            )}
                            {renamingId !== view.id && (
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            startRename(view)
                                        }}
                                    >
                                        <Pencil className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteView(view.id)
                                        }}
                                    >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setIsSaveDialogOpen(true)}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        Save Current View
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Save Current View</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                                View Name
                            </label>
                            <Input
                                placeholder="e.g. High Priority Kanban"
                                value={newViewName}
                                onChange={(e) => setNewViewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") saveCurrentView()
                                }}
                                autoFocus
                            />
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p>This will save your current:</p>
                            <ul className="list-disc list-inside pl-1 space-y-0.5">
                                <li>Selected pipeline</li>
                                <li>View mode (kanban/list)</li>
                                <li>Visible card fields</li>
                                <li>Sort configuration</li>
                            </ul>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsSaveDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={saveCurrentView} disabled={!newViewName.trim() || isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save View
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
