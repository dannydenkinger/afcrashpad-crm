"use client"

import { useState, useEffect, useRef, useCallback, Suspense, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Phone, Mail, MoreVertical, Search, Filter, Plus, ChevronRight, LayoutGrid,
    List as ListIcon, Calendar as CalendarIcon, ArrowUp, ArrowDown, Calculator,
    Send, FileText, MessageSquare, Clock, CheckCircle, Upload, Trash2, ListTodo,
    ChevronDown, ChevronUp, Briefcase, ExternalLink, Download, Merge, Bookmark, X, Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getContacts, getContactsPaginated, getContactDetail, createNote, deleteNote, updateContact, updateFormTracking, bulkCreateContacts, createContact, deleteContact, bulkDeleteContacts, bulkUpdateContactStatus, bulkAddTag, mergeContacts, findDuplicateContacts, softDeleteContact, restoreContact, permanentlyDeleteContact, bulkSoftDeleteContacts, bulkRestoreContacts, bulkPermanentlyDeleteContacts } from "./actions"
import { sendMessage } from "@/app/communications/actions"
import { getContactStatuses } from "@/app/settings/system-properties/actions"
import { getTags } from "@/app/settings/tags/actions"
import { createNewDeal, getUsers } from "@/app/pipeline/actions"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { CreateTaskDialog } from "@/components/ui/CreateTaskDialog"
import { DocumentManager } from "./documents/DocumentManager"
import { ContactDetailSheet } from "./ContactDetailSheet"
import { DuplicateDetector } from "./DuplicateDetector"
import { exportToCSV } from "@/lib/export"
import dynamic from "next/dynamic"

// Lazy-loaded heavy components (only shown on user action)
const CSVImportDialog = dynamic(() => import("@/components/ui/CSVImportDialog").then(mod => mod.CSVImportDialog), {
    loading: () => null,
    ssr: false,
})
const ContactMergeDialog = dynamic(() => import("./ContactMergeDialog").then(mod => mod.ContactMergeDialog), {
    loading: () => null,
    ssr: false,
})
const BulkEmailDialog = dynamic(() => import("./BulkEmailDialog").then(mod => mod.BulkEmailDialog), {
    loading: () => null,
    ssr: false,
})
const ImportMappingDialog = dynamic(() => import("./ImportMappingDialog").then(mod => mod.ImportMappingDialog), {
    loading: () => null,
    ssr: false,
})
import { toast } from "sonner"
import { VirtualList } from "@/components/ui/VirtualList"
import { ContactsVirtualTable } from "./ContactsVirtualTable"
import { getSavedViews, createSavedView, deleteSavedView } from "@/app/saved-views/actions"
import { withRetryAction } from "@/lib/retry"
import { useRealtimeRefreshOnChange } from "@/hooks/useRealtimeCollection"

type ColumnId = 'name' | 'phone' | 'email' | 'businessName' | 'status' | 'opportunity' | 'lastActivity' | 'created' | 'tags' | 'lastNote';

interface ColumnDef {
    id: ColumnId;
    label: string;
    visible: boolean;
    width: number;
}

const defaultColumns: ColumnDef[] = [
    { id: 'name', label: 'Contact Name', visible: true, width: 220 },
    { id: 'phone', label: 'Phone', visible: true, width: 140 },
    { id: 'email', label: 'Email', visible: true, width: 220 },
    { id: 'businessName', label: 'Business Name', visible: true, width: 160 },
    { id: 'status', label: 'Status', visible: true, width: 120 },
    { id: 'opportunity', label: 'Opportunity', visible: true, width: 200 },
    { id: 'lastActivity', label: 'Last Activity (CST)', visible: true, width: 160 },
    { id: 'created', label: 'Created (CST)', visible: true, width: 160 },
    { id: 'tags', label: 'Tags', visible: true, width: 180 },
    { id: 'lastNote', label: 'Last Note', visible: true, width: 300 },
];

// Contacts data will be fetched from the database


export default function ContactsPage() {
    return (
        <Suspense fallback={<div className="p-8">Loading contacts...</div>}>
            <ContactsContent />
        </Suspense>
    )
}

function ContactsContent() {
    const router = useRouter();
    const [allContacts, setAllContacts] = useState<any[]>([])
    const [selectedContact, setSelectedContact] = useState<any>(null)
    const [editingContact, setEditingContact] = useState<any>(null);
    const [columns, setColumns] = useState(defaultColumns)
    const [resizingCol, setResizingCol] = useState<ColumnId | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [noteContent, setNoteContent] = useState("");
    const [isSavingNote, setIsSavingNote] = useState(false);

    // Filter and Sort State
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [tagFilter, setTagFilter] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: ColumnId | 'dealValue'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
    const [contactToDelete, setContactToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [logMessageType, setLogMessageType] = useState<"EMAIL" | "SMS">("EMAIL");
    const [logMessageContent, setLogMessageContent] = useState("");
    const [isLoggingMessage, setIsLoggingMessage] = useState(false);
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
    const [contactStatuses, setContactStatuses] = useState<{ id: string; name: string }[]>([]);
    const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
    const [noteToDelete, setNoteToDelete] = useState<{ contactId: string; noteId: string } | null>(null);
    const [isDeletingNote, setIsDeletingNote] = useState(false);
    const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [mergeFieldChoices, setMergeFieldChoices] = useState<Record<string, string>>({});
    const [availableTags, setAvailableTags] = useState<{ id: string; name: string; color: string }[]>([]);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
    const [isBulkEmailOpen, setIsBulkEmailOpen] = useState(false);
    const [isImportMappingOpen, setIsImportMappingOpen] = useState(false);
    const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
    const [dedicatedMergeOpen, setDedicatedMergeOpen] = useState(false);
    const [mergeContactA, setMergeContactA] = useState<any>(null);
    const [mergeContactB, setMergeContactB] = useState<any>(null);

    // Pagination state
    const [lastDocId, setLastDocId] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    // Saved filters
    type SavedFilter = { id?: string; name: string; searchTerm: string; statusFilter: string[]; sortKey: string; sortDir: string };
    const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
    const [filterNameInput, setFilterNameInput] = useState("");
    const [showSaveFilter, setShowSaveFilter] = useState(false);

    // Restore filter state + saved presets from localStorage on mount, then sync Firestore
    useEffect(() => {
        try {
            const saved = localStorage.getItem("contacts-saved-filters");
            if (saved) setSavedFilters(JSON.parse(saved));
            const lastFilter = localStorage.getItem("contacts-last-filter");
            if (lastFilter) {
                const f = JSON.parse(lastFilter);
                if (f.searchTerm) setSearchTerm(f.searchTerm);
                if (f.statusFilter?.length) setStatusFilter(f.statusFilter);
                if (f.sortKey) setSortConfig({ key: f.sortKey, direction: f.sortDir || "asc" });
            }
        } catch { /* ignore corrupt localStorage */ }
        // Sync from Firestore
        getSavedViews("contacts").then((res) => {
            if (res.success && res.views && res.views.length > 0) {
                const firestoreFilters: SavedFilter[] = res.views.map((v: any) => {
                    const f = typeof v.filters === "string" ? JSON.parse(v.filters) : v.filters;
                    return { id: v.id, name: v.name, ...f };
                });
                setSavedFilters(firestoreFilters);
                localStorage.setItem("contacts-saved-filters", JSON.stringify(firestoreFilters));
            }
        }).catch(() => {});
    }, []);

    // Persist filter state to localStorage on change (debounced)
    const filterPersistTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => {
        clearTimeout(filterPersistTimer.current);
        filterPersistTimer.current = setTimeout(() => {
            try {
                localStorage.setItem("contacts-last-filter", JSON.stringify({
                    searchTerm, statusFilter, sortKey: sortConfig.key, sortDir: sortConfig.direction,
                }));
            } catch { /* ignore */ }
        }, 500);
    }, [searchTerm, statusFilter, sortConfig]);

    const handleSaveFilter = useCallback(async () => {
        if (!filterNameInput.trim()) return;
        const filterData = { searchTerm, statusFilter, sortKey: sortConfig.key, sortDir: sortConfig.direction };
        const preset: SavedFilter = { name: filterNameInput.trim(), ...filterData };

        // Save to Firestore
        createSavedView({ page: "contacts", name: preset.name, filters: filterData }).then((res) => {
            if (res.success && res.id) {
                preset.id = res.id;
            }
        }).catch(() => {});

        const updated = [...savedFilters.filter(f => f.name !== preset.name), preset].slice(-10);
        setSavedFilters(updated);
        localStorage.setItem("contacts-saved-filters", JSON.stringify(updated));
        setFilterNameInput("");
        setShowSaveFilter(false);
    }, [filterNameInput, searchTerm, statusFilter, sortConfig, savedFilters]);

    const handleApplyFilter = useCallback((f: SavedFilter) => {
        setSearchTerm(f.searchTerm);
        setStatusFilter(f.statusFilter);
        setSortConfig({ key: f.sortKey as ColumnId, direction: f.sortDir as "asc" | "desc" });
    }, []);

    const handleDeleteFilter = useCallback((name: string) => {
        const filter = savedFilters.find(f => f.name === name);
        if (filter?.id) {
            deleteSavedView(filter.id).catch(() => {});
        }
        const updated = savedFilters.filter(f => f.name !== name);
        setSavedFilters(updated);
        localStorage.setItem("contacts-saved-filters", JSON.stringify(updated));
    }, [savedFilters]);

    const fetchContactStatuses = async () => {
        const res = await getContactStatuses();
        if (res.success && res.items) setContactStatuses(res.items as { id: string; name: string }[]);
    };

    const fetchTags = async () => {
        const res = await getTags();
        if (res.success && res.tags) setAvailableTags(res.tags as { id: string; name: string; color: string }[]);
    };

    const mapContact = useCallback((c: any) => ({
        ...c,
        dealName: c.opportunities?.[0]?.name || "No Deal",
        dealValue: c.opportunities?.[0]?.opportunityValue || 0,
        dealStage: c.opportunities?.[0]?.stageName || "---",
        created: new Date(c.createdAt).toLocaleString(),
        lastActivity: new Date(c.updatedAt).toLocaleString(),
        lastNote: c.notes?.[0]?.content || "No notes",
        tags: [] as string[]
    }), []);

    const fetchAllContacts = async () => {
        setIsLoading(true);
        const res = await getContactsPaginated({ limit: 50 });
        if (res.success && res.contacts) {
            setAllContacts(res.contacts.map(mapContact));
            setLastDocId(res.lastDocId ?? null);
            setHasMore(res.hasMore ?? false);
        }
        setIsLoading(false);
    };

    const loadMoreContacts = useCallback(async () => {
        if (isLoadingMore || !hasMore || !lastDocId) return;
        setIsLoadingMore(true);
        const res = await getContactsPaginated({ limit: 25, lastDocId });
        if (res.success && res.contacts) {
            setAllContacts(prev => [...prev, ...res.contacts.map(mapContact)]);
            setLastDocId(res.lastDocId ?? null);
            setHasMore(res.hasMore ?? false);
        }
        setIsLoadingMore(false);
    }, [isLoadingMore, hasMore, lastDocId, mapContact]);

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        const el = loadMoreRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
                    loadMoreContacts();
                }
            },
            { rootMargin: "200px" }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, loadMoreContacts]);

    useEffect(() => {
        fetchAllContacts();
    }, []);

    // Real-time: refetch when contacts collection changes in Firestore
    useRealtimeRefreshOnChange("contacts", () => {
        fetchAllContacts();
    });

    useEffect(() => {
        fetchContactStatuses();
        fetchTags();
        getUsers().then(res => { if (res.success) setAllUsers((res.users || []) as { id: string; name: string; email: string }[]); });
    }, []);

    // Auto-select contact from ?contact= URL param
    const searchParams = useSearchParams();
    useEffect(() => {
        const contactId = searchParams.get("contact");
        if (contactId && allContacts.length > 0) {
            const found = allContacts.find((c: any) => c.id === contactId);
            if (found) {
                handleSelectContact(found);
            }
        }
    }, [searchParams, allContacts]);

    const handleSelectContact = useCallback(async (contact: { id: string }) => {
        setIsLoading(true);
        const res = await getContactDetail(contact.id);
        if (res.success) {
            setSelectedContact(res.contact);
            setEditingContact(res.contact);
        }
        setIsLoading(false);
    }, []);

    const handleLogMessage = async () => {
        if (!selectedContact || selectedContact.id === 'new' || !logMessageContent.trim()) return;
        setIsLoggingMessage(true);
        const res = await sendMessage(selectedContact.id, logMessageType, logMessageContent.trim());
        if (res.success) {
            toast.success("Message sent")
            setLogMessageContent("");
            const detailRes = await getContactDetail(selectedContact.id);
            if (detailRes.success) {
                setSelectedContact(detailRes.contact);
            }
        } else {
            toast.error("Failed to send message")
        }
        setIsLoggingMessage(false);
    };

    const handleAddNote = async () => {
        if (!noteContent.trim() || !selectedContact) return;
        setIsSavingNote(true);
        const res = await createNote(selectedContact.id, noteContent);
        if (res.success) {
            toast.success("Note added")
            setNoteContent("");
            // Refresh detailed contact to show new note
            const detailRes = await getContactDetail(selectedContact.id);
            if (detailRes.success) {
                setSelectedContact(detailRes.contact);
            }
            // Update list view too
            fetchAllContacts();
        } else {
            toast.error("Failed to add note")
        }
        setIsSavingNote(false);
    };

    const handleAddNoteWithMentions = async (content: string, mentions: { userId: string; userName: string }[]) => {
        if (!content.trim() || !selectedContact) return;
        const res = await createNote(selectedContact.id, content, { mentions });
        if (res.success) {
            toast.success("Note added")
            const detailRes = await getContactDetail(selectedContact.id);
            if (detailRes.success) {
                setSelectedContact(detailRes.contact);
            }
            fetchAllContacts();
        } else {
            toast.error("Failed to add note")
        }
    };

    const toggleNoteExpanded = (noteId: string) => {
        setExpandedNoteIds(prev => {
            const next = new Set(prev);
            if (next.has(noteId)) next.delete(noteId);
            else next.add(noteId);
            return next;
        });
    };

    const handleDeleteNote = async () => {
        if (!noteToDelete) return;
        setIsDeletingNote(true);
        const res = await deleteNote(noteToDelete.contactId, noteToDelete.noteId);
        if (res.success) {
            toast.success("Note deleted")
            if (selectedContact?.id === noteToDelete.contactId) {
                const detailRes = await getContactDetail(noteToDelete.contactId);
                if (detailRes.success) setSelectedContact(detailRes.contact);
                fetchAllContacts();
            }
        } else {
            toast.error("Failed to delete note")
        }
        setNoteToDelete(null);
        setIsDeletingNote(false);
    };

    const toggleSelectContact = useCallback((id: string) => {
        setSelectedContactIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAll = () => {
        if (selectedContactIds.size === filteredAndSortedContacts.length) {
            setSelectedContactIds(new Set());
        } else {
            setSelectedContactIds(new Set(filteredAndSortedContacts.map((c: any) => c.id)));
        }
    };

    const handleDeleteContact = async (id: string) => {
        if (id === 'new') return;

        // Optimistic UI - remove contact from list instantly
        setAllContacts(prev => prev.filter(c => c.id !== id));
        setSelectedContact(null);
        setSelectedContactIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        setContactToDelete(null);

        const res = await softDeleteContact(id);
        if (!res.success) {
            toast.error("Failed to delete contact");
            fetchAllContacts();
            return;
        }

        toast("Contact deleted", {
            duration: 10000,
            action: {
                label: "Undo",
                onClick: async () => {
                    const undoRes = await restoreContact(id);
                    if (undoRes.success) {
                        toast.success("Contact restored");
                        fetchAllContacts();
                    } else {
                        toast.error("Failed to restore contact");
                    }
                },
            },
            onDismiss: () => { permanentlyDeleteContact(id).catch(() => {}); },
            onAutoClose: () => { permanentlyDeleteContact(id).catch(() => {}); },
        });
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedContactIds);
        if (ids.length === 0) return;
        const idsSet = new Set(ids);

        // Optimistic UI - remove contacts from list instantly
        setAllContacts(prev => prev.filter(c => !idsSet.has(c.id)));
        setSelectedContactIds(new Set());
        setSelectedContact(null);
        setContactToDelete(null);

        const res = await bulkSoftDeleteContacts(ids);
        if (!res.success) {
            toast.error("Failed to delete contacts");
            setSaveError((res as { error?: string }).error || "Failed to delete contacts");
            fetchAllContacts();
            return;
        }

        toast(`${ids.length} contact${ids.length !== 1 ? 's' : ''} deleted`, {
            duration: 10000,
            action: {
                label: "Undo",
                onClick: async () => {
                    const undoRes = await bulkRestoreContacts(ids);
                    if (undoRes.success) {
                        toast.success("Contacts restored");
                        fetchAllContacts();
                    } else {
                        toast.error("Failed to restore contacts");
                    }
                },
            },
            onDismiss: () => { bulkPermanentlyDeleteContacts(ids).catch(() => {}); },
            onAutoClose: () => { bulkPermanentlyDeleteContacts(ids).catch(() => {}); },
        });
    };

    const handleBulkStatusChange = async (status: string) => {
        const ids = Array.from(selectedContactIds);
        if (ids.length === 0) return;
        setIsBulkUpdating(true);
        const res = await bulkUpdateContactStatus(ids, status);
        setIsBulkUpdating(false);
        // Snapshot previous statuses for undo
        const prevStatuses = new Map<string, string>(
            ids.map(id => {
                const contact = allContacts.find(c => c.id === id);
                return [id, contact?.status || "Lead"];
            })
        );

        // Optimistic UI
        setAllContacts(prev => prev.map(c =>
            ids.includes(c.id) ? { ...c, status } : c
        ));
        setSelectedContactIds(new Set());

        if (res.success) {
            toast(`Status updated to "${status}" for ${ids.length} contact${ids.length !== 1 ? 's' : ''}`, {
                duration: 10000,
                action: {
                    label: "Undo",
                    onClick: async () => {
                        for (const [id, prev] of prevStatuses) {
                            await bulkUpdateContactStatus([id], prev);
                        }
                        toast.success("Status change undone");
                        fetchAllContacts();
                    },
                },
            });
        } else {
            toast.error("Failed to update contact statuses");
            fetchAllContacts();
        }
    };

    const handleBulkAddTag = async (tagId: string) => {
        const ids = Array.from(selectedContactIds);
        if (ids.length === 0) return;
        const tagName = availableTags.find(t => t.id === tagId)?.name || "Tag";
        setSelectedContactIds(new Set());
        setIsBulkUpdating(true);
        const res = await bulkAddTag(ids, tagId);
        setIsBulkUpdating(false);
        if (res.success) {
            toast(`Tag "${tagName}" added to ${ids.length} contact${ids.length !== 1 ? 's' : ''}`, {
                duration: 10000,
                action: {
                    label: "Undo",
                    onClick: () => {
                        fetchAllContacts();
                        toast.info("Please remove tags manually if needed");
                    },
                },
            });
            fetchAllContacts();
        } else {
            toast.error("Failed to add tag to contacts");
        }
    };

    const handleAddContactClick = () => {
        const newContactTemplate = {
            id: 'new',
            name: 'New Contact',
            email: '',
            phone: '',
            businessName: '',
            militaryBase: '',
            status: 'Lead',
            opportunities: [],
            notes: [],
            formTracking: {}
        };
        setSelectedContact(newContactTemplate);
        setEditingContact(newContactTemplate);
    };

    const handleMergeWith = useCallback(async (duplicateId: string) => {
        if (!selectedContact) return;
        // Load full details for both contacts for the merge dialog
        const [resA, resB] = await Promise.all([
            getContactDetail(selectedContact.id),
            getContactDetail(duplicateId),
        ]);
        if (resA.success && resB.success) {
            setMergeContactA(resA.contact);
            setMergeContactB(resB.contact);
            setDedicatedMergeOpen(true);
        } else {
            toast.error("Failed to load contact details for merge");
        }
    }, [selectedContact]);

    const handleRefreshContact = useCallback(async () => {
        if (!selectedContact || selectedContact.id === 'new') return;
        const res = await getContactDetail(selectedContact.id);
        if (res.success) {
            setSelectedContact(res.contact);
            setEditingContact(res.contact);
        }
    }, [selectedContact]);

    const handleCreateOpportunity = async () => {
        if (!selectedContact || selectedContact.id === 'new') return;
        setIsSaving(true);
        setSaveError(null);
        const res = await createNewDeal({
            contactId: selectedContact.id,
            name: selectedContact.name,
            email: selectedContact.email,
            phone: selectedContact.phone,
            base: selectedContact.militaryBase,
            startDate: selectedContact.stayStartDate || '',
            endDate: selectedContact.stayEndDate || ''
        });

        if (res.success && res.dealId) {
            toast.success("Opportunity created")
            window.location.href = `/pipeline?deal=${res.dealId}`;
        } else {
            toast.error("Failed to create opportunity")
            setSaveError((res as { error?: string }).error || "Failed to create opportunity");
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!editingContact) return;
        setIsSaving(true);
        setSaveError(null);

        const retryOpts = { onRetry: (attempt: number) => toast.info(`Retrying save... (attempt ${attempt + 1}/4)`, { id: "retry-toast", duration: 2000 }) };
        try {
            if (editingContact.id === 'new') {
                const res = await withRetryAction(
                    () => createContact({
                        name: editingContact.name,
                        email: editingContact.email,
                        phone: editingContact.phone,
                        militaryBase: editingContact.militaryBase,
                        businessName: editingContact.businessName,
                        status: editingContact.status || 'Lead',
                        stayStartDate: editingContact.stayStartDate || null,
                        stayEndDate: editingContact.stayEndDate || null
                    }),
                    retryOpts
                );
                toast.success("Contact created")
                await fetchAllContacts();
                const detailRes = await getContactDetail((res as any).id);
                if (detailRes.success) {
                    setSelectedContact(detailRes.contact);
                    setEditingContact(detailRes.contact);
                } else {
                    setSelectedContact(null);
                }
            } else {
                await withRetryAction(
                    () => updateContact(editingContact.id, {
                        name: editingContact.name,
                        email: editingContact.email,
                        phone: editingContact.phone,
                        militaryBase: editingContact.militaryBase,
                        businessName: editingContact.businessName,
                        status: editingContact.status || 'Lead',
                        stayStartDate: editingContact.stayStartDate || null,
                        stayEndDate: editingContact.stayEndDate || null
                    }),
                    retryOpts
                );
                toast.success("Contact saved")
                const detailRes = await getContactDetail(editingContact.id);
                if (detailRes.success) {
                    setSelectedContact(detailRes.contact);
                    setEditingContact(detailRes.contact);
                }
                fetchAllContacts();
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Operation failed";
            toast.error(editingContact.id === 'new' ? "Failed to create contact" : "Failed to save contact")
            setSaveError(msg);
        }
        setIsSaving(false);
    };

    const handleToggleForm = async (field: string, value: boolean) => {
        if (!selectedContact) return;
        const res = await updateFormTracking(selectedContact.id, { [field]: value });
        if (res.success) {
            // Refresh detailed contact to show updated tracking
            const detailRes = await getContactDetail(selectedContact.id);
            if (detailRes.success) {
                setSelectedContact(detailRes.contact);
            }
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsMounted(true);
            const saved = localStorage.getItem('contacts-columns-config');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const mergedColumns = parsed.map((savedCol: unknown) => {
                            const sCol = savedCol as ColumnDef;
                            const defaultCol = defaultColumns.find(dc => dc.id === sCol.id);
                            return defaultCol ? { ...defaultCol, ...sCol } : sCol;
                        }).filter(Boolean);

                        const existingIds = new Set(mergedColumns.map((c) => (c as ColumnDef).id));
                        defaultColumns.forEach(dc => {
                            if (!existingIds.has(dc.id)) {
                                mergedColumns.push(dc);
                            }
                        });

                        setColumns(mergedColumns);
                    }
                } catch (e) {
                    console.error("Failed to parse column config from localStorage", e);
                }
            }
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (isMounted) {
            const saveTimeout = setTimeout(() => {
                localStorage.setItem('contacts-columns-config', JSON.stringify(columns));
            }, 10);
            return () => clearTimeout(saveTimeout);
        }
    }, [columns, isMounted]);

    const handleResizeStart = (e: React.MouseEvent, col: ColumnDef) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startWidth = col.width;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const diff = moveEvent.clientX - startX;
            setColumns(prev => prev.map(c =>
                c.id === col.id ? { ...c, width: Math.max(50, startWidth + diff) } : c
            ));
        };

        const handleMouseUp = () => {
            setResizingCol(null);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        setResizingCol(col.id);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const toggleColumn = (id: ColumnId) => {
        setColumns(cols => cols.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
    }

    const moveColumn = (index: number, direction: 'up' | 'down') => {
        setColumns(cols => {
            const newCols = [...cols];
            if (direction === 'up' && index > 0) {
                [newCols[index - 1], newCols[index]] = [newCols[index], newCols[index - 1]];
            } else if (direction === 'down' && index < newCols.length - 1) {
                [newCols[index + 1], newCols[index]] = [newCols[index], newCols[index + 1]];
            }
            return newCols;
        });
    }

    const handleReorderColumns = useCallback((fromIndex: number, toIndex: number) => {
        setColumns(cols => {
            const newCols = [...cols];
            const [removed] = newCols.splice(fromIndex, 1);
            newCols.splice(toIndex, 0, removed);
            return newCols;
        });
    }, []);

    const filteredAndSortedContacts = useMemo(() => [...allContacts]
        .filter(contact => {
            const matchesSearch =
                (contact.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (contact.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (contact.phone || "").includes(searchTerm) ||
                (contact.businessName || "").toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(contact.status);

            const matchesTags = tagFilter.length === 0 || tagFilter.some(tagId =>
                contact.tags?.some((t: any) => t.tagId === tagId || t.id === tagId)
            );

            return matchesSearch && matchesStatus && matchesTags;
        })
        .sort((a, b) => {
            const { key, direction } = sortConfig;
            if (!key) return 0;

            let valA: unknown = (a as Record<string, unknown>)[key] || "";
            let valB: unknown = (b as Record<string, unknown>)[key] || "";

            // Handle special cases like Opportunity Value or Dates
            if (key === 'opportunity') {
                valA = a.dealValue;
                valB = b.dealValue;
            } else if (key === 'created' || key === 'lastActivity') {
                valA = new Date(valA as string).getTime() || 0;
                valB = new Date(valB as string).getTime() || 0;
            }

            if ((valA as number | string) < (valB as number | string)) return direction === 'asc' ? -1 : 1;
            if ((valA as number | string) > (valB as number | string)) return direction === 'asc' ? 1 : -1;
            return 0;
        }), [allContacts, searchTerm, statusFilter, tagFilter, sortConfig]);

    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Contacts</h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Manage your leads, active tenants, and past guests.</p>
                    </div>
                <div className="flex flex-wrap items-center gap-2">
                    <DuplicateDetector onMergeComplete={fetchAllContacts} />
                    <Button
                        variant="outline"
                        size="sm"
                        className="touch-manipulation"
                        onClick={() => {
                            const rows = (allContacts || []).map((c: any) => ({
                                Name: c.name || "",
                                Email: c.email || "",
                                Phone: c.phone || "",
                                Status: c.status || "",
                                "Military Base": c.militaryBase || "",
                                "Business Name": c.businessName || "",
                                "Stay Start": c.stayStartDate ? new Date(c.stayStartDate).toLocaleDateString() : "",
                                "Stay End": c.stayEndDate ? new Date(c.stayEndDate).toLocaleDateString() : "",
                                Source: c.utmSource || "",
                                Created: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
                            }));
                            exportToCSV(rows, "contacts-export");
                        }}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsImportMappingOpen(true)} className="touch-manipulation">
                        <Upload className="mr-2 h-4 w-4" />
                        Import CSV
                    </Button>
                    <Button size="sm" onClick={handleAddContactClick} className="touch-manipulation">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Contact
                    </Button>
                </div>
            </div>

            {selectedContactIds.size > 0 && (
                <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3 shadow-sm">
                    <span className="text-sm font-medium">{selectedContactIds.size} contact{selectedContactIds.size !== 1 ? 's' : ''} selected</span>
                    <Separator orientation="vertical" className="h-5" />

                    {/* Change Status dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isBulkUpdating}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Change Status
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px]">
                            <DropdownMenuLabel>Set Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {(contactStatuses.length > 0 ? contactStatuses.map(s => s.name) : ["Active Stay", "Lead", "Forms Pending", "Booked"]).map(status => (
                                <DropdownMenuItem key={status} onClick={() => handleBulkStatusChange(status)}>
                                    {status}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Add Tag dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isBulkUpdating}>
                                <Tag className="mr-2 h-4 w-4" />
                                Add Tag
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto">
                            <DropdownMenuLabel>Select Tag</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {availableTags.length === 0 ? (
                                <div className="px-2 py-3 text-sm text-muted-foreground text-center">No tags available. Create tags in Settings.</div>
                            ) : (
                                availableTags.map(tag => (
                                    <DropdownMenuItem key={tag.id} onClick={() => handleBulkAddTag(tag.id)}>
                                        <span
                                            className="mr-2 inline-block h-3 w-3 rounded-full shrink-0"
                                            style={{ backgroundColor: tag.color || '#6b7280' }}
                                        />
                                        {tag.name}
                                    </DropdownMenuItem>
                                ))
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Send Bulk Email */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsBulkEmailOpen(true)}
                        disabled={isBulkUpdating}
                    >
                        <Mail className="mr-2 h-4 w-4" />
                        Send Email
                    </Button>

                    {selectedContactIds.size === 2 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setMergeFieldChoices({});
                                setIsMergeDialogOpen(true);
                            }}
                        >
                            <Merge className="mr-2 h-4 w-4" />
                            Merge Contacts
                        </Button>
                    )}
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setContactToDelete('__bulk__')}
                        disabled={isDeleting || isBulkUpdating}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Selected
                    </Button>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" onClick={() => setSelectedContactIds(new Set())}>
                        <X className="mr-2 h-4 w-4" />
                        Clear Selection
                    </Button>
                </div>
            )}

            <Card>
                <CardHeader className="py-4 px-4 sm:px-6 space-y-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full">
                            <div className="relative w-full sm:w-72 sm:flex-1 sm:min-w-0">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search all contacts..."
                                    className="h-9 min-h-[44px] sm:min-h-0 pl-8"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 min-h-[44px] sm:min-h-0">
                                        <Filter className="mr-2 h-4 w-4" />
                                        Filter {statusFilter.length > 0 && `(${statusFilter.length})`}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[200px]">
                                    <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <div className="flex flex-col gap-1 p-1">
                                        {(contactStatuses.length > 0 ? contactStatuses.map(s => s.name) : ["Active Stay", "Lead", "Forms Pending", "Booked"]).map(status => (
                                            <div key={status} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm transition-colors cursor-pointer" onClick={() => {
                                                setStatusFilter(prev =>
                                                    prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                                                )
                                            }}>
                                                <Checkbox checked={statusFilter.includes(status)} />
                                                <span className="text-sm">{status}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {statusFilter.length > 0 && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <div className="p-1">
                                                <Button variant="ghost" className="w-full justify-center h-8 text-xs h-7" onClick={() => setStatusFilter([])}>
                                                    Clear Filters
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 min-h-[44px] sm:min-h-0">
                                        <Tag className="mr-2 h-4 w-4" />
                                        Tags {tagFilter.length > 0 && `(${tagFilter.length})`}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto">
                                    <DropdownMenuLabel>Filter by Tag</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <div className="flex flex-col gap-1 p-1">
                                        {availableTags.map(tag => (
                                            <div key={tag.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm transition-colors cursor-pointer" onClick={() => {
                                                setTagFilter(prev =>
                                                    prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                                                )
                                            }}>
                                                <Checkbox checked={tagFilter.includes(tag.id)} />
                                                <span className="mr-2 inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color || '#6b7280' }} />
                                                <span className="text-sm">{tag.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {tagFilter.length > 0 && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <div className="p-1">
                                                <Button variant="ghost" className="w-full justify-center h-7 text-xs" onClick={() => setTagFilter([])}>
                                                    Clear Tags
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 min-h-[44px] sm:min-h-0">
                                        <ArrowDown className="mr-2 h-4 w-4" />
                                        Sort
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[200px]">
                                    <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {[
                                        { id: 'name', label: 'Name' },
                                        { id: 'created', label: 'Date Created' },
                                        { id: 'lastActivity', label: 'Last Activity' },
                                        { id: 'opportunity', label: 'Deal Value' },
                                        { id: 'status', label: 'Status' }
                                    ].map(item => (
                                        <div key={item.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-muted rounded-sm transition-colors cursor-pointer" onClick={() => {
                                            if (sortConfig.key === item.id) {
                                                setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
                                            } else {
                                                setSortConfig({ key: item.id as ColumnId, direction: 'asc' });
                                            }
                                        }}>
                                            <span className="text-sm">{item.label}</span>
                                            {sortConfig.key === item.id && (
                                                <span className="text-[10px] text-primary uppercase font-bold">
                                                    {sortConfig.direction}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 min-h-[44px] sm:min-h-0">
                                        <LayoutGrid className="mr-2 h-4 w-4" />
                                        Columns
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[280px]">
                                    <DropdownMenuLabel>Configure Columns</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <div className="flex flex-col gap-1 p-1">
                                        {columns.map((col, index) => (
                                            <div key={col.id} className="flex items-center justify-between hover:bg-muted/50 rounded-sm px-2 py-1.5 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`col-${col.id}`}
                                                        checked={col.visible}
                                                        onCheckedChange={() => toggleColumn(col.id)}
                                                    />
                                                    <label htmlFor={`col-${col.id}`} className="text-sm cursor-pointer select-none">
                                                        {col.label}
                                                    </label>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                        disabled={index === 0}
                                                        onClick={() => moveColumn(index, 'up')}
                                                    >
                                                        <ArrowUp className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                        disabled={index === columns.length - 1}
                                                        onClick={() => moveColumn(index, 'down')}
                                                    >
                                                        <ArrowDown className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Save current filter */}
                            {(searchTerm || statusFilter.length > 0) && (
                                showSaveFilter ? (
                                    <div className="flex items-center gap-1">
                                        <Input
                                            placeholder="Filter name..."
                                            className="h-9 w-32 text-xs"
                                            value={filterNameInput}
                                            onChange={(e) => setFilterNameInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleSaveFilter()}
                                            autoFocus
                                        />
                                        <Button size="sm" className="h-9 px-2" onClick={handleSaveFilter} disabled={!filterNameInput.trim()}>
                                            Save
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => setShowSaveFilter(false)}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => setShowSaveFilter(true)}>
                                        <Bookmark className="mr-1 h-3 w-3" />
                                        Save Filter
                                    </Button>
                                )
                            )}
                        </div>
                        </div>

                        {/* Saved filter presets */}
                        {savedFilters.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="text-[10px] text-muted-foreground/60 uppercase font-semibold tracking-wider mr-1">Saved:</span>
                                {savedFilters.map(f => (
                                    <Badge
                                        key={f.name}
                                        variant="secondary"
                                        className="cursor-pointer text-xs px-2 py-0.5 gap-1 hover:bg-secondary/80"
                                        onClick={() => handleApplyFilter(f)}
                                    >
                                        {f.name}
                                        <button
                                            className="ml-0.5 hover:text-destructive"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteFilter(f.name); }}
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                    <div className="text-xs text-muted-foreground px-1 py-2">
                        Showing {filteredAndSortedContacts.length} of {allContacts.length} contacts
                    </div>
                    {/* Mobile: virtualized card list */}
                    <div className="md:hidden">
                        {filteredAndSortedContacts.length > 0 ? (
                            <VirtualList
                                items={filteredAndSortedContacts}
                                estimateSize={76}
                                overscan={8}
                                className="max-h-[70vh]"
                                renderItem={(contact) => {
                                    const isNewContact = (() => {
                                        if (!contact.createdAt) return false;
                                        const createdDate = new Date(contact.createdAt);
                                        const now = new Date();
                                        const diffDays = Math.ceil((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                                        return diffDays <= 3;
                                    })();
                                    return (
                                        <div className="pb-2">
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => contact.id !== "new" && handleSelectContact(contact)}
                                                onKeyDown={(e) => e.key === "Enter" && contact.id !== "new" && handleSelectContact(contact)}
                                                className={`flex items-center gap-3 p-4 rounded-xl border bg-card min-h-[56px] touch-manipulation active:bg-muted/50 ${isNewContact ? "border-primary/40 bg-primary/[0.04]" : "border-border/60"}`}
                                            >
                                                <Avatar className="h-10 w-10 shrink-0">
                                                    <AvatarFallback className="text-sm bg-primary/10 text-primary">{contact.name?.charAt(0) ?? "?"}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium truncate">{contact.name}</span>
                                                        {isNewContact && (
                                                            <Badge className="shrink-0 text-[10px] bg-primary text-primary-foreground border-0">New</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">{contact.email || contact.phone || "—"}</p>
                                                    {(contact.militaryBase || contact.dealStage !== "—") && (
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {contact.militaryBase && <span className="text-[10px] text-muted-foreground">{contact.militaryBase}</span>}
                                                            {contact.militaryBase && contact.dealStage !== "—" && <span className="text-[10px] text-muted-foreground/40">·</span>}
                                                            {contact.dealStage !== "—" && <span className="text-[10px] text-muted-foreground">{contact.dealStage}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                <Badge variant={contact.status === "Active Stay" ? "default" : "outline"} className="shrink-0 text-xs">
                                                    {contact.status || "—"}
                                                </Badge>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <Search className="h-10 w-10 text-muted-foreground/20 mb-3" />
                                <p className="text-sm font-medium text-foreground mb-1">No contacts found</p>
                                <p className="text-xs text-muted-foreground">Try adjusting your search or filters</p>
                            </div>
                        )}
                    </div>
                    {/* Desktop: virtualized table */}
                    <div className="hidden md:block">
                    {filteredAndSortedContacts.length > 0 ? (
                    <ContactsVirtualTable
                        contacts={filteredAndSortedContacts}
                        columns={columns}
                        selectedContactIds={selectedContactIds}
                        resizingCol={resizingCol}
                        onToggleSelectAll={toggleSelectAll}
                        onToggleSelectContact={toggleSelectContact}
                        onSelectContact={handleSelectContact}
                        onResizeStart={handleResizeStart}
                        sortConfig={sortConfig}
                        onSort={(key) => {
                            if (sortConfig.key === key) {
                                setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
                            } else {
                                setSortConfig({ key, direction: 'asc' });
                            }
                        }}
                        onReorderColumns={handleReorderColumns}
                    />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Search className="h-10 w-10 text-muted-foreground/20 mb-3" />
                            <p className="text-sm font-medium text-foreground mb-1">No contacts found</p>
                            <p className="text-xs text-muted-foreground">Try adjusting your search or filters</p>
                        </div>
                    )}
                    </div>
                    {/* Infinite scroll sentinel */}
                    <div ref={loadMoreRef} className="py-2" />
                    {isLoadingMore && (
                        <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="text-sm">Loading more contacts...</span>
                        </div>
                    )}
                    {!hasMore && allContacts.length > 0 && (
                        <p className="text-center text-xs text-muted-foreground py-2">All {allContacts.length} contacts loaded</p>
                    )}
                </CardContent>
            </Card>

            <ContactDetailSheet
                selectedContact={selectedContact}
                editingContact={editingContact}
                setEditingContact={setEditingContact}
                onClose={() => setSelectedContact(null)}
                contactStatuses={contactStatuses}
                noteContent={noteContent}
                setNoteContent={setNoteContent}
                onAddNote={handleAddNote}
                onAddNoteWithMentions={handleAddNoteWithMentions}
                isSavingNote={isSavingNote}
                expandedNoteIds={expandedNoteIds}
                toggleNoteExpanded={toggleNoteExpanded}
                onDeleteNote={(contactId, noteId) => setNoteToDelete({ contactId, noteId })}
                users={allUsers}
                logMessageType={logMessageType}
                setLogMessageType={setLogMessageType}
                logMessageContent={logMessageContent}
                setLogMessageContent={setLogMessageContent}
                onLogMessage={handleLogMessage}
                isLoggingMessage={isLoggingMessage}
                onSave={handleSave}
                isSaving={isSaving}
                saveError={saveError}
                onCreateOpportunity={handleCreateOpportunity}
                onToggleForm={handleToggleForm}
                onOpenTaskDialog={() => setIsTaskDialogOpen(true)}
                onDeleteContact={(id) => setContactToDelete(id)}
                allContacts={allContacts.map(c => ({ id: c.id, name: c.name || "", email: c.email || "", phone: c.phone || "" }))}
                onRefreshContact={handleRefreshContact}
                onMergeWith={handleMergeWith}
            />

            <AlertDialog open={!!contactToDelete} onOpenChange={(open) => !open && setContactToDelete(null)}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {contactToDelete === '__bulk__' ? 'Delete selected contacts?' : 'Delete this contact?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {contactToDelete === '__bulk__'
                                ? `This will permanently delete ${selectedContactIds.size} contact${selectedContactIds.size !== 1 ? 's' : ''} and their related opportunities. This action cannot be undone.`
                                : 'This will permanently delete this contact and their related opportunities. This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(e) => {
                                e.preventDefault();
                                if (contactToDelete === '__bulk__') {
                                    handleBulkDelete();
                                } else if (contactToDelete) {
                                    handleDeleteContact(contactToDelete);
                                }
                            }}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This note will be removed. The deletion will be recorded in the contact timeline.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(e) => { e.preventDefault(); handleDeleteNote(); }}
                        >
                            {isDeletingNote ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {selectedContact?.id && selectedContact.id !== 'new' && (
                <CreateTaskDialog
                    isOpen={isTaskDialogOpen}
                    onClose={() => setIsTaskDialogOpen(false)}
                    onSaved={() => { setIsTaskDialogOpen(false); fetchAllContacts(); }}
                    initialContactId={selectedContact.id}
                />
            )}

            {/* Merge Contacts Dialog */}
            <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Merge className="h-4 w-4" />
                            Merge Contacts
                        </DialogTitle>
                    </DialogHeader>
                    {(() => {
                        const ids = Array.from(selectedContactIds);
                        const contactA = allContacts.find(c => c.id === ids[0]);
                        const contactB = allContacts.find(c => c.id === ids[1]);
                        if (!contactA || !contactB) return <p className="text-sm text-muted-foreground p-4">Select exactly 2 contacts to merge.</p>;

                        const fields = [
                            { key: 'name', label: 'Name' },
                            { key: 'email', label: 'Email' },
                            { key: 'phone', label: 'Phone' },
                            { key: 'militaryBase', label: 'Military Base' },
                            { key: 'businessName', label: 'Business' },
                            { key: 'status', label: 'Status' },
                        ];

                        return (
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Choose which value to keep for each field. The secondary contact will be deleted and all their notes, documents, and opportunities will be moved to the primary.
                                </p>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/30 border-b">
                                                <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Field</th>
                                                <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Contact A (Primary)</th>
                                                <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Contact B</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fields.map(f => {
                                                const valA = contactA[f.key] || '—';
                                                const valB = contactB[f.key] || '—';
                                                const choice = mergeFieldChoices[f.key] || 'primary';
                                                return (
                                                    <tr key={f.key} className="border-b last:border-0">
                                                        <td className="px-3 py-2 font-medium text-xs text-muted-foreground">{f.label}</td>
                                                        <td
                                                            className={`px-3 py-2 cursor-pointer transition-colors ${choice === 'primary' ? 'bg-primary/10 font-semibold' : 'hover:bg-muted/20'}`}
                                                            onClick={() => setMergeFieldChoices(prev => ({ ...prev, [f.key]: 'primary' }))}
                                                        >
                                                            <span className="text-sm">{valA}</span>
                                                        </td>
                                                        <td
                                                            className={`px-3 py-2 cursor-pointer transition-colors ${choice === 'secondary' ? 'bg-primary/10 font-semibold' : 'hover:bg-muted/20'}`}
                                                            onClick={() => setMergeFieldChoices(prev => ({ ...prev, [f.key]: 'secondary' }))}
                                                        >
                                                            <span className="text-sm">{valB}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-xs text-muted-foreground">Click a cell to select that value. Contact A is the primary by default.</p>
                            </div>
                        );
                    })()}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)} disabled={isMerging}>Cancel</Button>
                        <Button
                            onClick={async () => {
                                const ids = Array.from(selectedContactIds);
                                if (ids.length !== 2) return;
                                setIsMerging(true);
                                const res = await mergeContacts(ids[0], ids[1], mergeFieldChoices);
                                setIsMerging(false);
                                if (res.success) {
                                    toast.success("Contacts merged")
                                    setIsMergeDialogOpen(false);
                                    setSelectedContactIds(new Set());
                                    fetchAllContacts();
                                } else {
                                    toast.error("Failed to merge contacts")
                                }
                            }}
                            disabled={isMerging}
                        >
                            {isMerging ? 'Merging...' : 'Merge Contacts'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dedicated Contact Merge Dialog (from duplicate detection in detail sheet) */}
            <ContactMergeDialog
                isOpen={dedicatedMergeOpen}
                onClose={() => { setDedicatedMergeOpen(false); setMergeContactA(null); setMergeContactB(null); }}
                contactA={mergeContactA}
                contactB={mergeContactB}
                onMergeComplete={() => {
                    setSelectedContact(null);
                    setSelectedContactIds(new Set());
                    fetchAllContacts();
                }}
            />

            {/* Bulk Email Dialog */}
            <BulkEmailDialog
                isOpen={isBulkEmailOpen}
                onClose={() => setIsBulkEmailOpen(false)}
                contacts={Array.from(selectedContactIds).map(id => {
                    const c = allContacts.find(contact => contact.id === id);
                    return { id, name: c?.name || "", email: c?.email || "" };
                })}
            />

            {/* Import Mapping Dialog */}
            <ImportMappingDialog
                isOpen={isImportMappingOpen}
                onClose={() => setIsImportMappingOpen(false)}
                onImportComplete={fetchAllContacts}
            />
            </div>
        </div>
    )
}
