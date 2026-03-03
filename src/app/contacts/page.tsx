"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Phone, Mail, MoreVertical, Search, Filter, Plus, ChevronRight, LayoutGrid,
    List as ListIcon, Calendar as CalendarIcon, ArrowUp, ArrowDown, Calculator,
    Send, FileText, MessageSquare, Clock, CheckCircle, Upload, Trash2, ListTodo,
    ChevronDown, ChevronUp, Briefcase, ExternalLink
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
import { getContacts, getContactDetail, createNote, deleteNote, updateContact, updateFormTracking, bulkCreateContacts, createContact, deleteContact, bulkDeleteContacts } from "./actions"
import { sendMessage } from "@/app/communications/actions"
import { getContactStatuses } from "@/app/settings/system-properties/actions"
import { createNewDeal } from "@/app/pipeline/actions"
import { CSVImportDialog } from "@/components/ui/CSVImportDialog"
import { CreateTaskDialog } from "@/components/ui/CreateTaskDialog"
import { DocumentManager } from "./documents/DocumentManager"
import dynamic from "next/dynamic"

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

    const fetchContactStatuses = async () => {
        const res = await getContactStatuses();
        if (res.success && res.items) setContactStatuses(res.items as { id: string; name: string }[]);
    };

    const fetchAllContacts = async () => {
        setIsLoading(true);
        const res = await getContacts();
        if (res.success && res.contacts) {
            setAllContacts(res.contacts.map((c: any) => ({
                ...c,
                dealName: c.opportunities?.[0]?.name || "No Deal",
                dealValue: c.opportunities?.[0]?.opportunityValue || 0,
                dealStage: c.opportunities?.[0]?.stageName || "—",
                created: new Date(c.createdAt).toLocaleString(),
                lastActivity: new Date(c.updatedAt).toLocaleString(),
                lastNote: c.notes?.[0]?.content || "No notes",
                tags: [] as string[]
            })));
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchAllContacts();
    }, []);

    useEffect(() => {
        fetchContactStatuses();
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

    const handleSelectContact = async (contact: { id: string }) => {
        setIsLoading(true);
        const res = await getContactDetail(contact.id);
        if (res.success) {
            setSelectedContact(res.contact);
            setEditingContact(res.contact);
        }
        setIsLoading(false);
    };

    const handleLogMessage = async () => {
        if (!selectedContact || selectedContact.id === 'new' || !logMessageContent.trim()) return;
        setIsLoggingMessage(true);
        const res = await sendMessage(selectedContact.id, logMessageType, logMessageContent.trim());
        if (res.success) {
            setLogMessageContent("");
            const detailRes = await getContactDetail(selectedContact.id);
            if (detailRes.success) {
                setSelectedContact(detailRes.contact);
            }
        }
        setIsLoggingMessage(false);
    };

    const handleAddNote = async () => {
        if (!noteContent.trim() || !selectedContact) return;
        setIsSavingNote(true);
        const res = await createNote(selectedContact.id, noteContent);
        if (res.success) {
            setNoteContent("");
            // Refresh detailed contact to show new note
            const detailRes = await getContactDetail(selectedContact.id);
            if (detailRes.success) {
                setSelectedContact(detailRes.contact);
            }
            // Update list view too
            fetchAllContacts();
        }
        setIsSavingNote(false);
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
        if (res.success && selectedContact?.id === noteToDelete.contactId) {
            const detailRes = await getContactDetail(noteToDelete.contactId);
            if (detailRes.success) setSelectedContact(detailRes.contact);
            fetchAllContacts();
        }
        setNoteToDelete(null);
        setIsDeletingNote(false);
    };

    const toggleSelectContact = (id: string) => {
        setSelectedContactIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedContactIds.size === filteredAndSortedContacts.length) {
            setSelectedContactIds(new Set());
        } else {
            setSelectedContactIds(new Set(filteredAndSortedContacts.map((c: any) => c.id)));
        }
    };

    const handleDeleteContact = async (id: string) => {
        if (id === 'new') return;
        setIsDeleting(true);
        const res = await deleteContact(id);
        setIsDeleting(false);
        setContactToDelete(null);
        if (res.success) {
            setSelectedContact(null);
            setSelectedContactIds(prev => { const n = new Set(prev); n.delete(id); return n; });
            fetchAllContacts();
        } else {
            setSaveError((res as { error?: string }).error || "Failed to delete contact");
        }
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedContactIds);
        if (ids.length === 0) return;
        setIsDeleting(true);
        const res = await bulkDeleteContacts(ids);
        setIsDeleting(false);
        setSelectedContactIds(new Set());
        if (res.success) {
            setSelectedContact(null);
            fetchAllContacts();
        } else {
            setSaveError((res as { error?: string }).error || "Failed to delete contacts");
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
            window.location.href = `/pipeline?deal=${res.dealId}`;
        } else {
            setSaveError((res as { error?: string }).error || "Failed to create opportunity");
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!editingContact) return;
        setIsSaving(true);
        setSaveError(null);

        if (editingContact.id === 'new') {
            const res = await createContact({
                name: editingContact.name,
                email: editingContact.email,
                phone: editingContact.phone,
                militaryBase: editingContact.militaryBase,
                businessName: editingContact.businessName,
                status: editingContact.status || 'Lead',
                stayStartDate: editingContact.stayStartDate || null,
                stayEndDate: editingContact.stayEndDate || null
            });
            if (res.success && res.id) {
                await fetchAllContacts();
                // Keep sheet open with the newly created contact so user can optionally create an opportunity
                const detailRes = await getContactDetail(res.id);
                if (detailRes.success) {
                    setSelectedContact(detailRes.contact);
                    setEditingContact(detailRes.contact);
                } else {
                    setSelectedContact(null);
                }
            } else {
                setSaveError((res as { error?: string }).error || "Failed to create contact");
            }
        } else {
            const res = await updateContact(editingContact.id, {
                name: editingContact.name,
                email: editingContact.email,
                phone: editingContact.phone,
                militaryBase: editingContact.militaryBase,
                businessName: editingContact.businessName,
                status: editingContact.status || 'Lead',
                stayStartDate: editingContact.stayStartDate || null,
                stayEndDate: editingContact.stayEndDate || null
            });
            if (res.success) {
                const detailRes = await getContactDetail(editingContact.id);
                if (detailRes.success) {
                    setSelectedContact(detailRes.contact);
                    setEditingContact(detailRes.contact);
                }
                fetchAllContacts();
            } else {
                setSaveError((res as { error?: string }).error || "Failed to save changes");
            }
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

    const filteredAndSortedContacts = [...allContacts]
        .filter(contact => {
            const matchesSearch =
                contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                contact.phone.includes(searchTerm) ||
                contact.businessName.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(contact.status);

            return matchesSearch && matchesStatus;
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
        });

    return (
        <div className="flex-1 space-y-4 p-4 sm:p-8 pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Contacts</h2>
                    <p className="text-muted-foreground text-sm sm:text-base">
                        Manage your leads, active tenants, and past guests.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" className="touch-manipulation">
                        <Calculator className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)} className="touch-manipulation">
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
                <div className="flex items-center gap-4 rounded-lg border bg-muted/50 px-4 py-3">
                    <span className="text-sm font-medium">{selectedContactIds.size} contact{selectedContactIds.size !== 1 ? 's' : ''} selected</span>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setContactToDelete('__bulk__')}
                        disabled={isDeleting}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Selected
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedContactIds(new Set())}>
                        Clear selection
                    </Button>
                </div>
            )}

            <Card>
                <CardHeader className="py-4 px-4 sm:px-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                            <div className="relative w-full sm:w-72 flex-1 min-w-0">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search all contacts..."
                                    className="h-9 min-h-[44px] sm:min-h-0 pl-8"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9">
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
                                    <Button variant="outline" size="sm" className="h-9">
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
                                    <Button variant="outline" size="sm" className="h-9">
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
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                    {/* Mobile: card list */}
                    <div className="md:hidden space-y-2">
                        {filteredAndSortedContacts.map((contact) => {
                            const isNewContact = (() => {
                                if (!contact.createdAt) return false;
                                const createdDate = new Date(contact.createdAt);
                                const now = new Date();
                                const diffDays = Math.ceil((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                                return diffDays <= 3;
                            })();
                            return (
                                <div
                                    key={contact.id}
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
                                    </div>
                                    <Badge variant={contact.status === "Active Stay" ? "default" : "outline"} className="shrink-0 text-xs">
                                        {contact.status}
                                    </Badge>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                </div>
                            );
                        })}
                    </div>
                    {/* Desktop: table */}
                    <div className="hidden md:block overflow-x-auto">
                    <Table className="table-fixed min-w-max">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <Checkbox
                                        checked={filteredAndSortedContacts.length > 0 && selectedContactIds.size === filteredAndSortedContacts.length}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                                {columns.filter(c => c.visible).map(col => (
                                    <TableHead
                                        key={col.id}
                                        className="relative group select-none whitespace-nowrap"
                                        style={{ width: col.width, minWidth: col.width }}
                                    >
                                        <span className="truncate block pr-2">{col.label}</span>
                                        <div
                                            className={`absolute right-0 top-0 h-full w-2 cursor-col-resize transition-colors z-10 ${resizingCol === col.id ? 'bg-primary' : 'hover:bg-primary/50 group-hover:bg-primary/20'}`}
                                            onMouseDown={(e) => handleResizeStart(e, col)}
                                        />
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedContacts.map((contact) => {
                                const isNewContact = (() => {
                                    if (!contact.createdAt) return false;
                                    const createdDate = new Date(contact.createdAt);
                                    const now = new Date();
                                    const diffDays = Math.ceil((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                                    return diffDays <= 3;
                                })();
                                
                                return (
                                <TableRow
                                    key={contact.id}
                                    className={`cursor-pointer hover:bg-muted/50 transition-all ${selectedContactIds.has(contact.id) ? 'bg-muted/30' : ''} ${isNewContact ? "bg-primary/[0.04] shadow-[inset_4px_0_0_rgba(59,130,246,1)]" : ""}`}
                                    onClick={() => contact.id !== 'new' && handleSelectContact(contact)}
                                >
                                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                                        {contact.id !== 'new' && (
                                            <Checkbox
                                                checked={selectedContactIds.has(contact.id)}
                                                onCheckedChange={() => toggleSelectContact(contact.id)}
                                                aria-label={`Select ${contact.name}`}
                                            />
                                        )}
                                    </TableCell>
                                    {columns.filter(c => c.visible).map(col => {
                                        switch (col.id) {
                                            case 'name': return (
                                                <TableCell key={col.id} className="font-medium whitespace-nowrap overflow-hidden text-ellipsis" style={{ maxWidth: col.width }}>
                                                    <div className="flex items-center gap-3 truncate">
                                                        <Avatar className="h-6 w-6 shrink-0">
                                                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{contact.name.charAt(6)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex items-center gap-2 truncate">
                                                            <span className="whitespace-nowrap">{contact.name}</span>
                                                            {isNewContact && (
                                                                <Badge className="shrink-0 text-[10px] font-bold tracking-wider bg-primary text-primary-foreground border-0 px-1.5 py-0 h-4 shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse">New</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            );
                                            case 'phone': return (
                                                <TableCell key={col.id} className="text-muted-foreground whitespace-nowrap"><Phone className="h-3 w-3 inline mr-1.5 opacity-50" />{contact.phone}</TableCell>
                                            );
                                            case 'email': return (
                                                <TableCell key={col.id} className="text-muted-foreground whitespace-nowrap"><Mail className="h-3 w-3 inline mr-1.5 opacity-50" />{contact.email}</TableCell>
                                            );
                                            case 'businessName': return (
                                                <TableCell key={col.id} className="whitespace-nowrap">{contact.businessName}</TableCell>
                                            );
                                            case 'status': return (
                                                <TableCell key={col.id} className="overflow-hidden" style={{ maxWidth: col.width }}>
                                                    <Badge
                                                        variant={contact.status === "Active Stay" ? "default" : contact.status === "Booked" ? "secondary" : "outline"}
                                                        className={`whitespace-nowrap
                                                            ${contact.status === "Active Stay" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}
                                                            ${contact.status === "Booked" ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}
                                                            ${contact.status === "Lead" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : ""}
                                                        `}
                                                    >
                                                        {contact.status}
                                                    </Badge>
                                                </TableCell>
                                            );
                                            case 'opportunity': return (
                                                <TableCell key={col.id} className="overflow-hidden" style={{ maxWidth: col.width }}>
                                                    <div className="flex flex-col whitespace-nowrap overflow-hidden">
                                                        <span className="text-sm font-medium truncate">{contact.dealName}</span>
                                                        <span className="text-xs text-muted-foreground truncate">${contact.dealValue.toLocaleString()} · {contact.dealStage}</span>
                                                    </div>
                                                </TableCell>
                                            );
                                            case 'lastActivity': return (
                                                <TableCell key={col.id} className="text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis" style={{ maxWidth: col.width }}>{contact.lastActivity}</TableCell>
                                            );
                                            case 'created': return (
                                                <TableCell key={col.id} className="text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis" style={{ maxWidth: col.width }}>{contact.created}</TableCell>
                                            );
                                            case 'tags': return (
                                                <TableCell key={col.id} className="overflow-hidden" style={{ maxWidth: col.width }}>
                                                    <div className="flex flex-wrap gap-1 min-w-[80px] overflow-hidden">
                                                        {(contact.tags || []).map((tag: any) => (
                                                            <Badge key={tag?.tagId || tag?.name || tag} variant="secondary" className="text-[10px] font-normal px-1.5 py-0 whitespace-nowrap">
                                                                {typeof tag === 'object' ? tag?.name : tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                            );
                                            case 'lastNote': return (
                                                <TableCell key={col.id} style={{ maxWidth: col.width }}>
                                                    <p className="truncate text-muted-foreground text-sm" title={contact.lastNote}>
                                                        {contact.lastNote}
                                                    </p>
                                                </TableCell>
                                            );
                                            default: return null;
                                        }
                                    })}
                                </TableRow>
                            );
                            })}
                        </TableBody>
                    </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Slide-over Contact Detail Pane */}
            <Sheet open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
                <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col gap-0 border-l border-border/50 shadow-2xl">
                    {(() => {
                        const contact = selectedContact;
                        if (!contact) return null;
                        return (
                            <>
                                <div className="p-6 bg-muted/30 border-b">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
                                                <AvatarFallback className="text-xl bg-primary/10 text-primary">{contact.name.charAt(6)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <SheetTitle className="text-2xl">{contact.name}</SheetTitle>
                                                <SheetDescription className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="font-normal">{contact.status}</Badge>
                                                    <span className="text-xs text-muted-foreground">Tenant Record</span>
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
                                                    onClick={(e) => { e.stopPropagation(); if (contact.id !== 'new') setIsTaskDialogOpen(true); }}
                                                    disabled={contact.id === 'new'}
                                                >
                                                    <ListTodo className="mr-2 h-4 w-4" />
                                                    Add task for contact
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={(e) => { e.stopPropagation(); contact.id !== 'new' && setContactToDelete(contact.id); }}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete Contact
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    {/* Opportunity attachment: show linked deal or create one */}
                                    <div className="mt-4 p-3 rounded-xl border bg-background/60 space-y-2">
                                        {contact.opportunities?.length > 0 ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <Briefcase className="h-4 w-4 text-emerald-600" />
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attached to opportunity</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <span className="text-sm font-medium truncate">{contact.opportunities[0].name || "Deal"}</span>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="shrink-0 gap-1.5 h-8"
                                                        onClick={() => router.push(`/pipeline?deal=${contact.opportunities[0].id}`)}
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                        View in Pipeline
                                                    </Button>
                                                </div>
                                                {contact.opportunities[0].opportunityValue != null && (
                                                    <p className="text-xs text-muted-foreground">Value: ${Number(contact.opportunities[0].opportunityValue).toLocaleString()}</p>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">No opportunity</span>
                                                </div>
                                                {contact.id !== 'new' ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="w-full gap-1.5 h-8"
                                                        onClick={handleCreateOpportunity}
                                                        disabled={isSaving}
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                        {isSaving ? "Creating..." : "Create opportunity"}
                                                    </Button>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground">Save the contact first, then create an opportunity.</p>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-6 mt-6">
                                        <Button size="sm" className="w-full">
                                            <Phone className="mr-2 h-4 w-4" />
                                            Call
                                        </Button>
                                        <Button size="sm" variant="outline" className="w-full">
                                            <Mail className="mr-2 h-4 w-4" />
                                            Email
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    <Tabs defaultValue="details" className="w-full h-full flex flex-col">
                                        <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 h-12">
                                            <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full">Details</TabsTrigger>
                                            <TabsTrigger value="notes" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full">Notes</TabsTrigger>
                                            <TabsTrigger value="documents" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full">Documents</TabsTrigger>
                                            <TabsTrigger value="timeline" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full">Timeline</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="details" className="flex-1 p-6 m-0 outline-none space-y-8 overflow-y-auto">
                                            {/* Contact Info */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contact Information</h3>
                                                </div>
                                                <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                                    <div className="space-y-1 col-span-2">
                                                        <span className="text-muted-foreground text-xs">Full Name</span>
                                                        <Input
                                                            value={editingContact?.name || ""}
                                                            onChange={(e) => setEditingContact((prev: any) => prev ? { ...prev, name: e.target.value } : null)}
                                                            className="h-8 text-sm font-medium"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-muted-foreground text-xs">Email Address</span>
                                                        <Input
                                                            value={editingContact?.email || ""}
                                                            onChange={(e) => setEditingContact((prev: any) => prev ? { ...prev, email: e.target.value } : null)}
                                                            className="h-8 text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-muted-foreground text-xs">Phone Number</span>
                                                        <Input
                                                            value={editingContact?.phone || ""}
                                                            onChange={(e) => setEditingContact((prev: any) => prev ? { ...prev, phone: e.target.value } : null)}
                                                            className="h-8 text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1 col-span-2">
                                                        <span className="text-muted-foreground text-xs">Business Name</span>
                                                        <Input
                                                            value={editingContact?.businessName || ""}
                                                            onChange={(e) => setEditingContact((prev: any) => prev ? { ...prev, businessName: e.target.value } : null)}
                                                            className="h-8 text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1 col-span-2">
                                                        <span className="text-muted-foreground text-xs">Military Base</span>
                                                        <Input
                                                            value={editingContact?.militaryBase || ""}
                                                            onChange={(e) => setEditingContact((prev: any) => prev ? { ...prev, militaryBase: e.target.value } : null)}
                                                            className="h-8 text-sm"
                                                            placeholder="e.g. Luke AFB"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <Separator />

                                            {/* Contact Status & Stay Dates */}
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contact Status</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <span className="text-muted-foreground text-xs">Status</span>
                                                        <select
                                                            value={editingContact?.status || (contactStatuses[0]?.name ?? "")}
                                                            onChange={(e) => setEditingContact((prev: any) => prev ? { ...prev, status: e.target.value } : null)}
                                                            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {contactStatuses.length === 0 ? (
                                                                <>
                                                                    <option value="Lead">Lead</option>
                                                                    <option value="Forms Pending">Forms Pending</option>
                                                                    <option value="Booked">Booked</option>
                                                                    <option value="Active Stay">Active Stay</option>
                                                                </>
                                                            ) : (
                                                                contactStatuses.map((s) => (
                                                                    <option key={s.id} value={s.name}>{s.name}</option>
                                                                ))
                                                            )}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-muted-foreground text-xs">Stay Start (optional)</span>
                                                        <Input
                                                            type="date"
                                                            value={editingContact?.stayStartDate?.split?.('T')?.[0] || editingContact?.stayStartDate || ""}
                                                            onChange={(e) => setEditingContact((prev: any) => prev ? { ...prev, stayStartDate: e.target.value || null } : null)}
                                                            className="h-8 text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-muted-foreground text-xs">Stay End (optional)</span>
                                                        <Input
                                                            type="date"
                                                            value={editingContact?.stayEndDate?.split?.('T')?.[0] || editingContact?.stayEndDate || ""}
                                                            onChange={(e) => setEditingContact((prev: any) => prev ? { ...prev, stayEndDate: e.target.value || null } : null)}
                                                            className="h-8 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground">Stay dates are used when creating an opportunity and will pre-fill the deal form.</p>
                                            </div>

                                            <div className="pt-4 flex flex-col gap-3">
                                                {selectedContact.id !== 'new' && (
                                                    <Button variant="outline" size="sm" onClick={() => setIsTaskDialogOpen(true)}>
                                                        <ListTodo className="mr-2 h-4 w-4" />
                                                        Add Task for Contact
                                                    </Button>
                                                )}
                                                {saveError && (
                                                    <p className="text-sm text-destructive">{saveError}</p>
                                                )}
                                                <div className="flex justify-end">
                                                    <Button onClick={handleSave} disabled={isSaving}>
                                                        {isSaving ? "Saving..." : "Save Changes"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="notes" className="flex-1 p-6 m-0 outline-none flex flex-col h-full bg-background">
                                            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                                                {selectedContact.notes?.length > 0 ? (
                                                    selectedContact.notes.map((note: any) => {
                                                        const isExpanded = expandedNoteIds.has(note.id);
                                                        const lineCount = (note.content || "").split(/\n/).length;
                                                        const isLong = lineCount > 3 || (note.content || "").length > 200;
                                                        return (
                                                            <div key={note.id} className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-muted/20 shadow-sm">
                                                                <Avatar className="h-8 w-8 shrink-0 border border-background">
                                                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">OP</AvatarFallback>
                                                                </Avatar>
                                                                <div className="space-y-1 flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="text-xs font-bold text-foreground">Internal Note</span>
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            <span className="text-[10px] text-muted-foreground font-medium">{new Date(note.createdAt).toLocaleDateString()}</span>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                                onClick={() => setNoteToDelete({ contactId: selectedContact.id, noteId: note.id })}
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                    <p className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line ${!isExpanded && isLong ? "line-clamp-3" : ""}`}>
                                                                        {note.content}
                                                                    </p>
                                                                    {isLong && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 text-xs text-primary px-0"
                                                                            onClick={() => toggleNoteExpanded(note.id)}
                                                                        >
                                                                            {isExpanded ? <><ChevronUp className="h-3.5 w-3.5 mr-1" /> Show less</> : <><ChevronDown className="h-3.5 w-3.5 mr-1" /> Show more</>}
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-30">
                                                        <FileText className="h-10 w-10" />
                                                        <p className="text-xs font-bold uppercase tracking-widest text-center">No notes yet</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-6 pt-6 border-t relative group">
                                                <textarea
                                                    placeholder="Type a new internal note..."
                                                    className="w-full min-h-[100px] p-4 rounded-xl bg-muted/30 border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all resize-none"
                                                    value={noteContent}
                                                    onChange={(e) => setNoteContent(e.target.value)}
                                                />
                                                <Button
                                                    size="sm"
                                                    className="absolute right-4 bottom-4 h-8 gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
                                                    onClick={handleAddNote}
                                                    disabled={isSavingNote || !noteContent.trim()}
                                                >
                                                    <Send className="h-3.5 w-3.5" />
                                                    {isSavingNote ? "Saving..." : "Save Note"}
                                                </Button>
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="documents" className="flex-1 p-6 m-0 outline-none space-y-6 overflow-y-auto">
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
                                                                onCheckedChange={(checked) => handleToggleForm(doc.field, !!checked)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <Separator />

                                            <DocumentManager contactId={selectedContact.id} />
                                        </TabsContent>
                                        <TabsContent value="timeline" className="flex-1 p-6 m-0 outline-none overflow-y-auto">
                                            <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border before:to-transparent">
                                                {(() => {
                                                    const messages = selectedContact.messages ?? [];
                                                    const notes = selectedContact.notes ?? [];
                                                    const timelineEvents = selectedContact.timelineEvents ?? [];
                                                    const merged: { id: string; type: 'message' | 'note' | 'note_deleted'; createdAt: string; data: any }[] = [
                                                        ...messages.map((m: any) => ({ id: `msg-${m.id}`, type: 'message' as const, createdAt: m.createdAt ?? '', data: m })),
                                                        ...notes.map((n: any) => ({ id: `note-${n.id}`, type: 'note' as const, createdAt: n.createdAt ?? '', data: n })),
                                                        ...timelineEvents.filter((e: any) => e.type === 'note_deleted').map((e: any) => ({ id: `ev-${e.id}`, type: 'note_deleted' as const, createdAt: e.createdAt ?? '', data: e })),
                                                    ];
                                                    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                                                    if (merged.length === 0) {
                                                        return (
                                                            <div className="ml-14 py-8 text-sm text-muted-foreground">No timeline activity yet.</div>
                                                        );
                                                    }

                                                    return merged.map((item) => {
                                                        if (item.type === 'message') {
                                                            const msg = item.data;
                                                            return (
                                                                <div key={item.id} className="relative flex items-center gap-4">
                                                                    <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm z-10">
                                                                        {msg.type === "EMAIL" && <Mail className="h-4 w-4 text-blue-500" />}
                                                                        {msg.type === "SMS" && <MessageSquare className="h-4 w-4 text-emerald-500" />}
                                                                        {msg.type === "CALL" && <Phone className="h-4 w-4 text-amber-500" />}
                                                                    </div>
                                                                    <div className="ml-14 flex-1 space-y-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-sm font-bold">
                                                                                {msg.direction === "INBOUND" ? "Received " : "Sent "}
                                                                                {(msg.type || "").toLowerCase()}
                                                                            </span>
                                                                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                                                                {new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                                            </span>
                                                                        </div>
                                                                        <div className="p-3 rounded-xl border bg-muted/30 text-sm text-muted-foreground leading-relaxed">
                                                                            {msg.content}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        if (item.type === 'note') {
                                                            const note = item.data;
                                                            return (
                                                                <div key={item.id} className="relative flex items-center gap-4">
                                                                    <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm z-10">
                                                                        <FileText className="h-4 w-4 text-primary" />
                                                                    </div>
                                                                    <div className="ml-14 flex-1 space-y-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-sm font-bold">Internal note</span>
                                                                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                                                                {new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                                            </span>
                                                                        </div>
                                                                        <div className="p-3 rounded-xl border bg-muted/30 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                                                                            {note.content}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        const ev = item.data;
                                                        return (
                                                            <div key={item.id} className="relative flex items-center gap-4">
                                                                <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm z-10">
                                                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                                                </div>
                                                                <div className="ml-14 flex-1 space-y-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-bold text-muted-foreground">
                                                                            Note deleted{ev.deletedBy ? ` by ${ev.deletedBy}` : ""}
                                                                        </span>
                                                                        <span className="text-[10px] text-muted-foreground tabular-nums">
                                                                            {new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                                        </span>
                                                                    </div>
                                                                    <div className="p-3 rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground italic">
                                                                        {ev.contentPreview ? `"${ev.contentPreview}"` : "A note was removed."}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}

                                                <Separator className="my-6" />

                                                <div className="ml-14 space-y-4">
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
                                                        onClick={handleLogMessage}
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
                        );
                    })()}
                </SheetContent>
            </Sheet>

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
        </div >
    )
}
