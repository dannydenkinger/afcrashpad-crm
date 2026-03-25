"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { FileDropZone } from "@/components/ui/FileDropZone"
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
// papaparse is dynamically imported in handlers to reduce initial bundle size

interface CSVImportDialogProps {
    isOpen: boolean
    onClose: () => void
    onImport: (data: any[]) => Promise<{ success: boolean; count?: number; error?: string }>
    title: string
    description: string
    templateFields: string[]
}

export function CSVImportDialog({
    isOpen,
    onClose,
    onImport,
    title,
    description,
    templateFields
}: CSVImportDialogProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successCount, setSuccessCount] = useState<number | null>(null)

    const handleFilesSelected = (files: File[]) => {
        const selectedFile = files[0]
        if (selectedFile) {
            if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
                setError("Please upload a valid CSV file.")
                return
            }
            setFile(selectedFile)
            setError(null)
            setSuccessCount(null)
        }
    }

    const handleImport = async () => {
        if (!file) return

        setIsUploading(true)
        setError(null)

        const Papa = (await import("papaparse")).default
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const res = await onImport(results.data)
                    if (res.success) {
                        setSuccessCount(res.count || results.data.length)
                        setTimeout(() => {
                            onClose()
                            setFile(null)
                            setSuccessCount(null)
                        }, 2000)
                    } else {
                        setError(res.error || "Failed to import data.")
                    }
                } catch (err) {
                    setError("An unexpected error occurred during import.")
                } finally {
                    setIsUploading(false)
                }
            },
            error: (err) => {
                setError(`Failed to parse CSV: ${err.message}`)
                setIsUploading(false)
            }
        })
    }

    const downloadTemplate = async () => {
        const Papa = (await import("papaparse")).default
        const csv = Papa.unparse([
            templateFields.reduce((acc, field) => ({ ...acc, [field]: "" }), {})
        ])
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", "import_template.csv")
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {!file && !successCount && (
                        <FileDropZone
                            onFilesSelected={handleFilesSelected}
                            accept=".csv"
                        >
                            <FileText className="h-10 w-10 text-muted-foreground" />
                            <p className="text-sm font-medium">Drag & drop CSV file here or click to browse</p>
                        </FileDropZone>
                    )}

                    {file && !successCount && (
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col items-center gap-2 text-center">
                            <FileText className="h-8 w-8 text-primary" />
                            <p className="text-sm font-semibold">{file.name}</p>
                            <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="h-7 text-xs">
                                Change File
                            </Button>
                        </div>
                    )}

                    {successCount !== null && (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center gap-2 text-center text-emerald-600">
                            <CheckCircle2 className="h-10 w-10" />
                            <p className="text-sm font-bold">Successfully imported {successCount} records!</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                            <AlertCircle className="h-4 w-4" />
                            {error}
                        </div>
                    )}

                    <Button
                        variant="link"
                        size="sm"
                        onClick={downloadTemplate}
                        className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    >
                        Download Template
                    </Button>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isUploading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={!file || isUploading || successCount !== null}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Importing...
                            </>
                        ) : "Import Now"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
