"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileDropZone } from "@/components/ui/FileDropZone"
import {
    FileText,
    Plus,
    Trash2,
    Link as LinkIcon,
    ExternalLink,
    Eye,
    Loader2,
    Calendar,
    CheckCircle2,
    Clock,
    Upload,
    FilePen,
    FolderPlus,
    FolderOpen,
    MoveRight,
    LayoutTemplate,
    MoreVertical,
} from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { getContactDocuments, addDocument, deleteDocument, updateDocumentStatus, moveToFolder, createFolder } from "./actions"
import { DocumentPreview } from "./DocumentPreview"
import { DocumentTemplateDialog } from "./DocumentTemplateDialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface Document {
    id: string
    name: string
    url: string
    status: string
    createdAt: string
    folder?: string
    generatedContent?: string
    signatureUrl?: string
}

export function DocumentManager({ contactId }: { contactId: string }) {
    const [documents, setDocuments] = useState<Document[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [newName, setNewName] = useState("")
    const [newUrl, setNewUrl] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

    // Folder state
    const [folders, setFolders] = useState<string[]>(["General"])
    const [activeFolder, setActiveFolder] = useState<string>("All")
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState("")

    // Template dialog state
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false)

    const fetchDocs = useCallback(async () => {
        setIsLoading(true)
        const res = await getContactDocuments(contactId)
        if (res.success) {
            const docs = res.documents as unknown as Document[]
            setDocuments(docs)

            // Derive folders from documents
            const folderSet = new Set<string>(["General"])
            docs.forEach(d => { if (d.folder) folderSet.add(d.folder) })
            setFolders(Array.from(folderSet).sort())
        }
        setIsLoading(false)
    }, [contactId])

    useEffect(() => {
        if (contactId) fetchDocs()
    }, [contactId, fetchDocs])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName.trim() || !newUrl.trim()) return

        setIsSaving(true)
        const folder = activeFolder !== "All" ? activeFolder : "General"
        const res = await addDocument(contactId, newName.trim(), newUrl.trim(), "LINK", folder)
        if (res.success) {
            setNewName("")
            setNewUrl("")
            setIsAdding(false)
            fetchDocs()
        } else {
            alert(res.error)
        }
        setIsSaving(false)
    }

    const handleDelete = async (id: string) => {
        const res = await deleteDocument(contactId, id)
        setDeleteTarget(null)
        if (res.success) fetchDocs()
    }

    const handleFilesSelected = async (files: File[]) => {
        setIsUploading(true)
        setUploadError(null)
        for (const file of files) {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("name", file.name)
            try {
                const res = await fetch(`/api/contacts/${contactId}/documents/upload`, {
                    method: "POST",
                    body: formData,
                })
                const data = await res.json()
                if (!res.ok) {
                    setUploadError(data.error || `Upload failed for ${file.name}`)
                    break
                }
            } catch {
                setUploadError(`Upload failed for ${file.name}`)
                break
            }
        }
        fetchDocs()
        setIsUploading(false)
    }

    const toggleStatus = async (doc: Document) => {
        const nextStatus = doc.status === "DRAFT" ? "LINK" : doc.status === "LINK" ? "PENDING" : doc.status === "PENDING" ? "SIGNED" : "DRAFT"
        const res = await updateDocumentStatus(contactId, doc.id, nextStatus)
        if (res.success) fetchDocs()
    }

    const handleMoveToFolder = async (docId: string, folderName: string) => {
        const res = await moveToFolder(contactId, docId, folderName)
        if (res.success) fetchDocs()
    }

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return
        const trimmed = newFolderName.trim()
        await createFolder(contactId, trimmed)
        setFolders(prev => {
            const newSet = new Set(prev)
            newSet.add(trimmed)
            return Array.from(newSet).sort()
        })
        setNewFolderName("")
        setIsCreatingFolder(false)
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "SIGNED": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            case "PENDING": return <Clock className="h-4 w-4 text-amber-500" />
            case "DRAFT": return <FilePen className="h-4 w-4 text-gray-500" />
            default: return <LinkIcon className="h-4 w-4 text-blue-500" />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "SIGNED": return "Signed"
            case "PENDING": return "Pending Signature"
            case "DRAFT": return "Draft"
            default: return "Uploaded"
        }
    }

    // Filter documents by active folder
    const filteredDocuments = activeFolder === "All"
        ? documents
        : documents.filter(d => (d.folder || "General") === activeFolder)

    // Folder counts
    const folderCounts: Record<string, number> = { All: documents.length }
    documents.forEach(d => {
        const f = d.folder || "General"
        folderCounts[f] = (folderCounts[f] || 0) + 1
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Documents</h3>
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50/50 sm:w-auto sm:px-2"
                        onClick={() => setTemplateDialogOpen(true)}
                        title="Templates"
                    >
                        <LayoutTemplate className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline text-xs">Templates</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 sm:w-auto sm:px-2"
                        onClick={() => { setIsAdding(!isAdding); setUploadError(null) }}
                        title="Add link"
                    >
                        {isAdding ? <span className="text-xs">Cancel</span> : <><Plus className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline text-xs">Add link</span></>}
                    </Button>
                </div>
            </div>

            {/* Folder tabs */}
            <div className="flex items-center gap-1 flex-wrap">
                <button
                    onClick={() => setActiveFolder("All")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        activeFolder === "All"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                    }`}
                >
                    All ({folderCounts.All || 0})
                </button>
                {folders.map(folder => (
                    <button
                        key={folder}
                        onClick={() => setActiveFolder(folder)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
                            activeFolder === folder
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                        }`}
                    >
                        <FolderOpen className="h-3 w-3" />
                        {folder} ({folderCounts[folder] || 0})
                    </button>
                ))}
                {isCreatingFolder ? (
                    <div className="flex items-center gap-1">
                        <Input
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            placeholder="Folder name"
                            className="h-7 text-xs w-28"
                            autoFocus
                            onKeyDown={e => {
                                if (e.key === "Enter") handleCreateFolder()
                                if (e.key === "Escape") { setIsCreatingFolder(false); setNewFolderName("") }
                            }}
                        />
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={handleCreateFolder}>
                            Add
                        </Button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsCreatingFolder(true)}
                        className="px-2 py-1 rounded-md text-[11px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/40 transition-colors"
                    >
                        <FolderPlus className="h-3 w-3" />
                    </button>
                )}
            </div>

            <FileDropZone
                onFilesSelected={handleFilesSelected}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
                multiple
                maxSizeMB={25}
                disabled={isUploading}
                compact
            >
                <div className="flex items-center gap-3">
                    {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                        <Upload className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="text-left">
                        <p className="text-xs font-medium">
                            {isUploading ? "Uploading..." : "Drag & drop files here or click to browse"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            PDF, DOC, XLS, TXT, CSV, images &middot; Max 25MB
                        </p>
                    </div>
                </div>
            </FileDropZone>

            {uploadError && (
                <p className="text-sm text-destructive">{uploadError}</p>
            )}

            {isAdding && (
                <form onSubmit={handleAdd} className="p-4 rounded-xl border border-blue-200/20 bg-blue-50/5 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                        <Input
                            placeholder="Document Name (e.g. Orders, Flight Itinerary)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="h-9 text-sm"
                            required
                        />
                        <Input
                            placeholder="URL (Google Drive, Dropbox, etc.)"
                            value={newUrl}
                            onChange={e => setNewUrl(e.target.value)}
                            className="h-9 text-sm"
                            type="url"
                            required
                        />
                    </div>
                    <div className="flex justify-end pt-1">
                        <Button size="sm" type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                            Save Link
                        </Button>
                    </div>
                </form>
            )}

            <div className="space-y-2">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
                    </div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="text-center py-6 px-4">
                        <p className="text-sm text-muted-foreground">
                            {activeFolder === "All"
                                ? "No documents yet."
                                : `No documents in "${activeFolder}".`}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Use the drop zone above to upload, or add a link.</p>
                    </div>
                ) : (
                    filteredDocuments.map((doc) => (
                        <div key={doc.id} className="group relative flex items-center justify-between p-3 rounded-xl border bg-background hover:bg-muted/10 transition-all cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-2 rounded-lg bg-muted shrink-0">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium truncate pr-4">{doc.name}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleStatus(doc) }}
                                            className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-tight hover:opacity-80 transition-opacity"
                                        >
                                            {getStatusIcon(doc.status)}
                                            <span className={
                                                doc.status === "SIGNED" ? "text-emerald-600" :
                                                    doc.status === "PENDING" ? "text-amber-600" : "text-blue-600"
                                            }>
                                                {getStatusLabel(doc.status)}
                                            </span>
                                        </button>
                                        <span className="text-[10px] text-muted-foreground/40">&bull;</span>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Calendar className="h-2.5 w-2.5" />
                                            {new Date(doc.createdAt).toLocaleDateString()}
                                        </span>
                                        {doc.folder && doc.folder !== "General" && (
                                            <>
                                                <span className="text-[10px] text-muted-foreground/40">&bull;</span>
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <FolderOpen className="h-2.5 w-2.5" />
                                                    {doc.folder}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="min-w-[160px]">
                                        <DropdownMenuItem className="text-xs" onClick={() => setPreviewDoc(doc)}>
                                            <Eye className="h-3.5 w-3.5 mr-2" />
                                            Preview
                                        </DropdownMenuItem>
                                        {doc.url && (
                                            <DropdownMenuItem className="text-xs" asChild>
                                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                                    Open in new tab
                                                </a>
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">Move to folder</div>
                                        {folders.map(folder => (
                                            <DropdownMenuItem
                                                key={folder}
                                                onClick={() => handleMoveToFolder(doc.id, folder)}
                                                disabled={(doc.folder || "General") === folder}
                                                className="text-xs"
                                            >
                                                <FolderOpen className="h-3 w-3 mr-2" />
                                                {folder}
                                            </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-xs text-red-500" onClick={() => setDeleteTarget(doc.id)}>
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <DocumentPreview
                document={previewDoc}
                open={!!previewDoc}
                onOpenChange={(open) => { if (!open) setPreviewDoc(null) }}
                contactId={contactId}
                onRefresh={fetchDocs}
            />

            <DocumentTemplateDialog
                open={templateDialogOpen}
                onOpenChange={setTemplateDialogOpen}
                contactId={contactId}
                onDocumentGenerated={fetchDocs}
            />

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Document</AlertDialogTitle>
                        <AlertDialogDescription>
                            Remove this document? This action cannot be undone.
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
