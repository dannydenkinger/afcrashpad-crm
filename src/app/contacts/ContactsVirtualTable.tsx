"use client"

import React, { useState, useCallback } from "react"
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
    TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowUp, ArrowDown, Phone, Mail, GripVertical } from "lucide-react"

type ColumnId = 'name' | 'phone' | 'email' | 'businessName' | 'status' | 'opportunity' | 'lastActivity' | 'created' | 'tags' | 'lastNote';

interface ColumnDef {
    id: ColumnId;
    label: string;
    visible: boolean;
    width: number;
}

interface ContactsVirtualTableProps {
    contacts: any[]
    columns: ColumnDef[]
    selectedContactIds: Set<string>
    resizingCol: ColumnId | null
    onToggleSelectAll: () => void
    onToggleSelectContact: (id: string) => void
    onSelectContact: (contact: any) => void
    onResizeStart: (e: React.MouseEvent, col: ColumnDef) => void
    sortConfig?: { key: string; direction: 'asc' | 'desc' }
    onSort?: (key: ColumnId) => void
    onReorderColumns?: (fromIndex: number, toIndex: number) => void
}

const ContactRow = React.memo(function ContactRow({
    contact,
    columns,
    isSelected,
    onSelectContact,
    onToggleSelectContact,
}: {
    contact: any
    columns: ColumnDef[]
    isSelected: boolean
    onSelectContact: (contact: any) => void
    onToggleSelectContact: (id: string) => void
}) {
    const isNewContact = (() => {
        if (!contact.createdAt) return false;
        const createdDate = new Date(contact.createdAt);
        const now = new Date();
        const diffDays = Math.ceil((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 3;
    })();

    return (
        <TableRow
            className={`cursor-pointer hover:bg-muted/50 transition-all ${isSelected ? 'bg-muted/30' : ''} ${isNewContact ? "bg-primary/[0.04] shadow-[inset_4px_0_0_rgba(59,130,246,1)]" : ""}`}
            onClick={() => contact.id !== 'new' && onSelectContact(contact)}
        >
            <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                {contact.id !== 'new' && (
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelectContact(contact.id)}
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
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{contact.name?.charAt(0) ?? "?"}</AvatarFallback>
                                </Avatar>
                                <div className="flex items-center gap-2 truncate">
                                    <span className="whitespace-nowrap">{contact.name}</span>
                                    {isNewContact && (
                                        <Badge className="shrink-0 text-[10px] font-bold tracking-wider bg-primary text-primary-foreground border-0 px-1.5 py-0 h-4">New</Badge>
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
                                <span className="text-xs text-muted-foreground truncate">${contact.dealValue?.toLocaleString()} · {contact.dealStage}</span>
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
})

export function ContactsVirtualTable({
    contacts,
    columns,
    selectedContactIds,
    resizingCol,
    onToggleSelectAll,
    onToggleSelectContact,
    onSelectContact,
    onResizeStart,
    sortConfig,
    onSort,
    onReorderColumns,
}: ContactsVirtualTableProps) {
    const [draggedColId, setDraggedColId] = useState<ColumnId | null>(null)
    const [dragOverColId, setDragOverColId] = useState<ColumnId | null>(null)

    const handleColDragStart = useCallback((e: React.DragEvent, colId: ColumnId) => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", colId)
        setDraggedColId(colId)
    }, [])

    const handleColDragOver = useCallback((e: React.DragEvent, colId: ColumnId) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        if (colId !== draggedColId) {
            setDragOverColId(colId)
        }
    }, [draggedColId])

    const handleColDragLeave = useCallback(() => {
        setDragOverColId(null)
    }, [])

    const handleColDrop = useCallback((e: React.DragEvent, targetColId: ColumnId) => {
        e.preventDefault()
        setDragOverColId(null)
        setDraggedColId(null)

        if (!draggedColId || draggedColId === targetColId || !onReorderColumns) return

        const visibleCols = columns.filter(c => c.visible)
        const fromIdx = columns.findIndex(c => c.id === draggedColId)
        const toIdx = columns.findIndex(c => c.id === targetColId)

        if (fromIdx !== -1 && toIdx !== -1) {
            onReorderColumns(fromIdx, toIdx)
        }
    }, [draggedColId, columns, onReorderColumns])

    const handleColDragEnd = useCallback(() => {
        setDraggedColId(null)
        setDragOverColId(null)
    }, [])

    return (
        <div className="overflow-x-auto">
            <Table className="table-fixed min-w-max">
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10">
                            <Checkbox
                                checked={contacts.length > 0 && selectedContactIds.size === contacts.length}
                                onCheckedChange={onToggleSelectAll}
                                aria-label="Select all"
                            />
                        </TableHead>
                        {columns.filter(c => c.visible).map(col => (
                            <TableHead
                                key={col.id}
                                draggable={!!onReorderColumns}
                                onDragStart={(e) => handleColDragStart(e, col.id)}
                                onDragOver={(e) => handleColDragOver(e, col.id)}
                                onDragLeave={handleColDragLeave}
                                onDrop={(e) => handleColDrop(e, col.id)}
                                onDragEnd={handleColDragEnd}
                                className={`relative group select-none whitespace-nowrap transition-all ${
                                    draggedColId === col.id ? 'opacity-40' : ''
                                } ${
                                    dragOverColId === col.id ? 'bg-primary/10 shadow-[inset_2px_0_0_hsl(var(--primary))]' : ''
                                } ${
                                    onReorderColumns ? 'cursor-grab active:cursor-grabbing' : ''
                                }`}
                                style={{ width: col.width, minWidth: col.width }}
                            >
                                <div className="flex items-center gap-1">
                                    {onReorderColumns && (
                                        <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                                    )}
                                    <button
                                        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={() => onSort?.(col.id)}
                                    >
                                        {col.label}
                                        {sortConfig?.key === col.id && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                    </button>
                                </div>
                                <div
                                    className={`absolute right-0 top-0 h-full w-2 cursor-col-resize transition-colors z-10 ${resizingCol === col.id ? 'bg-primary' : 'hover:bg-primary/50 group-hover:bg-primary/20'}`}
                                    onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, col); }}
                                />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {contacts.map((contact) => (
                        <ContactRow
                            key={contact.id}
                            contact={contact}
                            columns={columns}
                            isSelected={selectedContactIds.has(contact.id)}
                            onSelectContact={onSelectContact}
                            onToggleSelectContact={onToggleSelectContact}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
