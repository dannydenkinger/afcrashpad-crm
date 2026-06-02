"use client"

import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Download,
    FileText,
    Loader2,
    Plus,
    Search,
    Trash2,
    Upload,
    User,
    X,
} from "lucide-react"
import {
    addContactsAction,
    deleteListAction,
    importEmailsToListAction,
    removeMembersAction,
    searchContactsForListAction,
} from "../actions"

interface ContactSearchHit {
    id: string
    name: string
    email: string
}

export interface ListMemberRow {
    memberId: string
    kind: "crm" | "external"
    /** Only present for kind="crm" */
    contactId?: string
    email: string
    name: string
}

interface Props {
    listId: string
    listName: string
    initialMembers: ListMemberRow[]
    initialCount: number
    /** Smart segments: hide the manual-add + CSV-import cards (membership is rule-driven). */
    isSmart?: boolean
}

export function ListDetailClient({
    listId,
    listName,
    initialMembers,
    initialCount,
    isSmart = false,
}: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [members, setMembers] = useState<ListMemberRow[]>(initialMembers)
    const [memberCount, setMemberCount] = useState(initialCount)

    const [searchQ, setSearchQ] = useState("")
    const [searchResults, setSearchResults] = useState<ContactSearchHit[]>([])
    const [searchOpen, setSearchOpen] = useState(false)
    const [searchLoading, setSearchLoading] = useState(false)
    const [pendingAdds, setPendingAdds] = useState<ContactSearchHit[]>([])
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [csvOpen, setCsvOpen] = useState(false)
    const [confirmDeleteList, setConfirmDeleteList] = useState(false)
    const [confirmRemoveMembers, setConfirmRemoveMembers] = useState<string[] | null>(null)

    // Member-side filter (search through visible members locally)
    const [memberFilter, setMemberFilter] = useState("")
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())

    const filteredMembers = useMemo(() => {
        const q = memberFilter.trim().toLowerCase()
        if (!q) return members
        return members.filter(
            (m) =>
                (m.name || "").toLowerCase().includes(q) ||
                (m.email || "").toLowerCase().includes(q),
        )
    }, [members, memberFilter])

    const allFilteredSelected =
        filteredMembers.length > 0 &&
        filteredMembers.every((m) => selectedMembers.has(m.memberId))

    const toggleAllFiltered = () => {
        setSelectedMembers((prev) => {
            const next = new Set(prev)
            if (allFilteredSelected) {
                filteredMembers.forEach((m) => next.delete(m.memberId))
            } else {
                filteredMembers.forEach((m) => next.add(m.memberId))
            }
            return next
        })
    }

    const handleSearchChange = (value: string) => {
        setSearchQ(value)
        setSearchOpen(true)
        setSearchLoading(true)
        if (searchTimer.current) clearTimeout(searchTimer.current)
        searchTimer.current = setTimeout(async () => {
            try {
                const res = await searchContactsForListAction({
                    query: value,
                    listId,
                    limit: 20,
                })
                if (res.success) setSearchResults(res.contacts)
            } finally {
                setSearchLoading(false)
            }
        }, 180)
    }

    const queueAdd = (c: ContactSearchHit) => {
        setPendingAdds((prev) =>
            prev.some((x) => x.id === c.id) ? prev : [...prev, c],
        )
        setSearchOpen(false)
        setSearchQ("")
    }

    const removePending = (id: string) => {
        setPendingAdds((prev) => prev.filter((x) => x.id !== id))
    }

    const commitAdds = () => {
        if (pendingAdds.length === 0) return
        startTransition(async () => {
            const result = await addContactsAction({
                listId,
                contactIds: pendingAdds.map((c) => c.id),
            })
            if (!result.success) {
                toast.error(result.error || "Failed to add contacts")
                return
            }
            toast.success(
                `Added ${result.added ?? 0} contact${result.added === 1 ? "" : "s"}.` +
                    (result.alreadyPresent ? ` ${result.alreadyPresent} already in list.` : ""),
            )
            setMembers((prev) => {
                const ids = new Set(prev.map((x) => x.memberId))
                const added: ListMemberRow[] = pendingAdds
                    .filter((c) => !ids.has(c.id))
                    .map((c) => ({
                        memberId: c.id,
                        kind: "crm" as const,
                        contactId: c.id,
                        email: c.email,
                        name: c.name,
                    }))
                return [...prev, ...added].sort((a, b) =>
                    (a.name || a.email).toLowerCase().localeCompare(
                        (b.name || b.email).toLowerCase(),
                    ),
                )
            })
            setMemberCount((c) => c + (result.added ?? 0))
            setPendingAdds([])
        })
    }

    const handleRemove = (memberId: string) => {
        // Single-row remove is fast — skip the confirm dialog (matches the X icon pattern)
        startTransition(async () => {
            const result = await removeMembersAction({
                listId,
                memberIds: [memberId],
            })
            if (!result.success) {
                toast.error(result.error || "Failed to remove")
                return
            }
            setMembers((prev) => prev.filter((m) => m.memberId !== memberId))
            setSelectedMembers((prev) => {
                const next = new Set(prev)
                next.delete(memberId)
                return next
            })
            setMemberCount((c) => Math.max(0, c - 1))
            toast.success("Removed")
        })
    }

    const performBulkRemove = () => {
        const ids = confirmRemoveMembers
        setConfirmRemoveMembers(null)
        if (!ids || ids.length === 0) return
        startTransition(async () => {
            const result = await removeMembersAction({
                listId,
                memberIds: ids,
            })
            if (!result.success) {
                toast.error(result.error || "Bulk remove failed")
                return
            }
            const removedSet = new Set(ids)
            setMembers((prev) => prev.filter((m) => !removedSet.has(m.memberId)))
            setMemberCount((c) => Math.max(0, c - ids.length))
            setSelectedMembers(new Set())
            toast.success(`Removed ${ids.length} member${ids.length === 1 ? "" : "s"}`)
        })
    }

    const handleDeleteList = () => setConfirmDeleteList(true)

    const performDeleteList = () => {
        setConfirmDeleteList(false)
        startTransition(async () => {
            const result = await deleteListAction(listId)
            if (!result.success) {
                toast.error(result.error || "Failed to delete")
                return
            }
            toast.success("List deleted")
            router.push("/marketing/email/lists")
        })
    }

    const handleExportMembers = () => {
        if (members.length === 0) return
        const rows = [
            ["email", "name", "kind"],
            ...members.map((m) => [m.email, m.name, m.kind]),
        ]
        const csv = rows
            .map((r) =>
                r
                    .map((cell) =>
                        /[",\n]/.test(String(cell))
                            ? `"${String(cell).replace(/"/g, '""')}"`
                            : String(cell),
                    )
                    .join(","),
            )
            .join("\n")
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${listName.replace(/[^a-z0-9]+/gi, "-")}-members.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${members.length} members`)
    }

    const handleCsvImported = (
        result: {
            added: number
            alreadyPresent: number
            invalid: number
            contactsCreated: number
        },
        rows: Array<{ memberId: string; email: string; name: string; kind: "crm" | "external" }>,
    ) => {
        const parts: string[] = []
        parts.push(`${result.added} added`)
        if (result.alreadyPresent) parts.push(`${result.alreadyPresent} already present`)
        if (result.invalid) parts.push(`${result.invalid} invalid`)
        if (result.contactsCreated) parts.push(`${result.contactsCreated} new CRM contacts`)
        toast.success(parts.join(" · "))

        // Optimistically merge rows into the visible list (will refresh on
        // navigation). We only have the rows we attempted to add — duplicates
        // are filtered out client-side by memberId.
        setMembers((prev) => {
            const seen = new Set(prev.map((m) => m.memberId))
            const next = [...prev]
            for (const r of rows) {
                if (seen.has(r.memberId)) continue
                seen.add(r.memberId)
                next.push({
                    memberId: r.memberId,
                    kind: r.kind,
                    contactId: r.kind === "crm" ? r.memberId : undefined,
                    email: r.email,
                    name: r.name,
                })
            }
            return next.sort((a, b) =>
                (a.name || a.email).toLowerCase().localeCompare(
                    (b.name || b.email).toLowerCase(),
                ),
            )
        })
        setMemberCount((c) => c + result.added)
        router.refresh()
    }

    return (
        <div className="space-y-4">
            {!isSmart && (
            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-base">Add members</CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setCsvOpen(true)}
                            disabled={isPending}
                            variant="outline"
                            size="sm"
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Import CSV
                        </Button>
                        <Button
                            onClick={handleDeleteList}
                            disabled={isPending}
                            variant="ghost"
                            size="sm"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete list
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="relative">
                        <div className="flex items-center gap-2 border rounded-md px-2">
                            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                            <Input
                                value={searchQ}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                onFocus={() => {
                                    setSearchOpen(true)
                                    if (searchResults.length === 0) handleSearchChange("")
                                }}
                                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                                placeholder="Search CRM contacts by name or email…"
                                className="border-0 shadow-none focus-visible:ring-0 px-0"
                                disabled={isPending}
                            />
                            {searchLoading && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                            )}
                        </div>
                        {searchOpen && searchResults.length > 0 && (
                            <div className="absolute z-10 left-0 right-0 mt-1 border rounded-md bg-popover shadow-md max-h-64 overflow-auto">
                                {searchResults.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            queueAdd(c)
                                        }}
                                    >
                                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate">{c.name || c.email}</div>
                                            {c.name && c.email && (
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {c.email}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {pendingAdds.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                                Queued ({pendingAdds.length})
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {pendingAdds.map((c) => (
                                    <span
                                        key={c.id}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs"
                                    >
                                        {c.name || c.email}
                                        <button
                                            type="button"
                                            onClick={() => removePending(c.id)}
                                            disabled={isPending}
                                            className="hover:text-destructive"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div>
                                <Button
                                    onClick={commitAdds}
                                    disabled={isPending}
                                    size="sm"
                                >
                                    {isPending ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Plus className="w-4 h-4 mr-2" />
                                    )}
                                    Add {pendingAdds.length} to list
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
            )}

            {isSmart && (
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="text-base">Segment</CardTitle>
                        <Button
                            onClick={handleDeleteList}
                            disabled={isPending}
                            variant="ghost"
                            size="sm"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete segment
                        </Button>
                    </CardHeader>
                </Card>
            )}

            <Card>
                <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="text-base">
                        Members
                        <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                            ({memberCount.toLocaleString()})
                        </span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={memberFilter}
                                onChange={(e) => setMemberFilter(e.target.value)}
                                placeholder="Filter members"
                                className="pl-7 pr-7 h-8 text-sm w-44"
                                disabled={members.length === 0}
                            />
                            {memberFilter && (
                                <button
                                    type="button"
                                    onClick={() => setMemberFilter("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    aria-label="Clear filter"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportMembers}
                            disabled={members.length === 0}
                            className="h-8 gap-1.5"
                            title="Download members as CSV"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {selectedMembers.size > 0 && !isSmart && (
                        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-md text-sm">
                            <span className="text-xs font-medium">
                                {selectedMembers.size} selected
                            </span>
                            <div className="flex-1" />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedMembers(new Set())}
                                className="h-7"
                            >
                                Clear
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                    setConfirmRemoveMembers(Array.from(selectedMembers))
                                }
                                disabled={isPending}
                                className="h-7 gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove {selectedMembers.size}
                            </Button>
                        </div>
                    )}
                    {members.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            No members yet. Search above or import a CSV.
                        </div>
                    ) : filteredMembers.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            No members match &ldquo;{memberFilter}&rdquo;.
                        </div>
                    ) : (
                        <div>
                            {!isSmart && (
                                <div className="flex items-center gap-3 py-2 px-1 border-b text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                                    <input
                                        type="checkbox"
                                        checked={allFilteredSelected}
                                        onChange={toggleAllFiltered}
                                        aria-label="Select all visible"
                                        className="cursor-pointer"
                                    />
                                    <span>{filteredMembers.length} shown</span>
                                </div>
                            )}
                            <div className="divide-y">
                                {filteredMembers.map((m) => (
                                    <div
                                        key={m.memberId}
                                        className="flex items-center justify-between py-2.5 px-1 text-sm gap-3"
                                    >
                                        {!isSmart && (
                                            <input
                                                type="checkbox"
                                                checked={selectedMembers.has(m.memberId)}
                                                onChange={() => {
                                                    setSelectedMembers((prev) => {
                                                        const next = new Set(prev)
                                                        if (next.has(m.memberId))
                                                            next.delete(m.memberId)
                                                        else next.add(m.memberId)
                                                        return next
                                                    })
                                                }}
                                                aria-label={`Select ${m.name || m.email}`}
                                                className="cursor-pointer shrink-0"
                                            />
                                        )}
                                        <div className="min-w-0 flex-1 flex items-center gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate flex items-center gap-2">
                                                    <span>{m.name || m.email || "(no name)"}</span>
                                                    {m.kind === "external" && (
                                                        <span
                                                            className="text-[9px] uppercase tracking-wider font-semibold text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0"
                                                            title="Imported via CSV — not in your CRM contacts"
                                                        >
                                                            External
                                                        </span>
                                                    )}
                                                </div>
                                                {m.email && m.name && (
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {m.email}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {!isSmart && (
                                            <Button
                                                onClick={() => handleRemove(m.memberId)}
                                                disabled={isPending}
                                                variant="ghost"
                                                size="icon"
                                                className="shrink-0"
                                                title="Remove from list"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {memberCount > members.length && !memberFilter && (
                                <div className="py-3 text-center text-xs text-muted-foreground">
                                    Showing {members.length} of {memberCount}. Refresh to see more.
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Branded delete-list confirm */}
            <Dialog open={confirmDeleteList} onOpenChange={setConfirmDeleteList}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            Delete this list?
                        </DialogTitle>
                        <DialogDescription>
                            <span className="font-medium">{listName}</span> will be deleted.
                            Contacts are <em>not</em> deleted — they just leave this list.
                            Any campaigns or automations that target this list will need updating.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDeleteList(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={performDeleteList}>
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Delete list
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Branded bulk-remove confirm */}
            <Dialog
                open={confirmRemoveMembers !== null}
                onOpenChange={(v) => !v && setConfirmRemoveMembers(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            Remove members from list?
                        </DialogTitle>
                        <DialogDescription>
                            {(confirmRemoveMembers?.length ?? 0).toLocaleString()} member
                            {confirmRemoveMembers?.length === 1 ? "" : "s"} will be removed
                            from <span className="font-medium">{listName}</span>. Their contact
                            records stay intact — they just leave this list.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmRemoveMembers(null)}
                        >
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={performBulkRemove}>
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Remove {confirmRemoveMembers?.length ?? 0}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CsvImportDialog
                open={csvOpen}
                onClose={() => setCsvOpen(false)}
                listId={listId}
                onImported={handleCsvImported}
            />
        </div>
    )
}

interface CsvRow {
    [key: string]: string | undefined
}

function CsvImportDialog({
    open,
    onClose,
    listId,
    onImported,
}: {
    open: boolean
    onClose: () => void
    listId: string
    onImported: (
        result: {
            added: number
            alreadyPresent: number
            invalid: number
            contactsCreated: number
        },
        rows: Array<{ memberId: string; email: string; name: string; kind: "crm" | "external" }>,
    ) => void
}) {
    const [file, setFile] = useState<File | null>(null)
    const [parsedRows, setParsedRows] = useState<Array<{ email: string; name?: string }> | null>(null)
    const [parseError, setParseError] = useState<string | null>(null)
    const [alsoCreateContacts, setAlsoCreateContacts] = useState(false)
    const [isPending, startTransition] = useTransition()
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const reset = () => {
        setFile(null)
        setParsedRows(null)
        setParseError(null)
        setAlsoCreateContacts(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    const handleFile = async (chosen: File) => {
        setFile(chosen)
        setParseError(null)
        setParsedRows(null)

        try {
            const Papa = (await import("papaparse")).default
            Papa.parse<CsvRow>(chosen, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const rows = extractEmailRows(results.data)
                    if (rows.length === 0) {
                        setParseError(
                            "No emails found. Make sure your CSV has an 'email' column.",
                        )
                        return
                    }
                    setParsedRows(rows)
                },
                error: (err) => {
                    setParseError(`Failed to parse CSV: ${err.message}`)
                },
            })
        } catch (err) {
            setParseError(err instanceof Error ? err.message : "Failed to read file")
        }
    }

    const handleImport = () => {
        if (!parsedRows || parsedRows.length === 0) return
        startTransition(async () => {
            const res = await importEmailsToListAction({
                listId,
                rows: parsedRows,
                alsoCreateContacts,
            })
            if (!res.success) {
                setParseError(res.error || "Import failed")
                return
            }
            // Build optimistic member rows for the parent to show without
            // a round-trip. The server has already applied the dedupe.
            const memberRows = parsedRows.map((r) => {
                const email = r.email.trim().toLowerCase()
                if (alsoCreateContacts) {
                    // memberId for CRM members is the contactId — we don't know
                    // the actual contactId without a server round-trip, so leave
                    // memberId as a placeholder. router.refresh() will reconcile.
                    return {
                        memberId: `crm-pending-${email}`,
                        email,
                        name: r.name ?? "",
                        kind: "crm" as const,
                    }
                }
                return {
                    memberId: externalMemberIdClient(email),
                    email,
                    name: r.name ?? "",
                    kind: "external" as const,
                }
            })
            onImported(
                {
                    added: res.added,
                    alreadyPresent: res.alreadyPresent,
                    invalid: res.invalid,
                    contactsCreated: res.contactsCreated,
                },
                memberRows,
            )
            handleClose()
        })
    }

    return (
        <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : undefined)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Import emails from CSV</DialogTitle>
                    <DialogDescription>
                        Upload a CSV with an <code>email</code> column. Optional columns:
                        {" "}
                        <code>name</code>, <code>first_name</code>, <code>last_name</code>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {!file && (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 hover:border-primary/40 hover:bg-muted/30 transition-colors text-center space-y-2"
                        >
                            <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
                            <div className="text-sm font-medium">Click to choose a CSV file</div>
                            <div className="text-xs text-muted-foreground">
                                Or drag &amp; drop a .csv here
                            </div>
                        </button>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleFile(f)
                        }}
                    />

                    {file && (
                        <div className="p-3 rounded-md bg-muted/40 border flex items-center gap-3">
                            <FileText className="w-5 h-5 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{file.name}</div>
                                {parsedRows && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        Found {parsedRows.length}{" "}
                                        {parsedRows.length === 1 ? "email" : "emails"}
                                    </div>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={reset}
                                disabled={isPending}
                            >
                                Change
                            </Button>
                        </div>
                    )}

                    {parseError && (
                        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {parseError}
                        </div>
                    )}

                    {parsedRows && parsedRows.length > 0 && (
                        <label className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={alsoCreateContacts}
                                onChange={(e) => setAlsoCreateContacts(e.target.checked)}
                                className="mt-0.5"
                                disabled={isPending}
                            />
                            <div className="text-sm">
                                <div className="font-medium">
                                    Also add as CRM contacts
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                                    By default, these emails will live ONLY on this list — they
                                    won&apos;t show up in your CRM contacts. Check this to also
                                    create real contacts you can manage in the CRM.
                                </div>
                            </div>
                        </label>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={!parsedRows || parsedRows.length === 0 || isPending}
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4 mr-2" />
                        )}
                        Import {parsedRows?.length ?? 0}{" "}
                        {parsedRows?.length === 1 ? "email" : "emails"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/**
 * Pull email + optional name out of arbitrary CSV rows. Looks for an
 * "email" column case-insensitively; falls back to scanning each value for
 * an email address. Combines first_name/last_name if a single "name" column
 * isn't present.
 */
function extractEmailRows(
    rows: CsvRow[],
): Array<{ email: string; name?: string }> {
    const out: Array<{ email: string; name?: string }> = []
    for (const row of rows) {
        const lowerKeys: Record<string, string> = {}
        for (const k of Object.keys(row)) lowerKeys[k.toLowerCase().trim()] = k

        const emailKey =
            lowerKeys["email"] ?? lowerKeys["e-mail"] ?? lowerKeys["email address"]
        let email = emailKey ? (row[emailKey] ?? "").trim() : ""

        if (!email) {
            // fallback: scan every cell for something that looks like an email
            for (const v of Object.values(row)) {
                if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) {
                    email = v.trim()
                    break
                }
            }
        }

        if (!email) continue

        const nameKey = lowerKeys["name"] ?? lowerKeys["full name"] ?? lowerKeys["full_name"]
        let name = nameKey ? (row[nameKey] ?? "").trim() : ""
        if (!name) {
            const first =
                lowerKeys["first_name"] ??
                lowerKeys["first name"] ??
                lowerKeys["firstname"]
            const last =
                lowerKeys["last_name"] ??
                lowerKeys["last name"] ??
                lowerKeys["lastname"]
            const firstVal = first ? (row[first] ?? "").trim() : ""
            const lastVal = last ? (row[last] ?? "").trim() : ""
            name = [firstVal, lastVal].filter(Boolean).join(" ").trim()
        }

        out.push({ email, name: name || undefined })
    }
    return out
}

/** Client-side mirror of the server's externalMemberId — sha256 of lower email, first 24 hex. */
function externalMemberIdClient(email: string): string {
    // Web Crypto subtle.digest is async; for client-side optimistic display we
    // fall back to a simple FNV hash that's unique within a session. The next
    // router.refresh() reconciles to the real server doc IDs.
    let h = 2166136261
    const e = email.trim().toLowerCase()
    for (let i = 0; i < e.length; i++) {
        h ^= e.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return "ext_" + (h >>> 0).toString(16).padStart(8, "0")
}
