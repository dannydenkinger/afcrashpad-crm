"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
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
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Merge, Check, Loader2 } from "lucide-react"
import { mergeContacts } from "./actions"
import { toast } from "sonner"

interface ContactMergeDialogProps {
    isOpen: boolean
    onClose: () => void
    contactA: any | null
    contactB: any | null
    onMergeComplete: () => void
}

const MERGE_FIELDS = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "militaryBase", label: "Military Base" },
    { key: "businessName", label: "Business Name" },
    { key: "status", label: "Status" },
    { key: "stayStartDate", label: "Stay Start Date" },
    { key: "stayEndDate", label: "Stay End Date" },
]

export function ContactMergeDialog({
    isOpen,
    onClose,
    contactA,
    contactB,
    onMergeComplete,
}: ContactMergeDialogProps) {
    const [fieldChoices, setFieldChoices] = useState<Record<string, "primary" | "secondary">>({})
    const [isMerging, setIsMerging] = useState(false)
    const [showMergeConfirm, setShowMergeConfirm] = useState(false)

    const effectiveChoices = useMemo(() => {
        const choices: Record<string, string> = {}
        for (const f of MERGE_FIELDS) {
            choices[f.key] = fieldChoices[f.key] || "primary"
        }
        return choices
    }, [fieldChoices])

    if (!contactA || !contactB) return null

    const formatValue = (val: any, key: string): string => {
        if (!val) return "--"
        if (key === "stayStartDate" || key === "stayEndDate") {
            try {
                return new Date(val).toLocaleDateString()
            } catch {
                return String(val)
            }
        }
        return String(val)
    }

    const notesA = contactA.notes?.length || 0
    const notesB = contactB.notes?.length || 0
    const docsA = contactA.documents?.length || 0
    const docsB = contactB.documents?.length || 0
    const oppsA = contactA.opportunities?.length || 0
    const oppsB = contactB.opportunities?.length || 0

    const handleMerge = async () => {
        setIsMerging(true)
        try {
            const res = await mergeContacts(contactA.id, contactB.id, effectiveChoices)
            if (res.success) {
                toast.success("Contacts merged successfully")
                onMergeComplete()
                onClose()
            } else {
                toast.error(res.error || "Failed to merge contacts")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setIsMerging(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Merge className="h-5 w-5" />
                        Merge Contacts
                    </DialogTitle>
                    <DialogDescription>
                        Compare and choose which value to keep for each field. Notes, documents, and deals from both contacts will be combined into the surviving contact.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 min-h-0 pr-4">
                    <div className="space-y-4">
                        {/* Field-by-field comparison */}
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/30 border-b">
                                        <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground w-28">Field</th>
                                        <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1.5">
                                                {contactA.name || "Contact A"}
                                                <Badge className="text-[10px]">Primary</Badge>
                                            </div>
                                        </th>
                                        <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground">
                                            {contactB.name || "Contact B"}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MERGE_FIELDS.map((f) => {
                                        const valA = formatValue(contactA[f.key], f.key)
                                        const valB = formatValue(contactB[f.key], f.key)
                                        const choice = fieldChoices[f.key] || "primary"
                                        const isDifferent = valA !== valB

                                        return (
                                            <tr key={f.key} className="border-b last:border-0">
                                                <td className="px-3 py-2.5 font-medium text-xs text-muted-foreground align-middle">
                                                    {f.label}
                                                </td>
                                                <td
                                                    className={`px-3 py-2.5 cursor-pointer transition-colors ${
                                                        choice === "primary"
                                                            ? "bg-primary/10 ring-1 ring-inset ring-primary/20"
                                                            : "hover:bg-muted/30"
                                                    }`}
                                                    onClick={() =>
                                                        setFieldChoices((prev) => ({ ...prev, [f.key]: "primary" }))
                                                    }
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                                                choice === "primary"
                                                                    ? "border-primary bg-primary text-primary-foreground"
                                                                    : "border-muted-foreground/30"
                                                            }`}
                                                        >
                                                            {choice === "primary" && <Check className="h-2.5 w-2.5" />}
                                                        </div>
                                                        <span className={`text-sm ${choice === "primary" ? "font-semibold" : ""}`}>
                                                            {valA}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td
                                                    className={`px-3 py-2.5 cursor-pointer transition-colors ${
                                                        choice === "secondary"
                                                            ? "bg-primary/10 ring-1 ring-inset ring-primary/20"
                                                            : "hover:bg-muted/30"
                                                    }`}
                                                    onClick={() =>
                                                        setFieldChoices((prev) => ({ ...prev, [f.key]: "secondary" }))
                                                    }
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                                                choice === "secondary"
                                                                    ? "border-primary bg-primary text-primary-foreground"
                                                                    : "border-muted-foreground/30"
                                                            }`}
                                                        >
                                                            {choice === "secondary" && <Check className="h-2.5 w-2.5" />}
                                                        </div>
                                                        <span className={`text-sm ${choice === "secondary" ? "font-semibold" : ""} ${isDifferent && choice !== "secondary" ? "text-muted-foreground" : ""}`}>
                                                            {valB}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Data that will be merged automatically */}
                        <div className="border rounded-lg p-4 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Automatically Combined
                            </p>
                            <p className="text-xs text-muted-foreground">
                                The following data from both contacts will be merged into the surviving contact:
                            </p>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div className="flex flex-col items-center p-2 rounded-lg bg-muted/30">
                                    <span className="text-lg font-bold">{notesA + notesB}</span>
                                    <span className="text-xs text-muted-foreground">Notes</span>
                                </div>
                                <div className="flex flex-col items-center p-2 rounded-lg bg-muted/30">
                                    <span className="text-lg font-bold">{docsA + docsB}</span>
                                    <span className="text-xs text-muted-foreground">Documents</span>
                                </div>
                                <div className="flex flex-col items-center p-2 rounded-lg bg-muted/30">
                                    <span className="text-lg font-bold">{oppsA + oppsB}</span>
                                    <span className="text-xs text-muted-foreground">Deals</span>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground italic">
                                Tags and form tracking will also be merged (union). The secondary contact will be deleted after merge.
                            </p>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isMerging}>
                        Cancel
                    </Button>
                    <Button onClick={() => setShowMergeConfirm(true)} disabled={isMerging}>
                        {isMerging ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Merging...
                            </>
                        ) : (
                            <>
                                <Merge className="mr-2 h-4 w-4" />
                                Merge Contacts
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>

            <AlertDialog open={showMergeConfirm} onOpenChange={setShowMergeConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Merge these contacts?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The secondary contact ({contactB?.name || "Contact B"}) will be permanently deleted, and all their notes, documents, and deals will be merged into the primary contact ({contactA?.name || "Contact A"}).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={handleMerge}
                        >
                            Merge Contacts
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    )
}
