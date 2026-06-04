"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Phone, Mail, MoreVertical, Plus, FileText, MessageSquare,
    Trash2, ListTodo, Briefcase, ExternalLink, FileDown, Upload, Loader2, Pencil, Check,
    Send, Share2, Eye, MousePointerClick, CalendarDays,
} from "lucide-react"
import { exportToPDF } from "@/lib/export-pdf"
import { buildContactProfileHtml } from "@/components/PrintableProfile"
import { CustomFieldsSection } from "@/components/CustomFieldsSection"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PhoneActions } from "./PhoneActions"
import { RequestReviewButton } from "./RequestReviewButton"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
const DocumentManager = dynamic(() => import("./documents/DocumentManager").then(mod => mod.DocumentManager), {
    loading: () => <div className="h-32 bg-muted animate-pulse rounded-md" />,
    ssr: false,
})
import dynamic from "next/dynamic"
const NotesEditor = dynamic(() => import("@/components/NotesEditor").then(mod => mod.NotesEditor), {
    loading: () => <div className="h-32 bg-muted animate-pulse rounded-md" />,
    ssr: false,
})
import { addRelatedContact, removeRelatedContact } from "./actions"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    AlertTriangle, Users, Link, X as XIcon,
} from "lucide-react"

interface ContactDetailSheetProps {
    selectedContact: any
    editingContact: any
    setEditingContact: (fn: (prev: any) => any) => void
    onClose: () => void
    contactStatuses: { id: string; name: string }[]
    // Note handling
    noteContent: string
    setNoteContent: (val: string) => void
    onAddNote: () => void
    onAddNoteWithMentions: (content: string, mentions: { userId: string; userName: string }[]) => Promise<void>
    isSavingNote: boolean
    expandedNoteIds: Set<string>
    toggleNoteExpanded: (id: string) => void
    onDeleteNote: (contactId: string, noteId: string) => void
    onEditNote?: (contactId: string, noteId: string, content: string, mentions: { userId: string; userName: string }[]) => Promise<void>
    // Users for @mention
    users: { id: string; name: string; email: string }[]
    // Message logging
    logMessageType: "EMAIL" | "SMS"
    setLogMessageType: (type: "EMAIL" | "SMS") => void
    logMessageContent: string
    setLogMessageContent: (val: string) => void
    onLogMessage: () => void
    isLoggingMessage: boolean
    // Save
    onSave: () => void
    isSaving: boolean
    saveError: string | null
    // Opportunity
    onCreateOpportunity: () => void
    // Form tracking
    onToggleForm: (field: string, value: boolean) => void
    // Task dialog
    onOpenTaskDialog: () => void
    // Delete
    onDeleteContact: (id: string) => void
    // All contacts for duplicate detection
    allContacts?: { id: string; name: string; email: string; phone: string }[]
    // Related contacts callbacks
    onRefreshContact?: () => void
    // Merge trigger
    onMergeWith?: (contactId: string) => void
}

/** Inline-editable field: shows display text, becomes input on click, auto-saves on blur */
function InlineField({ label, value, onChange, onBlurSave, type = "text", error, placeholder, colSpan }: {
    label: string; value: string; onChange: (val: string) => void; onBlurSave: () => void;
    type?: string; error?: string; placeholder?: string; colSpan?: boolean
}) {
    const [editing, setEditing] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (editing && inputRef.current) inputRef.current.focus()
    }, [editing])

    return (
        <div className={`space-y-1 ${colSpan ? "lg:col-span-2" : ""}`}>
            <span className="text-muted-foreground text-xs">{label}</span>
            {editing ? (
                <div className="flex items-center gap-1">
                    <Input
                        ref={inputRef}
                        type={type}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={() => { setEditing(false); onBlurSave() }}
                        onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); onBlurSave() } if (e.key === "Escape") setEditing(false) }}
                        placeholder={placeholder}
                        className={`h-8 text-sm font-medium ${error ? "border-destructive" : ""}`}
                    />
                </div>
            ) : (
                <div
                    className="group/field flex items-center gap-1.5 min-h-[32px] px-3 py-1 rounded-md cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setEditing(true)}
                >
                    <span className={`text-sm ${value ? "font-medium" : "text-muted-foreground"}`}>
                        {value || placeholder || "—"}
                    </span>
                    <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover/field:text-muted-foreground/50 transition-opacity ml-auto shrink-0" />
                </div>
            )}
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
    )
}

export function ContactDetailSheet({
    selectedContact,
    editingContact,
    setEditingContact,
    onClose,
    contactStatuses,
    noteContent,
    setNoteContent,
    onAddNote,
    onAddNoteWithMentions,
    isSavingNote,
    expandedNoteIds,
    toggleNoteExpanded,
    onDeleteNote,
    onEditNote,
    users,
    logMessageType,
    setLogMessageType,
    logMessageContent,
    setLogMessageContent,
    onLogMessage,
    isLoggingMessage,
    onSave,
    isSaving,
    saveError,
    onCreateOpportunity,
    onToggleForm,
    onOpenTaskDialog,
    onDeleteContact,
    allContacts,
    onRefreshContact,
    onMergeWith,
}: ContactDetailSheetProps) {
    const router = useRouter()
    const [formErrors, setFormErrors] = useState<Record<string, string>>({})
    const [isAddRelatedOpen, setIsAddRelatedOpen] = useState(false)
    const [relatedSearchTerm, setRelatedSearchTerm] = useState("")
    const [relatedRelationship, setRelatedRelationship] = useState<string>("Roommate")
    const [isAddingRelated, setIsAddingRelated] = useState(false)
    const [isRemovingRelated, setIsRemovingRelated] = useState<string | null>(null)
    const [isDragOverSheet, setIsDragOverSheet] = useState(false)
    const [isUploadingDrop, setIsUploadingDrop] = useState(false)
    /** Workspace booking link from Branding settings. When set, the
     *  contact action row shows a "Booking link" quick-share button. */
    const [bookingLink, setBookingLink] = useState<string | null>(null)
    useEffect(() => {
        let cancelled = false
        import("@/app/settings/branding/actions").then(({ getBrandingSettings }) =>
            getBrandingSettings().then((b) => {
                if (cancelled) return
                if (b?.bookingLinkUrl) setBookingLink(b.bookingLinkUrl)
            }).catch(() => {})
        )
        return () => { cancelled = true }
    }, [])
    const dragCounterRef = useRef(0)

    // Duplicate detection (lightweight client-side)
    const duplicates = (() => {
        if (!selectedContact || selectedContact.id === "new" || !allContacts) return []
        const found: { id: string; name: string; matchType: string }[] = []
        const currentEmail = (selectedContact.email || "").toLowerCase().trim()
        const currentPhone = (selectedContact.phone || "").replace(/\D/g, "")
        const currentName = (selectedContact.name || "").toLowerCase().trim()

        for (const c of allContacts) {
            if (c.id === selectedContact.id) continue

            // Match by email
            if (currentEmail && c.email && c.email.toLowerCase().trim() === currentEmail) {
                found.push({ id: c.id, name: c.name, matchType: "email" })
                continue
            }
            // Match by phone (normalized digits, min 7)
            const cPhone = (c.phone || "").replace(/\D/g, "")
            if (currentPhone.length >= 7 && cPhone.length >= 7 && currentPhone === cPhone) {
                found.push({ id: c.id, name: c.name, matchType: "phone" })
                continue
            }
            // Match by similar name (case-insensitive)
            if (currentName.length >= 2 && c.name && c.name.toLowerCase().trim() === currentName) {
                found.push({ id: c.id, name: c.name, matchType: "name" })
                continue
            }
        }
        return found
    })()

    const handleAddRelated = async (relatedId: string) => {
        if (!selectedContact) return
        setIsAddingRelated(true)
        const res = await addRelatedContact(selectedContact.id, relatedId, relatedRelationship)
        if (res.success) {
            toast.success("Related contact added")
            setIsAddRelatedOpen(false)
            setRelatedSearchTerm("")
            onRefreshContact?.()
        } else {
            toast.error(res.error || "Failed to add related contact")
        }
        setIsAddingRelated(false)
    }

    const handleRemoveRelated = async (relatedId: string) => {
        if (!selectedContact) return
        setIsRemovingRelated(relatedId)
        const res = await removeRelatedContact(selectedContact.id, relatedId)
        if (res.success) {
            toast.success("Related contact removed")
            onRefreshContact?.()
        } else {
            toast.error(res.error || "Failed to remove related contact")
        }
        setIsRemovingRelated(null)
    }

    const validateContactForm = (): Record<string, string> => {
        const errors: Record<string, string> = {}
        if (!editingContact?.name?.trim()) {
            errors.name = "Name is required"
        }
        if (editingContact?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingContact.email)) {
            errors.email = "Invalid email format"
        }
        if (editingContact?.phone && !/^[0-9\s\-()+ ]*$/.test(editingContact.phone)) {
            errors.phone = "Phone can only contain digits, spaces, dashes, parens, and +"
        }
        return errors
    }

    const handleValidatedSave = () => {
        const errors = validateContactForm()
        setFormErrors(errors)
        if (Object.keys(errors).length > 0) {
            const messages = Object.values(errors)
            toast.error(messages.join(". "))
            return
        }
        onSave()
    }

    const handleSheetDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!selectedContact || selectedContact.id === "new") return
        dragCounterRef.current += 1
        if (dragCounterRef.current === 1) {
            // Only show overlay when files are being dragged (not text, etc.)
            if (e.dataTransfer.types.includes("Files")) {
                setIsDragOverSheet(true)
            }
        }
    }, [selectedContact])

    const handleSheetDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
        // Backstop: if the drag is leaving the entire sheet element (relatedTarget
        // is null or outside the current target), force-clear regardless of counter
        // state. Fixes the "stuck overlay" case where nested children miscounted.
        const ct = e.currentTarget as HTMLElement
        const rt = e.relatedTarget as Node | null
        const leftSheet = !rt || !ct.contains(rt)
        if (leftSheet || dragCounterRef.current === 0) {
            dragCounterRef.current = 0
            setIsDragOverSheet(false)
        }
    }, [])

    const handleSheetDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    const handleSheetDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounterRef.current = 0
        setIsDragOverSheet(false)
        if (!selectedContact || selectedContact.id === "new") return

        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return

        setIsUploadingDrop(true)
        const { uploadDocument } = await import("@/lib/upload-document")
        let succeeded = 0
        const failed: string[] = []
        for (const file of files) {
            const res = await uploadDocument(file, { contactId: selectedContact.id })
            if (res.success) succeeded++
            else failed.push(`${file.name}: ${res.error}`)
        }
        setIsUploadingDrop(false)
        if (failed.length === 0) {
            toast.success(`${succeeded} file${succeeded !== 1 ? "s" : ""} uploaded`)
        } else if (succeeded === 0) {
            toast.error(`Upload failed: ${failed[0]}${failed.length > 1 ? ` (and ${failed.length - 1} more)` : ""}`)
        } else {
            toast.warning(`Uploaded ${succeeded} of ${files.length}. ${failed.length} failed.`, { duration: 6000 })
        }
        onRefreshContact?.()
    }, [selectedContact, onRefreshContact])

    return (
        <Sheet open={!!selectedContact} onOpenChange={() => onClose()}>
            <SheetContent
                className="lg:max-w-xl p-0 flex flex-col gap-0 border-l border-border/50 shadow-2xl safe-bottom"
                onDragEnter={handleSheetDragEnter}
                onDragLeave={handleSheetDragLeave}
                onDragOver={handleSheetDragOver}
                onDrop={handleSheetDrop}
            >
                {/* Full-sheet file drop overlay */}
                {isDragOverSheet && (
                    <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg flex flex-col items-center justify-center gap-3 pointer-events-none animate-in fade-in duration-150">
                        <div className="p-4 rounded-full bg-primary/20">
                            <Upload className="h-8 w-8 text-primary" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-semibold text-primary">Drop files to upload</p>
                            <p className="text-sm text-muted-foreground mt-1">Files will be attached to this contact</p>
                        </div>
                    </div>
                )}

                {/* Upload progress overlay */}
                {isUploadingDrop && (
                    <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-none animate-in fade-in duration-150">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium text-muted-foreground">Uploading files...</p>
                    </div>
                )}

                {(() => {
                    const contact = selectedContact
                    if (!contact) return null
                    return (
                        <>
                            <div className="p-4 sm:p-6 bg-muted/30 border-b" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
                                <div className="flex items-start justify-between mb-4 gap-3">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                        <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-background shadow-sm shrink-0">
                                            <AvatarFallback className="text-lg sm:text-xl bg-primary/10 text-primary font-semibold">
                                                {contact.name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <SheetTitle className="text-xl sm:text-2xl tracking-tight truncate">
                                                {contact.name}
                                            </SheetTitle>
                                            <SheetDescription className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                {contact.status && (
                                                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                                                        contact.status === "Customer" || contact.status === "Active Stay" || contact.status === "Active Client"
                                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                            : contact.status === "Lead"
                                                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                                                              : contact.status === "Past Customer" || contact.status === "Past Tenant"
                                                                ? "bg-zinc-500/10 text-muted-foreground border-zinc-500/20"
                                                                : "bg-muted text-muted-foreground border-border"
                                                    }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${
                                                            contact.status === "Customer" || contact.status === "Active Stay" || contact.status === "Active Client"
                                                                ? "bg-emerald-500"
                                                                : contact.status === "Lead"
                                                                  ? "bg-blue-500"
                                                                  : "bg-muted-foreground/40"
                                                        }`} />
                                                        {contact.status}
                                                    </span>
                                                )}
                                                {contact.utmSource && (
                                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                        via {contact.utmSource}
                                                    </span>
                                                )}
                                            </SheetDescription>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={(e) => { e.stopPropagation(); if (contact.id !== 'new') onOpenTaskDialog(); }}
                                                disabled={contact.id === 'new'}
                                            >
                                                <ListTodo className="mr-2 h-4 w-4" />
                                                Add task for contact
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    const html = buildContactProfileHtml(contact)
                                                    const safeName = (contact.name || "contact").replace(/[^a-zA-Z0-9]/g, "_")
                                                    exportToPDF(html, `${safeName}_profile`)
                                                }}
                                                disabled={contact.id === 'new'}
                                            >
                                                <FileDown className="mr-2 h-4 w-4" />
                                                Export PDF
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={(e) => { e.stopPropagation(); contact.id !== 'new' && onDeleteContact(contact.id); }}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete Contact
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Duplicate detection banner */}
                                {duplicates.length > 0 && (
                                    <div className="mt-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                                Possible duplicate{duplicates.length > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {duplicates.map((dup) => (
                                                <div key={dup.id} className="flex items-center justify-between gap-2">
                                                    <span className="text-sm min-w-0 truncate">
                                                        <span className="font-medium">{dup.name}</span>
                                                        <span className="text-xs text-muted-foreground ml-1.5">
                                                            · {dup.matchType} match
                                                        </span>
                                                    </span>
                                                    {onMergeWith && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 shrink-0"
                                                            onClick={() => onMergeWith(dup.id)}
                                                        >
                                                            Review &amp; merge
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Opportunity attachment */}
                                {contact.opportunities?.length > 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/pipeline?deal=${contact.opportunities[0].id}`)}
                                        className="relative w-full mt-4 p-3 rounded-xl border bg-card hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors text-left group overflow-hidden"
                                    >
                                        <div
                                            aria-hidden
                                            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-500/40 to-emerald-500/0"
                                        />
                                        <div className="flex items-start gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                                <Briefcase className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                                                    Opportunity
                                                </div>
                                                <div className="text-sm font-semibold truncate">
                                                    {contact.opportunities[0].name || "Untitled deal"}
                                                </div>
                                                {contact.opportunities[0].opportunityValue != null && (
                                                    <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                                                        ${Number(contact.opportunities[0].opportunityValue).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                                        </div>
                                    </button>
                                ) : (
                                    <div className="mt-4 p-3 rounded-xl border border-dashed bg-card/50 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                                            <Briefcase className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium">No opportunity yet</div>
                                            <div className="text-xs text-muted-foreground">
                                                {contact.id !== 'new'
                                                    ? "Create one to track this contact through your pipeline."
                                                    : "Save the contact first, then create an opportunity."}
                                            </div>
                                        </div>
                                        {contact.id !== 'new' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="shrink-0 gap-1.5 h-8"
                                                onClick={onCreateOpportunity}
                                                disabled={isSaving}
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                {isSaving ? "Creating…" : "Create"}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {/* Quick contact-info chips — at-a-glance email + phone */}
                                {(selectedContact?.email || selectedContact?.phone) && (
                                    <div className="mt-4 flex items-center gap-2 flex-wrap text-xs">
                                        {selectedContact?.email && (
                                            <a
                                                href={`mailto:${selectedContact.email}`}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-card hover:bg-muted/40 hover:border-primary/30 transition-colors max-w-full min-w-0"
                                                title={selectedContact.email}
                                            >
                                                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <span className="truncate">{selectedContact.email}</span>
                                            </a>
                                        )}
                                        {selectedContact?.phone && (
                                            <a
                                                href={`tel:${selectedContact.phone}`}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-card hover:bg-muted/40 hover:border-primary/30 transition-colors"
                                                title="Call"
                                            >
                                                <Phone className="h-3 w-3 text-muted-foreground" />
                                                <span className="tabular-nums">{selectedContact.phone}</span>
                                            </a>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-4">
                                    <Button
                                        size="sm"
                                        className="flex-1 gap-1.5 shadow-sm"
                                        disabled={!selectedContact?.phone}
                                        onClick={() => selectedContact?.phone && window.open(`tel:${selectedContact.phone}`)}
                                        title={selectedContact?.phone || "No phone number"}
                                    >
                                        <Phone className="h-4 w-4" />
                                        Call
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 gap-1.5"
                                        disabled={!selectedContact?.email}
                                        onClick={() => selectedContact?.email && window.open(`mailto:${selectedContact.email}`)}
                                        title={selectedContact?.email || "No email address"}
                                    >
                                        <Mail className="h-4 w-4" />
                                        Email
                                    </Button>
                                    {bookingLink && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 gap-1.5"
                                            title={`Copy booking link: ${bookingLink}`}
                                            onClick={async () => {
                                                try {
                                                    await navigator.clipboard.writeText(bookingLink)
                                                    toast.success("Booking link copied")
                                                } catch {
                                                    toast.error("Couldn't copy — your browser blocked clipboard access")
                                                }
                                            }}
                                        >
                                            <CalendarDays className="h-4 w-4" />
                                            Booking link
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                <Tabs defaultValue="details" className="w-full h-full flex flex-col">
                                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 sm:px-6 h-12">
                                        <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 sm:px-4 h-full min-h-[44px] touch-manipulation">Details</TabsTrigger>
                                        <TabsTrigger value="notes" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 sm:px-4 h-full min-h-[44px] touch-manipulation">Notes</TabsTrigger>
                                        <TabsTrigger value="documents" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 sm:px-4 h-full min-h-[44px] touch-manipulation">Docs</TabsTrigger>
                                        <TabsTrigger value="timeline" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 sm:px-4 h-full min-h-[44px] touch-manipulation">Timeline</TabsTrigger>
                                    </TabsList>

                                    {/* Details Tab */}
                                    <TabsContent value="details" className="flex-1 p-4 sm:p-6 m-0 outline-none space-y-6 sm:space-y-8 overflow-y-auto">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contact Information</h3>
                                            </div>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                                <InlineField
                                                    label="Full Name"
                                                    value={editingContact?.name || ""}
                                                    onChange={(val) => {
                                                        setEditingContact((prev: any) => prev ? { ...prev, name: val } : null)
                                                        if (formErrors.name) setFormErrors(prev => { const next = {...prev}; delete next.name; return next })
                                                    }}
                                                    onBlurSave={handleValidatedSave}
                                                    error={formErrors.name}
                                                    colSpan
                                                />
                                                <div>
                                                    <InlineField
                                                        label="Email Address"
                                                        value={editingContact?.email || ""}
                                                        onChange={(val) => {
                                                            setEditingContact((prev: any) => prev ? { ...prev, email: val } : null)
                                                            if (formErrors.email) setFormErrors(prev => { const next = {...prev}; delete next.email; return next })
                                                        }}
                                                        onBlurSave={handleValidatedSave}
                                                        error={formErrors.email}
                                                    />
                                                    {editingContact?.id && editingContact.id !== "new" && editingContact?.email && (
                                                        <RequestReviewButton
                                                            contactId={editingContact.id}
                                                            onSent={() => onRefreshContact?.()}
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    <InlineField
                                                        label="Phone Number"
                                                        value={editingContact?.phone || ""}
                                                        onChange={(val) => {
                                                            setEditingContact((prev: any) => prev ? { ...prev, phone: val } : null)
                                                            if (formErrors.phone) setFormErrors(prev => { const next = {...prev}; delete next.phone; return next })
                                                        }}
                                                        onBlurSave={handleValidatedSave}
                                                        error={formErrors.phone}
                                                    />
                                                    {editingContact?.id && editingContact.id !== "new" && editingContact?.phone && (
                                                        <PhoneActions
                                                            contactId={editingContact.id}
                                                            phone={editingContact.phone}
                                                            onLogged={() => onRefreshContact?.()}
                                                        />
                                                    )}
                                                </div>
                                                <InlineField
                                                    label="Business Name"
                                                    value={editingContact?.businessName || ""}
                                                    onChange={(val) => setEditingContact((prev: any) => prev ? { ...prev, businessName: val } : null)}
                                                    onBlurSave={handleValidatedSave}
                                                    colSpan
                                                />
                                                <InlineField
                                                    label="Military Base"
                                                    value={editingContact?.militaryBase || ""}
                                                    onChange={(val) => setEditingContact((prev: any) => prev ? { ...prev, militaryBase: val } : null)}
                                                    onBlurSave={handleValidatedSave}
                                                    placeholder="e.g. Luke AFB"
                                                    colSpan
                                                />
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contact Status</h3>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <span className="text-muted-foreground text-xs">Status</span>
                                                    <select
                                                        value={editingContact?.status || (contactStatuses[0]?.name ?? "")}
                                                        onChange={(e) => setEditingContact((prev: any) => prev ? { ...prev, status: e.target.value } : null)}
                                                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {contactStatuses.length === 0 ? (
                                                            <>
                                                                <option value="Active Stay">Active Stay</option>
                                                                <option value="Lead">Lead</option>
                                                                <option value="Forms Pending">Forms Pending</option>
                                                                <option value="Booked">Booked</option>
                                                            </>
                                                        ) : (
                                                            contactStatuses.map((s) => (
                                                                <option key={s.id} value={s.name}>{s.name}</option>
                                                            ))
                                                        )}
                                                    </select>
                                                </div>
                                                <InlineField
                                                    label="Stay Start (optional)"
                                                    type="date"
                                                    value={editingContact?.stayStartDate?.split?.('T')?.[0] || editingContact?.stayStartDate || ""}
                                                    onChange={(val) => setEditingContact((prev: any) => prev ? { ...prev, stayStartDate: val || null } : null)}
                                                    onBlurSave={handleValidatedSave}
                                                />
                                                <InlineField
                                                    label="Stay End (optional)"
                                                    type="date"
                                                    value={editingContact?.stayEndDate?.split?.('T')?.[0] || editingContact?.stayEndDate || ""}
                                                    onChange={(val) => setEditingContact((prev: any) => prev ? { ...prev, stayEndDate: val || null } : null)}
                                                    onBlurSave={handleValidatedSave}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">Stay dates are used when creating an opportunity and will pre-fill the deal form.</p>
                                        </div>

                                        {/* Do Not Disturb */}
                                        <Separator />
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                Do not disturb
                                                {editingContact?.dndUntil && new Date(editingContact.dndUntil) > new Date() && (
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-500/10 text-rose-600 border-rose-500/20">
                                                        Active
                                                    </Badge>
                                                )}
                                            </h3>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <span className="text-muted-foreground text-xs">Quiet until</span>
                                                    <select
                                                        value={(() => {
                                                            const v = editingContact?.dndUntil
                                                            if (!v) return "off"
                                                            const d = new Date(v)
                                                            if (d <= new Date()) return "off"
                                                            return "custom"
                                                        })()}
                                                        onChange={(e) => {
                                                            const opt = e.target.value
                                                            const now = new Date()
                                                            let next: string | null = null
                                                            if (opt === "1h") next = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
                                                            else if (opt === "today") {
                                                                const eod = new Date(now)
                                                                eod.setHours(23, 59, 59, 999)
                                                                next = eod.toISOString()
                                                            }
                                                            else if (opt === "3d") next = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
                                                            else if (opt === "7d") next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
                                                            else if (opt === "off") next = null
                                                            else return // custom — leave existing value alone
                                                            setEditingContact((prev: any) => prev ? { ...prev, dndUntil: next } : null)
                                                        }}
                                                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                    >
                                                        <option value="off">Off</option>
                                                        <option value="1h">1 hour</option>
                                                        <option value="today">End of day</option>
                                                        <option value="3d">3 days</option>
                                                        <option value="7d">1 week</option>
                                                        <option value="custom">Custom…</option>
                                                    </select>
                                                </div>
                                                <InlineField
                                                    label="Or pick a date/time"
                                                    type="datetime-local"
                                                    value={(() => {
                                                        const v = editingContact?.dndUntil
                                                        if (!v) return ""
                                                        const d = new Date(v)
                                                        if (isNaN(d.getTime())) return ""
                                                        const pad = (n: number) => String(n).padStart(2, "0")
                                                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                                                    })()}
                                                    onChange={(val) => setEditingContact((prev: any) => prev ? { ...prev, dndUntil: val ? new Date(val).toISOString() : null } : null)}
                                                    onBlurSave={handleValidatedSave}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                When DND is active, the contact list shows a moon icon and bulk-message actions skip this contact. Manual messages still work.
                                            </p>
                                        </div>

                                        {/* Custom Fields */}
                                        <Separator />
                                        <CustomFieldsSection
                                            entityType="contact"
                                            values={editingContact?.customFields || {}}
                                            onChange={(fieldId, value) => {
                                                setEditingContact((prev: any) => prev ? {
                                                    ...prev,
                                                    customFields: { ...(prev.customFields || {}), [fieldId]: value },
                                                } : null)
                                            }}
                                        />

                                        {/* Related Contacts */}
                                        {selectedContact.id !== 'new' && (
                                            <>
                                                <Separator />
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                            <Users className="h-4 w-4" />
                                                            Related Contacts
                                                        </h3>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => setIsAddRelatedOpen(true)}
                                                        >
                                                            <Plus className="mr-1 h-3 w-3" />
                                                            Add
                                                        </Button>
                                                    </div>

                                                    {(selectedContact.relatedContacts?.length > 0) ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedContact.relatedContacts.map((rel: any) => (
                                                                <Badge
                                                                    key={rel.contactId}
                                                                    variant="secondary"
                                                                    className="gap-1.5 pl-2.5 pr-1.5 py-1 cursor-pointer hover:bg-secondary/80 group"
                                                                    onClick={() => router.push(`/contacts?contact=${rel.contactId}`)}
                                                                >
                                                                    <Link className="h-3 w-3 shrink-0" />
                                                                    <span className="text-xs">{rel.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground">({rel.relationship})</span>
                                                                    <button
                                                                        className="ml-0.5 hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleRemoveRelated(rel.contactId)
                                                                        }}
                                                                        disabled={isRemovingRelated === rel.contactId}
                                                                    >
                                                                        <XIcon className="h-3 w-3" />
                                                                    </button>
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">No related contacts linked yet.</p>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        <div className="pt-4 flex flex-col gap-3">
                                            {selectedContact.id !== 'new' && (
                                                <Button variant="outline" size="sm" onClick={onOpenTaskDialog}>
                                                    <ListTodo className="mr-2 h-4 w-4" />
                                                    Add Task for Contact
                                                </Button>
                                            )}
                                            {saveError && (
                                                <p className="text-sm text-destructive">{saveError}</p>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-muted-foreground">Click any field to edit. Changes save automatically.</p>
                                                <Button variant="outline" size="sm" onClick={handleValidatedSave} disabled={isSaving}>
                                                    {isSaving ? "Saving..." : "Save All"}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* Notes Tab */}
                                    <TabsContent value="notes" className="flex-1 p-4 lg:p-6 m-0 outline-none flex flex-col h-full bg-background">
                                        <NotesEditor
                                            notes={(selectedContact.notes ?? []).map((n: any) => ({
                                                id: n.id,
                                                content: n.content ?? "",
                                                authorName: n.authorName ?? null,
                                                authorId: n.authorId ?? null,
                                                mentions: n.mentions ?? [],
                                                createdAt: n.createdAt,
                                            }))}
                                            onAddNote={onAddNoteWithMentions}
                                            onEditNote={onEditNote ? async (noteId, content, mentions) => {
                                                await onEditNote(selectedContact.id, noteId, content, mentions)
                                            } : undefined}
                                            onDeleteNote={(noteId) => onDeleteNote(selectedContact.id, noteId)}
                                            users={users}
                                            placeholder="Type a note... Use @ to mention a team member"
                                        />
                                    </TabsContent>

                                    {/* Documents Tab */}
                                    <TabsContent value="documents" className="flex-1 p-4 lg:p-6 m-0 outline-none space-y-6 overflow-y-auto">
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Required Agreements</h3>
                                            <p className="text-xs text-muted-foreground">Track the status of the three mandatory forms required for booking.</p>

                                            <div className="space-y-3 mt-4">
                                                {[
                                                    { label: "Homeowner Lease", field: "homeownerLeaseSigned" },
                                                    { label: "AF Crashpad Terms & Conditions", field: "termsConditionsSigned" },
                                                    { label: "Payment Authorization Form", field: "paymentAuthSigned" }
                                                ].map((doc) => (
                                                    <div key={doc.field} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${selectedContact.formTracking?.[doc.field] ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                                                                <FileText className={`h-4 w-4 ${selectedContact.formTracking?.[doc.field] ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                                                            </div>
                                                            <span className="text-sm font-medium">{doc.label}</span>
                                                        </div>
                                                        <Checkbox
                                                            checked={selectedContact.formTracking?.[doc.field] || false}
                                                            onCheckedChange={(checked) => onToggleForm(doc.field, !!checked)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <Separator />

                                        <DocumentManager contactId={selectedContact.id} />
                                    </TabsContent>

                                    {/* Timeline Tab */}
                                    <TabsContent value="timeline" className="flex-1 p-4 lg:p-6 m-0 outline-none overflow-y-auto">
                                        <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border before:to-transparent">
                                            {(() => {
                                                const messages = selectedContact.messages ?? []
                                                const notes = selectedContact.notes ?? []
                                                const timelineEvents = selectedContact.timelineEvents ?? []
                                                const activities = (selectedContact as any).activities ?? []
                                                const merged: { id: string; type: 'message' | 'note' | 'note_deleted' | 'activity' | 'call'; createdAt: string; data: any }[] = [
                                                    ...messages.map((m: any) => ({ id: `msg-${m.id}`, type: 'message' as const, createdAt: m.createdAt ?? '', data: m })),
                                                    ...notes.map((n: any) => ({ id: `note-${n.id}`, type: 'note' as const, createdAt: n.createdAt ?? '', data: n })),
                                                    ...timelineEvents.filter((e: any) => e.type === 'note_deleted').map((e: any) => ({ id: `ev-${e.id}`, type: 'note_deleted' as const, createdAt: e.createdAt ?? '', data: e })),
                                                    ...timelineEvents.filter((e: any) => e.type === 'call').map((e: any) => ({ id: `call-${e.id}`, type: 'call' as const, createdAt: e.createdAt ?? '', data: e })),
                                                    ...activities.map((a: any) => ({ id: `act-${a.id}`, type: 'activity' as const, createdAt: a.createdAt ?? '', data: a })),
                                                ]
                                                merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

                                                if (merged.length === 0) {
                                                    return <div className="ml-12 lg:ml-14 py-8 text-sm text-muted-foreground">No timeline activity yet.</div>
                                                }

                                                return merged.map((item) => {
                                                    if (item.type === 'message') {
                                                        const msg = item.data
                                                        return (
                                                            <div key={item.id} className="relative flex items-center gap-4">
                                                                <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm z-10">
                                                                    {msg.type === "EMAIL" && <Mail className="h-4 w-4 text-blue-500" />}
                                                                    {msg.type === "SMS" && <MessageSquare className="h-4 w-4 text-emerald-500" />}
                                                                    {msg.type === "CALL" && <Phone className="h-4 w-4 text-amber-500" />}
                                                                </div>
                                                                <div className="ml-12 lg:ml-14 flex-1 space-y-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-bold">
                                                                            {msg.direction === "INBOUND" ? "Received " : "Sent "}
                                                                            {(msg.type || "").toLowerCase()}
                                                                        </span>
                                                                        <span className="text-xs text-muted-foreground tabular-nums">
                                                                            {new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                                        </span>
                                                                    </div>
                                                                    <div className="p-3 rounded-xl border bg-muted/30 text-sm text-muted-foreground leading-relaxed">
                                                                        {msg.content}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    }
                                                    if (item.type === 'note') {
                                                        const note = item.data
                                                        return (
                                                            <div key={item.id} className="relative flex items-center gap-4">
                                                                <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm z-10">
                                                                    <FileText className="h-4 w-4 text-primary" />
                                                                </div>
                                                                <div className="ml-12 lg:ml-14 flex-1 space-y-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-bold">Internal note</span>
                                                                        <span className="text-xs text-muted-foreground tabular-nums">
                                                                            {new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                                        </span>
                                                                    </div>
                                                                    <div className="p-3 rounded-xl border bg-muted/30 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                                                                        {note.content}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    }
                                                    if (item.type === 'activity') {
                                                        const act = item.data
                                                        const isEmailEvent = typeof act.type === 'string' && act.type.startsWith('email_')
                                                        const isSocialEvent = typeof act.type === 'string' && act.type.startsWith('social_')
                                                        const icon = act.type === 'email_bounced'
                                                            ? <AlertTriangle className="h-4 w-4 text-red-500" />
                                                            : act.type === 'email_opened'
                                                            ? <Eye className="h-4 w-4 text-emerald-500" />
                                                            : act.type === 'email_clicked'
                                                            ? <MousePointerClick className="h-4 w-4 text-emerald-600" />
                                                            : isEmailEvent
                                                            ? <Send className="h-4 w-4 text-blue-500" />
                                                            : isSocialEvent
                                                            ? <Share2 className="h-4 w-4 text-purple-500" />
                                                            : <FileText className="h-4 w-4 text-primary" />
                                                        const typeLabel = String(act.type || 'activity').replace(/_/g, ' ')
                                                        return (
                                                            <div key={item.id} className="relative flex items-center gap-4">
                                                                <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm z-10">
                                                                    {icon}
                                                                </div>
                                                                <div className="ml-12 lg:ml-14 flex-1 space-y-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-bold capitalize">
                                                                            {typeLabel}
                                                                        </span>
                                                                        <span className="text-xs text-muted-foreground tabular-nums">
                                                                            {act.createdAt ? new Date(act.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
                                                                        </span>
                                                                    </div>
                                                                    <div className="p-3 rounded-xl border bg-muted/30 text-sm text-muted-foreground leading-relaxed">
                                                                        <div>{act.subject}</div>
                                                                        {act.body && (
                                                                            <div className="mt-1 text-xs opacity-80 whitespace-pre-line">{act.body}</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    }
                                                    if (item.type === 'call') {
                                                        const c = item.data
                                                        const outcomeLabel: Record<string, string> = {
                                                            connected: "Connected",
                                                            voicemail: "Voicemail",
                                                            no_answer: "No answer",
                                                            wrong_number: "Wrong number",
                                                        }
                                                        return (
                                                            <div key={item.id} className="relative flex items-center gap-4">
                                                                <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm z-10">
                                                                    <Phone className="h-4 w-4 text-amber-500" />
                                                                </div>
                                                                <div className="ml-12 lg:ml-14 flex-1 space-y-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-bold capitalize">
                                                                            {c.direction === "inbound" ? "Inbound call" : "Outbound call"}
                                                                            <span className="text-muted-foreground font-normal"> · {outcomeLabel[c.outcome] || c.outcome}</span>
                                                                            {typeof c.durationMinutes === "number" && c.durationMinutes > 0 && (
                                                                                <span className="text-muted-foreground font-normal"> · {c.durationMinutes}m</span>
                                                                            )}
                                                                        </span>
                                                                        <span className="text-xs text-muted-foreground tabular-nums">
                                                                            {new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                                        </span>
                                                                    </div>
                                                                    {c.notes && (
                                                                        <div className="p-3 rounded-xl border bg-muted/30 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                                                                            {c.notes}
                                                                        </div>
                                                                    )}
                                                                    {c.loggedByName && (
                                                                        <div className="text-[10px] text-muted-foreground/60">Logged by {c.loggedByName}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    }
                                                    const ev = item.data
                                                    return (
                                                        <div key={item.id} className="relative flex items-center gap-4">
                                                            <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm z-10">
                                                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="ml-12 lg:ml-14 flex-1 space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-bold text-muted-foreground">
                                                                        Note deleted{ev.deletedBy ? ` by ${ev.deletedBy}` : ""}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground tabular-nums">
                                                                        {new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                                    </span>
                                                                </div>
                                                                <div className="p-3 rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground italic">
                                                                    {ev.contentPreview ? `"${ev.contentPreview}"` : "A note was removed."}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            })()}

                                            <Separator className="my-6" />

                                            <div className="ml-12 lg:ml-14 space-y-4">
                                                <h4 className="text-sm font-semibold">Log communication</h4>
                                                <p className="text-xs text-muted-foreground">Record an email or SMS you sent to this contact.</p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant={logMessageType === "EMAIL" ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setLogMessageType("EMAIL")}
                                                    >
                                                        <Mail className="h-4 w-4 mr-1" />
                                                        Email
                                                    </Button>
                                                    <Button
                                                        variant={logMessageType === "SMS" ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setLogMessageType("SMS")}
                                                    >
                                                        <MessageSquare className="h-4 w-4 mr-1" />
                                                        SMS
                                                    </Button>
                                                </div>
                                                <textarea
                                                    placeholder="What did you send? Summary or full message..."
                                                    className="w-full min-h-[80px] p-3 rounded-lg border bg-background text-sm resize-none"
                                                    value={logMessageContent}
                                                    onChange={(e) => setLogMessageContent(e.target.value)}
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={onLogMessage}
                                                    disabled={isLoggingMessage || !logMessageContent.trim()}
                                                >
                                                    {isLoggingMessage ? "Logging..." : "Log to Timeline"}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </>
                    )
                })()}
            </SheetContent>

            {/* Add Related Contact Dialog */}
            <Dialog open={isAddRelatedOpen} onOpenChange={setIsAddRelatedOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Add Related Contact
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Relationship Type
                            </label>
                            <select
                                value={relatedRelationship}
                                onChange={(e) => setRelatedRelationship(e.target.value)}
                                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="Spouse">Spouse</option>
                                <option value="Referrer">Referrer</option>
                                <option value="Roommate">Roommate</option>
                                <option value="Coworker">Coworker</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Search Contact
                            </label>
                            <Input
                                value={relatedSearchTerm}
                                onChange={(e) => setRelatedSearchTerm(e.target.value)}
                                placeholder="Type a name or email..."
                                className="h-8 text-sm"
                            />
                        </div>

                        <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                            {(() => {
                                if (!allContacts || !relatedSearchTerm.trim()) {
                                    return (
                                        <div className="p-4 text-center text-xs text-muted-foreground">
                                            {!allContacts ? "Contact list not available" : "Type to search contacts..."}
                                        </div>
                                    )
                                }

                                const existing = new Set((selectedContact?.relatedContacts || []).map((r: any) => r.contactId))
                                const term = relatedSearchTerm.toLowerCase()
                                const filtered = allContacts.filter(c =>
                                    c.id !== selectedContact?.id &&
                                    !existing.has(c.id) &&
                                    (c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term))
                                ).slice(0, 10)

                                if (filtered.length === 0) {
                                    return (
                                        <div className="p-4 text-center text-xs text-muted-foreground">
                                            No matching contacts found.
                                        </div>
                                    )
                                }

                                return (
                                    <div className="divide-y">
                                        {filtered.map(c => (
                                            <button
                                                key={c.id}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                                                onClick={() => handleAddRelated(c.id)}
                                                disabled={isAddingRelated}
                                            >
                                                <Avatar className="h-7 w-7 shrink-0">
                                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                        {c.name.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{c.name}</p>
                                                    {c.email && (
                                                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )
                            })()}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsAddRelatedOpen(false)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Sheet>
    )
}
