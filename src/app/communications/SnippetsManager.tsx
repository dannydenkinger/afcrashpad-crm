"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Zap, Plus, Pencil, Trash2, X, Check, Settings } from "lucide-react"
import { getSnippets, createSnippet, updateSnippet, deleteSnippet } from "./actions"
import { toast } from "sonner"

interface Snippet {
    id: string
    title: string
    content: string
    createdAt: string
}

interface SnippetsManagerProps {
    onInsert: (content: string) => void
    onClose: () => void
}

export default function SnippetsManager({ onInsert, onClose }: SnippetsManagerProps) {
    const [snippets, setSnippets] = useState<Snippet[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showManage, setShowManage] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState("")
    const [editContent, setEditContent] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [newTitle, setNewTitle] = useState("")
    const [newContent, setNewContent] = useState("")

    const fetchSnippets = async () => {
        setIsLoading(true)
        const res = await getSnippets()
        if (res.success) setSnippets(res.snippets as Snippet[])
        setIsLoading(false)
    }

    useEffect(() => { fetchSnippets() }, [])

    const handleCreate = async () => {
        if (!newTitle.trim() || !newContent.trim()) return
        const res = await createSnippet(newTitle.trim(), newContent.trim())
        if (res.success) {
            toast.success("Snippet created")
            setNewTitle("")
            setNewContent("")
            setIsCreating(false)
            fetchSnippets()
        } else {
            toast.error("Failed to create snippet")
        }
    }

    const handleUpdate = async (id: string) => {
        if (!editTitle.trim() || !editContent.trim()) return
        const res = await updateSnippet(id, editTitle.trim(), editContent.trim())
        if (res.success) {
            toast.success("Snippet updated")
            setEditingId(null)
            fetchSnippets()
        } else {
            toast.error("Failed to update snippet")
        }
    }

    const handleDelete = async (id: string) => {
        const res = await deleteSnippet(id)
        if (res.success) {
            toast.success("Snippet deleted")
            fetchSnippets()
        } else {
            toast.error("Failed to delete snippet")
        }
    }

    const startEditing = (snippet: Snippet) => {
        setEditingId(snippet.id)
        setEditTitle(snippet.title)
        setEditContent(snippet.content)
    }

    return (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border rounded-xl shadow-lg z-50 max-h-80 flex flex-col">
            <div className="flex items-center justify-between p-3 border-b shrink-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Zap className="h-4 w-4 text-amber-500" />
                    {showManage ? "Manage Snippets" : "Quick Snippets"}
                </div>
                <div className="flex items-center gap-1">
                    {!showManage && (
                        <button
                            onClick={() => setShowManage(true)}
                            className="text-muted-foreground hover:text-foreground p-1"
                            title="Manage Snippets"
                        >
                            <Settings className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {showManage && (
                        <button
                            onClick={() => { setShowManage(false); setIsCreating(false); setEditingId(null) }}
                            className="text-xs text-muted-foreground hover:text-foreground mr-1"
                        >
                            Back
                        </button>
                    )}
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">Loading...</div>
                ) : snippets.length === 0 && !isCreating ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Zap className="h-8 w-8 text-muted-foreground/20 mb-2" />
                        <p className="text-xs text-muted-foreground mb-2">No snippets yet</p>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowManage(true); setIsCreating(true) }}>
                            <Plus className="h-3 w-3 mr-1" /> Create one
                        </Button>
                    </div>
                ) : showManage ? (
                    <div className="space-y-2">
                        {/* Create new snippet */}
                        {isCreating ? (
                            <div className="border rounded-lg p-2 space-y-2 bg-muted/20">
                                <Input
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="Snippet title..."
                                    className="h-7 text-xs"
                                    autoFocus
                                />
                                <textarea
                                    value={newContent}
                                    onChange={(e) => setNewContent(e.target.value)}
                                    placeholder="Snippet content..."
                                    rows={3}
                                    className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                <div className="flex items-center gap-1 justify-end">
                                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setIsCreating(false); setNewTitle(""); setNewContent("") }}>
                                        Cancel
                                    </Button>
                                    <Button size="sm" className="h-6 text-xs px-2" onClick={handleCreate} disabled={!newTitle.trim() || !newContent.trim()}>
                                        <Check className="h-3 w-3 mr-1" /> Save
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => setIsCreating(true)}>
                                <Plus className="h-3 w-3 mr-1" /> New Snippet
                            </Button>
                        )}

                        {snippets.map(snippet => (
                            <div key={snippet.id} className="border rounded-lg p-2 space-y-1.5">
                                {editingId === snippet.id ? (
                                    <>
                                        <Input
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            className="h-7 text-xs"
                                        />
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            rows={3}
                                            className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        />
                                        <div className="flex items-center gap-1 justify-end">
                                            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingId(null)}>
                                                Cancel
                                            </Button>
                                            <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleUpdate(snippet.id)}>
                                                <Check className="h-3 w-3 mr-1" /> Save
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold">{snippet.title}</span>
                                            <div className="flex items-center gap-0.5">
                                                <button onClick={() => startEditing(snippet)} className="p-1 text-muted-foreground hover:text-foreground">
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                                <button onClick={() => handleDelete(snippet.id)} className="p-1 text-muted-foreground hover:text-destructive">
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground line-clamp-2">{snippet.content}</p>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Quick insert mode */
                    <div className="space-y-0.5">
                        {snippets.map(snippet => (
                            <button
                                key={snippet.id}
                                onClick={() => { onInsert(snippet.content); onClose() }}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold group-hover:text-primary transition-colors">{snippet.title}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{snippet.content}</p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
