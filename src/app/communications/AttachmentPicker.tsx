"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Paperclip, Upload, FileText, X, FolderOpen } from "lucide-react"
import { getContactDocuments } from "./actions"
import { toast } from "sonner"

export interface AttachmentFile {
    filename: string
    url: string
    contentType?: string
    isNew?: boolean // true if just uploaded, false if from existing docs
}

interface AttachmentPickerProps {
    contactId: string | null
    attachments: AttachmentFile[]
    onAdd: (attachment: AttachmentFile) => void
    onRemove: (index: number) => void
}

export default function AttachmentPicker({ contactId, attachments, onAdd, onRemove }: AttachmentPickerProps) {
    const [showPicker, setShowPicker] = useState(false)
    const [existingDocs, setExistingDocs] = useState<any[]>([])
    const [isLoadingDocs, setIsLoadingDocs] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const loadExistingDocs = async () => {
        if (!contactId) return
        setIsLoadingDocs(true)
        const res = await getContactDocuments(contactId)
        if (res.success) setExistingDocs(res.documents)
        setIsLoadingDocs(false)
    }

    useEffect(() => {
        if (showPicker && contactId) {
            loadExistingDocs()
        }
    }, [showPicker, contactId])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        if (!contactId) {
            toast.error("Select a contact first")
            return
        }

        let successCount = 0
        for (const file of Array.from(files)) {
            if (file.size > 25 * 1024 * 1024) {
                toast.error(`${file.name} is too large (max 25 MB)`)
                continue
            }

            try {
                const formData = new FormData()
                formData.append("file", file)
                formData.append("name", file.name)

                const response = await fetch(`/api/contacts/${contactId}/documents/upload`, {
                    method: "POST",
                    body: formData,
                })

                const result = await response.json()
                if (result.success && result.document) {
                    onAdd({
                        filename: file.name,
                        url: result.document.url,
                        contentType: file.type,
                        isNew: true,
                    })
                    successCount++
                } else {
                    toast.error(result.error || `Failed to upload ${file.name}`)
                }
            } catch {
                toast.error(`Failed to upload ${file.name}`)
            }
        }

        if (successCount > 0) {
            toast.success(`${successCount} file${successCount > 1 ? "s" : ""} attached`)
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = ""
        setShowPicker(false)
    }

    const handleSelectExisting = (doc: any) => {
        // Check if already attached
        if (attachments.some(a => a.url === doc.url)) {
            toast.error("Already attached")
            return
        }

        onAdd({
            filename: doc.name,
            url: doc.url,
            isNew: false,
        })
        setShowPicker(false)
    }

    const getFileIcon = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase()
        switch (ext) {
            case 'pdf': return 'PDF'
            case 'doc': case 'docx': return 'DOC'
            case 'xls': case 'xlsx': return 'XLS'
            case 'jpg': case 'jpeg': case 'png': case 'gif': return 'IMG'
            default: return 'FILE'
        }
    }

    return (
        <div className="relative">
            {/* Attachment chips */}
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {attachments.map((att, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border text-xs"
                        >
                            <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1 py-0.5 rounded">
                                {getFileIcon(att.filename)}
                            </span>
                            <span className="truncate max-w-[120px]">{att.filename}</span>
                            <button
                                onClick={() => onRemove(idx)}
                                className="text-muted-foreground hover:text-destructive shrink-0"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Attach button */}
            <button
                onClick={() => setShowPicker(!showPicker)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                title="Attach file"
            >
                <Paperclip className="h-4 w-4" />
            </button>

            {/* Picker dropdown */}
            {showPicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-card border rounded-xl shadow-lg p-3 z-50 w-64">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold">Attach File</span>
                        <button onClick={() => setShowPicker(false)} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Upload new */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                        <Upload className="h-4 w-4 text-blue-500" />
                        <div>
                            <span className="text-xs font-medium">Upload new file</span>
                            <p className="text-[10px] text-muted-foreground">Max 25 MB</p>
                        </div>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        multiple
                    />

                    {/* Existing documents */}
                    {contactId && (
                        <>
                            <div className="border-t my-2" />
                            <div className="flex items-center gap-1.5 px-3 py-1 mb-1">
                                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contact Documents</span>
                            </div>

                            {isLoadingDocs ? (
                                <div className="px-3 py-2 text-[10px] text-muted-foreground">Loading...</div>
                            ) : existingDocs.length === 0 ? (
                                <div className="px-3 py-2 text-[10px] text-muted-foreground">No documents found</div>
                            ) : (
                                <div className="max-h-32 overflow-y-auto space-y-0.5">
                                    {existingDocs.map(doc => (
                                        <button
                                            key={doc.id}
                                            onClick={() => handleSelectExisting(doc)}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                                        >
                                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-xs truncate">{doc.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
