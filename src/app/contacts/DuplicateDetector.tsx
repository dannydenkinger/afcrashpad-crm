"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Users, Search, Merge, Check, Mail, Phone, User, Loader2 } from "lucide-react"
import { findDuplicateContacts, mergeMultipleContacts } from "./actions"
import type { DuplicateGroup, DuplicateContact } from "./types"
import { toast } from "sonner"

interface DuplicateDetectorProps {
    onMergeComplete: () => void;
}

export function DuplicateDetector({ onMergeComplete }: DuplicateDetectorProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [merging, setMerging] = useState<string | null>(null)
    const [groups, setGroups] = useState<DuplicateGroup[]>([])
    const [scanned, setScanned] = useState(false)
    // Track which contact is selected as primary per group (keyed by group index)
    const [primarySelections, setPrimarySelections] = useState<Record<number, string>>({})

    async function handleScan() {
        setLoading(true)
        setScanned(false)
        try {
            const res = await findDuplicateContacts()
            if (res.success && res.duplicates) {
                setGroups(res.duplicates)
                // Default: first contact in each group is primary
                const defaults: Record<number, string> = {}
                res.duplicates.forEach((g, i) => {
                    if (g.contacts.length > 0) {
                        defaults[i] = g.contacts[0].id
                    }
                })
                setPrimarySelections(defaults)
            } else {
                toast.error(res.error || "Failed to scan for duplicates")
                setGroups([])
            }
            setScanned(true)
        } catch {
            toast.error("Failed to scan for duplicates")
        } finally {
            setLoading(false)
        }
    }

    async function handleMerge(groupIndex: number) {
        const group = groups[groupIndex]
        if (!group) return

        const primaryId = primarySelections[groupIndex]
        if (!primaryId) {
            toast.error("Please select a primary contact first")
            return
        }

        const duplicateIds = group.contactIds.filter(id => id !== primaryId)
        if (duplicateIds.length === 0) return

        setMerging(primaryId)
        try {
            const res = await mergeMultipleContacts(primaryId, duplicateIds)
            if (res.success) {
                toast.success("Contacts merged successfully")
                // Remove this group from the list
                setGroups(prev => prev.filter((_, i) => i !== groupIndex))
                // Re-index primary selections
                setPrimarySelections(prev => {
                    const next: Record<number, string> = {}
                    const remaining = groups.filter((_, i) => i !== groupIndex)
                    remaining.forEach((g, i) => {
                        const oldIndex = groups.indexOf(g)
                        next[i] = prev[oldIndex] || g.contacts[0]?.id || ""
                    })
                    return next
                })
                onMergeComplete()
            } else {
                toast.error(res.error || "Failed to merge contacts")
            }
        } catch {
            toast.error("Failed to merge contacts")
        } finally {
            setMerging(null)
        }
    }

    function matchTypeBadge(type: string) {
        switch (type) {
            case "email":
                return <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" />Email Match</Badge>
            case "phone":
                return <Badge variant="secondary" className="gap-1"><Phone className="h-3 w-3" />Phone Match</Badge>
            case "name":
                return <Badge variant="secondary" className="gap-1"><User className="h-3 w-3" />Name Match</Badge>
            default:
                return <Badge variant="secondary">{type}</Badge>
        }
    }

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="touch-manipulation"
                onClick={() => {
                    setOpen(true)
                    if (!scanned) handleScan()
                }}
            >
                <Users className="mr-2 h-4 w-4" />
                Find Duplicates
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Duplicate Contact Detection
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 min-h-0">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">Scanning contacts for duplicates...</p>
                            </div>
                        ) : scanned && groups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <Check className="h-10 w-10 text-green-500" />
                                <p className="text-base font-medium">No duplicates found</p>
                                <p className="text-sm text-muted-foreground">All contacts appear to be unique.</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-[60vh] pr-4">
                                <div className="space-y-6">
                                    <p className="text-sm text-muted-foreground">
                                        Found {groups.length} potential duplicate group{groups.length !== 1 ? "s" : ""}.
                                        For each group, select the primary contact to keep, then click Merge. Data from
                                        duplicates will be merged into the primary.
                                    </p>
                                    {groups.map((group, gi) => (
                                        <div key={gi} className="border rounded-lg overflow-hidden">
                                            <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 border-b">
                                                <div className="flex items-center gap-2">
                                                    {matchTypeBadge(group.matchType)}
                                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                        {group.matchValue}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {group.contacts.length} contacts
                                                </span>
                                            </div>

                                            <div className="divide-y">
                                                {group.contacts.map((contact) => {
                                                    const isPrimary = primarySelections[gi] === contact.id
                                                    return (
                                                        <div
                                                            key={contact.id}
                                                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                                                isPrimary
                                                                    ? "bg-primary/5 ring-1 ring-inset ring-primary/20"
                                                                    : "hover:bg-muted/30"
                                                            }`}
                                                            onClick={() =>
                                                                setPrimarySelections(prev => ({
                                                                    ...prev,
                                                                    [gi]: contact.id,
                                                                }))
                                                            }
                                                        >
                                                            <div
                                                                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                                    isPrimary
                                                                        ? "border-primary bg-primary text-primary-foreground"
                                                                        : "border-muted-foreground/30"
                                                                }`}
                                                            >
                                                                {isPrimary && <Check className="h-3 w-3" />}
                                                            </div>

                                                            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                                                                <div className="truncate">
                                                                    <p className="text-sm font-medium truncate">
                                                                        {contact.name || "No name"}
                                                                    </p>
                                                                    {contact.businessName && (
                                                                        <p className="text-xs text-muted-foreground truncate">
                                                                            {contact.businessName}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="truncate">
                                                                    {contact.email && (
                                                                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                                            <Mail className="h-3 w-3 flex-shrink-0" />
                                                                            {contact.email}
                                                                        </p>
                                                                    )}
                                                                    {contact.phone && (
                                                                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                                            <Phone className="h-3 w-3 flex-shrink-0" />
                                                                            {contact.phone}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    {contact.status && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {contact.status}
                                                                        </Badge>
                                                                    )}
                                                                    {isPrimary && (
                                                                        <Badge className="text-xs">Primary</Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            <div className="flex items-center justify-between bg-muted/20 px-4 py-2 border-t">
                                                <p className="text-xs text-muted-foreground">
                                                    Click a contact to set it as primary (keeper)
                                                </p>
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    disabled={merging !== null}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleMerge(gi)
                                                    }}
                                                >
                                                    {merging === primarySelections[gi] ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                            Merging...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Merge className="mr-2 h-3.5 w-3.5" />
                                                            Merge ({group.contacts.length - 1} into 1)
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>

                    <Separator />

                    <DialogFooter className="flex-row justify-between sm:justify-between">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleScan}
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="mr-2 h-4 w-4" />
                            )}
                            Re-scan
                        </Button>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
