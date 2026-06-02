"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { FileDropZone } from "@/components/ui/FileDropZone"
import {
    Upload, FileText, CheckCircle2, AlertCircle, Loader2,
    ArrowRight, ChevronLeft, ChevronRight,
} from "lucide-react"
// papaparse is dynamically imported in handlers to reduce initial bundle size
import { importMappedContacts } from "./actions"
import { toast } from "sonner"

const CRM_FIELDS = [
    { value: "skip", label: "-- Skip --" },
    { value: "name", label: "Name" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "businessName", label: "Business Name" },
    { value: "status", label: "Status" },
]

interface ImportMappingDialogProps {
    isOpen: boolean
    onClose: () => void
    onImportComplete: () => void
}

export function ImportMappingDialog({ isOpen, onClose, onImportComplete }: ImportMappingDialogProps) {
    const [step, setStep] = useState<"upload" | "map" | "result">("upload")
    const [file, setFile] = useState<File | null>(null)
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [csvRows, setCsvRows] = useState<Record<string, any>[]>([])
    const [mapping, setMapping] = useState<Record<string, string>>({})
    const [isImporting, setIsImporting] = useState(false)
    const [result, setResult] = useState<{ imported: number; skipped: number; errors?: string[] } | null>(null)
    const [parseError, setParseError] = useState<string | null>(null)

    const handleReset = useCallback(() => {
        setStep("upload")
        setFile(null)
        setCsvHeaders([])
        setCsvRows([])
        setMapping({})
        setResult(null)
        setParseError(null)
    }, [])

    const handleFilesSelected = useCallback(async (files: File[]) => {
        const selectedFile = files[0]
        if (!selectedFile) return

        if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
            setParseError("Please upload a valid CSV file.")
            return
        }

        setParseError(null)
        setFile(selectedFile)

        const Papa = (await import("papaparse")).default
        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            preview: 0,
            complete: (results) => {
                if (!results.meta.fields || results.meta.fields.length === 0) {
                    setParseError("CSV file has no recognizable headers.")
                    return
                }

                const headers = results.meta.fields
                setCsvHeaders(headers)
                setCsvRows(results.data as Record<string, any>[])

                // Auto-map by matching header names to CRM fields
                const autoMapping: Record<string, string> = {}
                for (const header of headers) {
                    const h = header.toLowerCase().trim()
                    if (h.includes("name") && !h.includes("business")) autoMapping[header] = "name"
                    else if (h.includes("email") || h.includes("e-mail")) autoMapping[header] = "email"
                    else if (h.includes("phone") || h.includes("mobile") || h.includes("cell")) autoMapping[header] = "phone"
                    else if (h.includes("business") || h.includes("company") || h.includes("organization")) autoMapping[header] = "businessName"
                    else if (h.includes("status")) autoMapping[header] = "status"
                    else autoMapping[header] = "skip"
                }

                setMapping(autoMapping)
                setStep("map")
            },
            error: (err) => {
                setParseError(`Failed to parse CSV: ${err.message}`)
            },
        })
    }, [])

    const handleImport = async () => {
        setIsImporting(true)
        try {
            const res = await importMappedContacts(csvRows, mapping)
            if (res.success) {
                setResult({ imported: res.imported, skipped: res.skipped, errors: res.errors })
                setStep("result")
                onImportComplete()
                toast.success(`Imported ${res.imported} contact${res.imported !== 1 ? "s" : ""}`)
            } else {
                toast.error(res.error || "Failed to import contacts")
            }
        } catch {
            toast.error("An unexpected error occurred during import")
        } finally {
            setIsImporting(false)
        }
    }

    const previewRows = csvRows.slice(0, 3)
    const mappedFieldCount = Object.values(mapping).filter(v => v !== "skip").length

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); handleReset(); } }}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        Import Contacts
                    </DialogTitle>
                    <DialogDescription>
                        {step === "upload" && "Upload a CSV file to import contacts."}
                        {step === "map" && "Map CSV columns to CRM fields, then review the preview."}
                        {step === "result" && "Import complete."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
                    {/* Step 1: Upload */}
                    {step === "upload" && (
                        <>
                            <FileDropZone
                                onFilesSelected={handleFilesSelected}
                                accept=".csv"
                            >
                                <FileText className="h-10 w-10 text-muted-foreground" />
                                <p className="text-sm font-medium">Drag & drop CSV file here or click to browse</p>
                                <p className="text-xs text-muted-foreground">Supports any CSV format. You will map columns in the next step.</p>
                            </FileDropZone>

                            {parseError && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {parseError}
                                </div>
                            )}
                        </>
                    )}

                    {/* Step 2: Mapping */}
                    {step === "map" && (
                        <>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">{file?.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {csvRows.length} row{csvRows.length !== 1 ? "s" : ""} found, {csvHeaders.length} column{csvHeaders.length !== 1 ? "s" : ""}, {mappedFieldCount} mapped
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={handleReset}>
                                    <ChevronLeft className="mr-1 h-3 w-3" />
                                    Change File
                                </Button>
                            </div>

                            {/* Column mapping */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted/30 px-4 py-2 border-b">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Column Mapping</p>
                                </div>
                                <div className="divide-y">
                                    {csvHeaders.map((header) => (
                                        <div key={header} className="flex items-center gap-3 px-4 py-2.5">
                                            <span className="text-sm font-medium flex-1 min-w-0 truncate">{header}</span>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <select
                                                value={mapping[header] || "skip"}
                                                onChange={(e) => setMapping(prev => ({ ...prev, [header]: e.target.value }))}
                                                className="flex h-8 w-44 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            >
                                                {CRM_FIELDS.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Preview */}
                            {previewRows.length > 0 && mappedFieldCount > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="bg-muted/30 px-4 py-2 border-b">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Preview (first {previewRows.length} row{previewRows.length !== 1 ? "s" : ""})
                                        </p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/10">
                                                    {Object.entries(mapping)
                                                        .filter(([, v]) => v !== "skip")
                                                        .map(([csvCol, crmField]) => (
                                                            <th key={csvCol} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
                                                                {CRM_FIELDS.find(f => f.value === crmField)?.label || crmField}
                                                            </th>
                                                        ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewRows.map((row, i) => (
                                                    <tr key={i} className="border-b last:border-0">
                                                        {Object.entries(mapping)
                                                            .filter(([, v]) => v !== "skip")
                                                            .map(([csvCol]) => (
                                                                <td key={csvCol} className="px-3 py-2 text-sm truncate max-w-[180px]">
                                                                    {row[csvCol] || <span className="text-muted-foreground italic">empty</span>}
                                                                </td>
                                                            ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Step 3: Result */}
                    {step === "result" && result && (
                        <div className="space-y-4">
                            <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center gap-3 text-center">
                                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                                <div>
                                    <p className="text-base font-bold text-emerald-600">
                                        Successfully imported {result.imported} contact{result.imported !== 1 ? "s" : ""}
                                    </p>
                                    {result.skipped > 0 && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped (missing name/email or invalid data)
                                        </p>
                                    )}
                                </div>
                            </div>

                            {result.errors && result.errors.length > 0 && (
                                <div className="border rounded-lg p-3 space-y-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Skipped Rows</p>
                                    {result.errors.slice(0, 10).map((err, i) => (
                                        <p key={i} className="text-xs text-muted-foreground">{err}</p>
                                    ))}
                                    {result.errors.length > 10 && (
                                        <p className="text-xs text-muted-foreground italic">
                                            ...and {result.errors.length - 10} more
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {step === "upload" && (
                        <Button variant="outline" onClick={() => { onClose(); handleReset(); }}>
                            Cancel
                        </Button>
                    )}
                    {step === "map" && (
                        <>
                            <Button variant="outline" onClick={handleReset} disabled={isImporting}>
                                Back
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={isImporting || mappedFieldCount === 0}
                            >
                                {isImporting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Importing {csvRows.length} rows...
                                    </>
                                ) : (
                                    <>
                                        Import {csvRows.length} Row{csvRows.length !== 1 ? "s" : ""}
                                        <ChevronRight className="ml-1 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                    {step === "result" && (
                        <Button onClick={() => { onClose(); handleReset(); }}>
                            Done
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
