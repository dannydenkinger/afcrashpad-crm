"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Search, Plus, Upload, FileText, FilePen, FileCheck2, FileClock, File,
    Trash2, ArrowLeft, Send, X, CheckSquare, Square, Loader2,
    Eye, Pencil, Save, MoreHorizontal, ChevronDown, PanelLeftClose, PanelLeft, FileSignature, ExternalLink,
} from "lucide-react"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
    getAllDocuments, updateDocumentContent, createDraftDocument,
    sendForSignatures, bulkDeleteDocuments, bulkUpdateStatus,
    getContactList, type DocRecord,
} from "./actions"
import { getFolders, createFolder, renameFolder, deleteFolder, moveDocumentToFolder } from "./folder-actions"
import { FolderTree, buildFolderTree, type FolderNode } from "./components/FolderTree"
import { FolderBreadcrumb } from "./components/FolderBreadcrumb"
import { DndContext, type DragEndEvent } from "@dnd-kit/core"
import { useIsMobile } from "@/hooks/useIsMobile"
import { toast } from "sonner"

type StatusFilter = "ALL" | "DRAFT" | "LINK" | "PENDING" | "SIGNED"

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof FileText }> = {
    DRAFT: { label: "Draft", color: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: FilePen },
    LINK: { label: "Uploaded", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: File },
    PENDING: { label: "Pending", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: FileClock },
    SIGNED: { label: "Signed", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: FileCheck2 },
}

export default function DocumentsPage() {
    const isMobile = useIsMobile()
    const router = useRouter()

    // Data state
    const [documents, setDocuments] = useState<DocRecord[]>([])
    const [contacts, setContacts] = useState<{ id: string; name: string; email: string }[]>([])
    const [folderNodes, setFolderNodes] = useState<FolderNode[]>([])
    const [loading, setLoading] = useState(true)

    // UI state
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
    const [activeFolderPath, setActiveFolderPath] = useState("/")
    const [showFolders, setShowFolders] = useState(!isMobile)
    const [selectedDoc, setSelectedDoc] = useState<DocRecord | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [mobileShowDetail, setMobileShowDetail] = useState(false)

    // Edit state
    const [editing, setEditing] = useState(false)
    const [editContent, setEditContent] = useState("")
    const [editName, setEditName] = useState("")
    const [saving, setSaving] = useState(false)

    // New draft state
    const [showNewDraft, setShowNewDraft] = useState(false)
    const [newDraftName, setNewDraftName] = useState("")
    const [newDraftContact, setNewDraftContact] = useState("")
    const [newDraftContent, setNewDraftContent] = useState("")
    const [contactSearch, setContactSearch] = useState("")
    const [showContactDropdown, setShowContactDropdown] = useState(false)

    // Signature state
    const [showSignForm, setShowSignForm] = useState(false)
    const [signEmails, setSignEmails] = useState<string[]>([])
    const [signEmailInput, setSignEmailInput] = useState("")
    const [sendingSignature, setSendingSignature] = useState(false)

    // Upload state
    const [showUpload, setShowUpload] = useState(false)
    const [uploadContact, setUploadContact] = useState("")
    const [uploadContactSearch, setUploadContactSearch] = useState("")
    const [showUploadContactDropdown, setShowUploadContactDropdown] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ── Data Fetching ──

    const fetchDocuments = useCallback(async () => {
        setLoading(true)
        const result = await getAllDocuments()
        if (result.success) setDocuments(result.documents)
        setLoading(false)
    }, [])

    const fetchFolders = useCallback(async () => {
        const result = await getFolders()
        if (result.success) {
            // Build document counts per folder
            const counts: Record<string, number> = {}
            for (const doc of documents) {
                const fp = doc.folderPath || ("/" + (doc.folder || "General"))
                counts[fp] = (counts[fp] || 0) + 1
            }
            const tree = buildFolderTree(
                result.folders.map(f => ({ path: f.path, name: f.name })),
                counts
            )
            setFolderNodes(tree)
        }
    }, [documents])

    useEffect(() => {
        fetchDocuments()
        getContactList().then(setContacts)
    }, [fetchDocuments])

    useEffect(() => {
        fetchFolders()
    }, [fetchFolders])

    // ── Filtering ──

    const filtered = documents.filter(doc => {
        if (statusFilter !== "ALL" && doc.status !== statusFilter) return false
        if (activeFolderPath !== "/") {
            const docFolder = doc.folderPath || ("/" + (doc.folder || "General"))
            if (docFolder !== activeFolderPath && !docFolder.startsWith(activeFolderPath + "/")) return false
        }
        if (search) {
            const q = search.toLowerCase()
            return doc.name.toLowerCase().includes(q) || doc.contactName.toLowerCase().includes(q)
        }
        return true
    })

    const statusCounts = {
        ALL: documents.length,
        DRAFT: documents.filter(d => d.status === "DRAFT").length,
        LINK: documents.filter(d => d.status === "LINK").length,
        PENDING: documents.filter(d => d.status === "PENDING").length,
        SIGNED: documents.filter(d => d.status === "SIGNED").length,
    }

    // ── Selection ──

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filtered.map(d => `${d.contactId}:${d.id}`)))
        }
    }

    // ── Drag & Drop ──

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over) return

        const overId = String(over.id)
        if (!overId.startsWith("folder:")) return

        const targetPath = overId.replace("folder:", "")
        const docKey = String(active.id)
        const [contactId, docId] = docKey.split(":")

        const result = await moveDocumentToFolder(docId, contactId, targetPath)
        if (result.success) {
            toast.success("Document moved")
            fetchDocuments()
        } else {
            toast.error(result.error || "Failed to move document")
        }
    }

    // ── Folder Actions ──

    const handleCreateFolder = async (parentPath: string, name: string) => {
        const result = await createFolder(parentPath, name)
        if (result.success) {
            toast.success("Folder created")
            fetchFolders()
        } else {
            toast.error(result.error || "Failed to create folder")
        }
    }

    const handleRenameFolder = async (path: string, newName: string) => {
        const result = await renameFolder(path, newName)
        if (result.success) {
            toast.success("Folder renamed")
            fetchFolders()
            fetchDocuments()
        } else {
            toast.error(result.error || "Failed to rename folder")
        }
    }

    const handleDeleteFolder = async (path: string) => {
        const result = await deleteFolder(path)
        if (result.success) {
            toast.success("Folder deleted")
            if (activeFolderPath === path || activeFolderPath.startsWith(path + "/")) {
                setActiveFolderPath("/")
            }
            fetchFolders()
            fetchDocuments()
        } else {
            toast.error(result.error || "Failed to delete folder")
        }
    }

    // ── Actions ──

    const handleBulkDelete = async () => {
        const items = Array.from(selectedIds).map(key => {
            const [contactId, docId] = key.split(":")
            return { contactId, docId }
        })
        const result = await bulkDeleteDocuments(items)
        if (result.success) {
            toast.success(`Deleted ${items.length} documents`)
            setSelectedIds(new Set())
            if (selectedDoc && selectedIds.has(`${selectedDoc.contactId}:${selectedDoc.id}`)) {
                setSelectedDoc(null)
            }
            fetchDocuments()
        } else {
            toast.error(result.error || "Failed to delete")
        }
    }

    const handleBulkStatus = async (status: string) => {
        const items = Array.from(selectedIds).map(key => {
            const [contactId, docId] = key.split(":")
            return { contactId, docId }
        })
        const result = await bulkUpdateStatus(items, status)
        if (result.success) {
            toast.success(`Updated ${items.length} documents`)
            setSelectedIds(new Set())
            fetchDocuments()
        }
    }

    const handleSaveEdit = async () => {
        if (!selectedDoc) return
        setSaving(true)
        const result = await updateDocumentContent(selectedDoc.contactId, selectedDoc.id, editContent, editName || undefined)
        if (result.success) {
            toast.success("Document saved")
            setEditing(false)
            fetchDocuments()
        } else {
            toast.error(result.error || "Failed to save")
        }
        setSaving(false)
    }

    const handleCreateDraft = async () => {
        if (!newDraftName.trim()) {
            toast.error("Please enter a document name")
            return
        }
        const folderPath = activeFolderPath !== "/" ? activeFolderPath : undefined
        const result = await createDraftDocument(newDraftContact, newDraftName, newDraftContent || "<p></p>", folderPath ? folderPath.split("/").pop() : undefined)
        if (result.success) {
            toast.success("Draft created")
            setShowNewDraft(false)
            setNewDraftName("")
            setNewDraftContact("")
            setNewDraftContent("")
            fetchDocuments()
        } else {
            toast.error(result.error || "Failed to create draft")
        }
    }

    const handleAddSignEmail = () => {
        const email = signEmailInput.trim()
        if (!email || !email.includes("@")) return
        if (signEmails.includes(email)) return
        setSignEmails([...signEmails, email])
        setSignEmailInput("")
    }

    const handleSendForSignature = async () => {
        if (!selectedDoc || !signEmails.length) return
        setSendingSignature(true)
        const result = await sendForSignatures(selectedDoc.contactId, selectedDoc.id, signEmails)
        if (result.success) {
            toast.success(`Sent to ${signEmails.length} recipient(s)`)
            setShowSignForm(false)
            setSignEmails([])
            fetchDocuments()
        } else {
            toast.error(result.error || "Failed to send")
        }
        setSendingSignature(false)
    }

    const handleFileUpload = async (files: FileList | null) => {
        if (!files?.length) return
        setUploading(true)

        const folderPath = activeFolderPath !== "/" ? activeFolderPath : undefined

        for (const file of Array.from(files)) {
            const formData = new FormData()
            formData.append("file", file)
            if (folderPath) formData.append("folderPath", folderPath)
            try {
                if (uploadContact) {
                    const res = await fetch(`/api/contacts/${uploadContact}/documents/upload`, {
                        method: "POST",
                        body: formData,
                    })
                    if (!res.ok) {
                        const data = await res.json()
                        toast.error(data.error || `Failed to upload ${file.name}`)
                    }
                } else {
                    const res = await fetch("/api/documents/upload", {
                        method: "POST",
                        body: formData,
                    })
                    if (!res.ok) {
                        const data = await res.json()
                        toast.error(data.error || `Failed to upload ${file.name}`)
                    }
                }
            } catch {
                toast.error(`Failed to upload ${file.name}`)
            }
        }

        toast.success("Upload complete")
        setUploading(false)
        setShowUpload(false)
        setUploadContact("")
        fetchDocuments()
    }

    const selectDoc = (doc: DocRecord) => {
        setSelectedDoc(doc)
        setEditing(false)
        setShowSignForm(false)
        setSignEmails([])
        if (doc.generatedContent) {
            setEditContent(doc.generatedContent)
            setEditName(doc.name)
        }
        if (isMobile) setMobileShowDetail(true)
    }

    // ── Helpers ──

    const filteredContacts = (query: string) =>
        contacts.filter(c =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.email.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10)

    const isPdf = (doc: DocRecord) => {
        const ext = doc.name.split(".").pop()?.toLowerCase() || ""
        return ext === "pdf"
    }

    // ── Render: Document List Item ──

    const renderDocItem = (doc: DocRecord) => {
        const key = `${doc.contactId}:${doc.id}`
        const isSelected = selectedDoc?.id === doc.id && selectedDoc?.contactId === doc.contactId
        const isChecked = selectedIds.has(key)
        const config = STATUS_CONFIG[doc.status] || STATUS_CONFIG.LINK
        const StatusIcon = config.icon

        return (
            <div
                key={key}
                role="button"
                tabIndex={0}
                className={`w-full text-left p-3 rounded-lg transition-colors cursor-pointer ${
                    isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50 border border-transparent"
                }`}
                onClick={() => selectDoc(doc)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectDoc(doc) } }}
            >
                <div className="flex items-start gap-2">
                    <button
                        className="mt-0.5 shrink-0"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(key) }}
                    >
                        {isChecked
                            ? <CheckSquare className="h-4 w-4 text-primary" />
                            : <Square className="h-4 w-4 text-muted-foreground/30" />
                        }
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${config.color.split(" ")[1]}`} />
                            <span className="text-sm font-medium truncate">{doc.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground truncate">{doc.contactName || "Standalone"}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${config.color}`}>
                                {config.label}
                            </Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                            {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ""}
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    // ── Render: Detail Panel ──

    const renderDetailPanel = () => {
        if (!selectedDoc) {
            return (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Select a document to preview</p>
                    </div>
                </div>
            )
        }

        const config = STATUS_CONFIG[selectedDoc.status] || STATUS_CONFIG.LINK
        const canEdit = selectedDoc.generatedContent && (selectedDoc.status === "DRAFT" || selectedDoc.status === "LINK")
        const canSign = selectedDoc.status !== "SIGNED"
        const docIsPdf = isPdf(selectedDoc)

        return (
            <div className="flex-1 flex flex-col min-h-0">
                {/* Detail Header */}
                <div className="p-4 border-b shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                        {isMobile && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setMobileShowDetail(false)}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <div className="flex-1 min-w-0">
                            {editing ? (
                                <Input
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="h-8 text-sm font-semibold"
                                />
                            ) : (
                                <h3 className="text-sm font-semibold truncate">{selectedDoc.name}</h3>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">{selectedDoc.contactName || "Standalone"}</span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${config.color}`}>
                                    {config.label}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {editing ? (
                                <>
                                    <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="h-8 text-xs">
                                        {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                        Save
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-8 text-xs">
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {!isMobile && canEdit && (
                                        <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="h-8 text-xs">
                                            <Pencil className="h-3 w-3 mr-1" /> Edit
                                        </Button>
                                    )}
                                    {!isMobile && docIsPdf && canSign && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => {
                                                const params = new URLSearchParams()
                                                if (selectedDoc.contactId) params.set("contactId", selectedDoc.contactId)
                                                router.push(`/documents/${selectedDoc.id}/prepare?${params.toString()}`)
                                            }}
                                        >
                                            <FileSignature className="h-3 w-3 mr-1" /> Prepare Signature
                                        </Button>
                                    )}
                                    {!isMobile && canSign && (
                                        <Button variant="outline" size="sm" onClick={() => setShowSignForm(!showSignForm)} className="h-8 text-xs">
                                            <Send className="h-3 w-3 mr-1" /> Quick Send
                                        </Button>
                                    )}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {isMobile && canEdit && (
                                                <DropdownMenuItem onClick={() => setEditing(true)}>
                                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                                </DropdownMenuItem>
                                            )}
                                            {isMobile && docIsPdf && canSign && (
                                                <DropdownMenuItem onClick={() => {
                                                    const params = new URLSearchParams()
                                                    if (selectedDoc.contactId) params.set("contactId", selectedDoc.contactId)
                                                    router.push(`/documents/${selectedDoc.id}/prepare?${params.toString()}`)
                                                }}>
                                                    <FileSignature className="h-3.5 w-3.5 mr-2" /> Prepare Signature
                                                </DropdownMenuItem>
                                            )}
                                            {isMobile && canSign && (
                                                <DropdownMenuItem onClick={() => setShowSignForm(!showSignForm)}>
                                                    <Send className="h-3.5 w-3.5 mr-2" /> Quick Send
                                                </DropdownMenuItem>
                                            )}
                                            {isMobile && (canEdit || (docIsPdf && canSign) || canSign) && <DropdownMenuSeparator />}
                                            {selectedDoc.url && (
                                                <DropdownMenuItem onClick={() => window.open(selectedDoc.url, "_blank")}>
                                                    <Eye className="h-3.5 w-3.5 mr-2" /> Open in New Tab
                                                </DropdownMenuItem>
                                            )}
                                            {selectedDoc.signedPdfUrl && (
                                                <DropdownMenuItem onClick={() => window.open(selectedDoc.signedPdfUrl!, "_blank")}>
                                                    <FileCheck2 className="h-3.5 w-3.5 mr-2" /> Download Signed PDF
                                                </DropdownMenuItem>
                                            )}
                                            {selectedDoc.contactId && (
                                                <DropdownMenuItem onClick={() => router.push(`/contacts/${selectedDoc.contactId}`)}>
                                                    View Contact
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={async () => {
                                                    await bulkDeleteDocuments([{ contactId: selectedDoc.contactId, docId: selectedDoc.id }])
                                                    toast.success("Document deleted")
                                                    setSelectedDoc(null)
                                                    fetchDocuments()
                                                }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Signature Form */}
                    {showSignForm && (
                        <div className="mt-3 p-3 bg-muted/30 rounded-lg border">
                            <p className="text-xs font-medium mb-2">Send for signature to:</p>
                            <div className="flex gap-2 mb-2">
                                <Input
                                    type="email"
                                    placeholder="email@example.com"
                                    value={signEmailInput}
                                    onChange={e => setSignEmailInput(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddSignEmail())}
                                    className="h-8 text-xs flex-1"
                                />
                                <Button size="sm" variant="outline" onClick={handleAddSignEmail} className="h-8 text-xs">
                                    Add
                                </Button>
                            </div>
                            {signEmails.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {signEmails.map(email => (
                                        <Badge key={email} variant="secondary" className="text-xs gap-1 pr-1">
                                            {email}
                                            <button onClick={() => setSignEmails(signEmails.filter(e => e !== email))}>
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            {selectedDoc.contactEmail && !signEmails.includes(selectedDoc.contactEmail) && (
                                <button
                                    className="text-[10px] text-primary hover:underline mb-2"
                                    onClick={() => setSignEmails([...signEmails, selectedDoc.contactEmail])}
                                >
                                    + Add {selectedDoc.contactName}&apos;s email ({selectedDoc.contactEmail})
                                </button>
                            )}
                            <Button
                                size="sm"
                                onClick={handleSendForSignature}
                                disabled={sendingSignature || !signEmails.length}
                                className="h-8 text-xs w-full"
                            >
                                {sendingSignature ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                                Send to {signEmails.length} Recipient{signEmails.length !== 1 ? "s" : ""}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Preview Area */}
                <div className="flex-1 min-h-0 overflow-auto">
                    {editing && selectedDoc.generatedContent ? (
                        <textarea
                            className="w-full h-full p-4 bg-background text-sm font-mono resize-none focus:outline-none"
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                        />
                    ) : selectedDoc.generatedContent ? (
                        <div className="p-6 max-w-3xl mx-auto">
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: selectedDoc.generatedContent }}
                            />
                            {selectedDoc.signatureUrl && (
                                <div className="mt-8 pt-4 border-t">
                                    <p className="text-xs text-muted-foreground mb-2">Signature:</p>
                                    <img src={selectedDoc.signatureUrl} alt="Signature" className="max-h-20 border rounded" />
                                </div>
                            )}
                        </div>
                    ) : selectedDoc.url ? (
                        (() => {
                            const ext = selectedDoc.name.split(".").pop()?.toLowerCase() || ""
                            const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)
                            const isDocPdf = ext === "pdf"

                            if (isImage) {
                                return (
                                    <div className="flex items-center justify-center p-6 h-full">
                                        <img src={selectedDoc.url} alt={selectedDoc.name} className="max-w-full max-h-full object-contain rounded" />
                                    </div>
                                )
                            }
                            if (isDocPdf) {
                                if (isMobile) {
                                    return (
                                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                                            <FileText className="h-16 w-16 text-muted-foreground/30" />
                                            <p className="text-sm text-muted-foreground text-center">PDF previews open in a new tab on mobile for the best viewing experience.</p>
                                            <Button asChild className="gap-2">
                                                <a href={selectedDoc.url} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open PDF
                                                </a>
                                            </Button>
                                        </div>
                                    )
                                }
                                return <iframe src={selectedDoc.url} className="w-full h-full border-0" title={selectedDoc.name} />
                            }
                            if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) {
                                return (
                                    <iframe
                                        src={`https://docs.google.com/gview?url=${encodeURIComponent(selectedDoc.url)}&embedded=true`}
                                        className="w-full h-full border-0"
                                        title={selectedDoc.name}
                                    />
                                )
                            }
                            return (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <File className="h-16 w-16 text-muted-foreground/20" />
                                    <p className="text-sm text-muted-foreground">Preview not available for this file type</p>
                                    <Button variant="outline" size="sm" onClick={() => window.open(selectedDoc.url, "_blank")}>
                                        <Eye className="h-3.5 w-3.5 mr-2" /> Open File
                                    </Button>
                                </div>
                            )
                        })()
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <p className="text-sm">No content to preview</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ── Contact Selector Component ──

    const ContactSelector = ({
        value, onChange, searchValue, onSearchChange, showDropdown, setShowDropdown,
    }: {
        value: string
        onChange: (id: string) => void
        searchValue: string
        onSearchChange: (v: string) => void
        showDropdown: boolean
        setShowDropdown: (v: boolean) => void
    }) => {
        const selectedContact = contacts.find(c => c.id === value)
        return (
            <div className="relative">
                <Input
                    placeholder="Search contacts (optional)..."
                    value={selectedContact ? selectedContact.name : searchValue}
                    onChange={e => {
                        onSearchChange(e.target.value)
                        setShowDropdown(true)
                        if (value) onChange("")
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="h-8 text-xs"
                />
                {showDropdown && !value && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-40 overflow-auto">
                        {filteredContacts(searchValue).map(c => (
                            <button
                                key={c.id}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
                                onClick={() => {
                                    onChange(c.id)
                                    setShowDropdown(false)
                                    onSearchChange("")
                                }}
                            >
                                <span className="font-medium">{c.name}</span>
                                {c.email && <span className="text-muted-foreground ml-2">{c.email}</span>}
                            </button>
                        ))}
                        {filteredContacts(searchValue).length === 0 && (
                            <p className="px-3 py-2 text-xs text-muted-foreground">No contacts found</p>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // ── Main Layout ──

    if (isMobile && mobileShowDetail && selectedDoc) {
        return (
            <div className="flex flex-col h-full bg-background">
                {renderDetailPanel()}
            </div>
        )
    }

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <div className={`flex flex-col ${isMobile ? "h-full" : "h-[calc(100vh-48px)]"} bg-background`}>
                {/* Header */}
                <div className="p-4 border-b shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            {!isMobile && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setShowFolders(!showFolders)}
                                >
                                    {showFolders ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                                </Button>
                            )}
                            <h2 className="text-lg font-bold">Documents</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => setShowUpload(true)} className="h-8 text-xs">
                                <Upload className="h-3 w-3 mr-1" /> Upload
                            </Button>
                            <Button size="sm" onClick={() => setShowNewDraft(true)} className="h-8 text-xs">
                                <Plus className="h-3 w-3 mr-1" /> New Draft
                            </Button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search documents or contacts..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-8 h-8 text-xs"
                        />
                    </div>

                    {/* Status Filters */}
                    <div className="flex gap-1 flex-wrap">
                        {(["ALL", "DRAFT", "LINK", "PENDING", "SIGNED"] as StatusFilter[]).map(status => (
                            <button
                                key={status}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                                    statusFilter === status
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                }`}
                                onClick={() => setStatusFilter(status)}
                            >
                                {status === "ALL" ? "All" : STATUS_CONFIG[status]?.label || status}
                                <span className="ml-1 opacity-70">{statusCounts[status]}</span>
                            </button>
                        ))}
                    </div>

                    {/* Bulk Actions */}
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2 mt-3 p-2 bg-primary/5 rounded-lg border border-primary/10">
                            <span className="text-xs font-medium text-primary">{selectedIds.size} selected</span>
                            <div className="flex-1" />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 text-xs">
                                        Status <ChevronDown className="h-3 w-3 ml-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleBulkStatus("DRAFT")}>Mark as Draft</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleBulkStatus("LINK")}>Mark as Uploaded</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleBulkStatus("PENDING")}>Mark as Pending</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleBulkStatus("SIGNED")}>Mark as Signed</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleBulkDelete}>
                                <Trash2 className="h-3 w-3 mr-1" /> Delete
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                                Clear
                            </Button>
                        </div>
                    )}
                </div>

                {/* New Draft Dialog */}
                {showNewDraft && (
                    <div className="p-4 border-b bg-muted/20 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold">New Draft Document</p>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewDraft(false)}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <Input
                                placeholder="Document name..."
                                value={newDraftName}
                                onChange={e => setNewDraftName(e.target.value)}
                                className="h-8 text-xs"
                            />
                            <div>
                                <p className="text-[10px] text-muted-foreground mb-1">Attach to contact (optional):</p>
                                <ContactSelector
                                    value={newDraftContact}
                                    onChange={setNewDraftContact}
                                    searchValue={contactSearch}
                                    onSearchChange={setContactSearch}
                                    showDropdown={showContactDropdown}
                                    setShowDropdown={setShowContactDropdown}
                                />
                            </div>
                            <textarea
                                placeholder="Document content (HTML)..."
                                value={newDraftContent}
                                onChange={e => setNewDraftContent(e.target.value)}
                                className="w-full h-24 p-2 rounded-md border bg-background text-xs font-mono resize-none"
                            />
                            <Button size="sm" onClick={handleCreateDraft} className="h-8 text-xs">
                                Create Draft
                            </Button>
                        </div>
                    </div>
                )}

                {/* Upload Dialog */}
                {showUpload && (
                    <div className="p-4 border-b bg-muted/20 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold">Upload Document</p>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowUpload(false)}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Optionally attach to a contact, or leave blank for a standalone document:</p>
                            <ContactSelector
                                value={uploadContact}
                                onChange={setUploadContact}
                                searchValue={uploadContactSearch}
                                onSearchChange={setUploadContactSearch}
                                showDropdown={showUploadContactDropdown}
                                setShowDropdown={setShowUploadContactDropdown}
                            />
                            <div
                                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-primary") }}
                                onDragLeave={e => e.currentTarget.classList.remove("border-primary")}
                                onDrop={e => {
                                    e.preventDefault()
                                    e.currentTarget.classList.remove("border-primary")
                                    handleFileUpload(e.dataTransfer.files)
                                }}
                            >
                                {uploading ? (
                                    <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                                ) : (
                                    <>
                                        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                                        <p className="text-xs text-muted-foreground">Drop files here or click to browse</p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-1">PDF, DOC, XLS, images — max 25MB</p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
                                className="hidden"
                                onChange={e => handleFileUpload(e.target.files)}
                            />
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className={`flex-1 min-h-0 ${isMobile ? "" : "flex"}`}>
                    {/* Folder Panel (desktop) */}
                    {!isMobile && showFolders && (
                        <div className="w-[200px] border-r overflow-auto shrink-0">
                            <FolderTree
                                folders={folderNodes}
                                activePath={activeFolderPath}
                                totalCount={documents.length}
                                onSelectFolder={setActiveFolderPath}
                                onCreateFolder={handleCreateFolder}
                                onRenameFolder={handleRenameFolder}
                                onDeleteFolder={handleDeleteFolder}
                            />
                        </div>
                    )}

                    {/* Document List */}
                    <div className={`${isMobile ? "h-full" : "w-[340px] border-r"} flex flex-col min-h-0`}>
                        {/* Folder Breadcrumb */}
                        {activeFolderPath !== "/" && (
                            <div className="px-2 border-b shrink-0">
                                <FolderBreadcrumb path={activeFolderPath} onNavigate={setActiveFolderPath} />
                            </div>
                        )}

                        {/* Mobile folder selector */}
                        {isMobile && (
                            <div className="px-2 py-1.5 border-b shrink-0">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-between">
                                            {activeFolderPath === "/" ? "All Folders" : activeFolderPath.split("/").pop()}
                                            <ChevronDown className="h-3 w-3 ml-1" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56">
                                        <DropdownMenuItem onClick={() => setActiveFolderPath("/")}>
                                            All Documents
                                        </DropdownMenuItem>
                                        {folderNodes.map(f => (
                                            <DropdownMenuItem key={f.path} onClick={() => setActiveFolderPath(f.path)}>
                                                {f.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center p-4 text-center">
                                <div>
                                    <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
                                    <p className="text-sm text-muted-foreground">No documents found</p>
                                    {(statusFilter !== "ALL" || activeFolderPath !== "/") && (
                                        <button
                                            className="text-xs text-primary mt-1"
                                            onClick={() => { setStatusFilter("ALL"); setActiveFolderPath("/") }}
                                        >
                                            Clear filters
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-auto p-2 space-y-1">
                                {!isMobile && filtered.length > 1 && (
                                    <button
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={toggleSelectAll}
                                    >
                                        {selectedIds.size === filtered.length
                                            ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                                            : <Square className="h-3.5 w-3.5" />
                                        }
                                        Select all ({filtered.length})
                                    </button>
                                )}
                                {filtered.map(renderDocItem)}
                            </div>
                        )}
                    </div>

                    {/* Right: Detail Panel (desktop only) */}
                    {!isMobile && (
                        <div className="flex-1 flex flex-col min-h-0 bg-muted/10">
                            {renderDetailPanel()}
                        </div>
                    )}
                </div>
            </div>
        </DndContext>
    )
}
