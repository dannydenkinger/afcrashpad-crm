"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    Download,
    FileText,
    Image as ImageIcon,
    FileSpreadsheet,
    Loader2,
    ExternalLink,
    PenLine,
    Copy,
    Check,
} from "lucide-react"
import { requestSignature } from "./signature-actions"

interface DocumentPreviewProps {
    document: {
        id: string
        name: string
        url: string
        status: string
        createdAt: string
        generatedContent?: string
        signatureUrl?: string
        folder?: string
    } | null
    open: boolean
    onOpenChange: (open: boolean) => void
    contactId?: string
    onRefresh?: () => void
}

function getFileExtension(name: string): string {
    return name.split(".").pop()?.toLowerCase() || ""
}

type FileType = "image" | "pdf" | "csv" | "office" | "text" | "generated" | "other"

function getFileType(name: string, hasGeneratedContent?: boolean): FileType {
    if (hasGeneratedContent) return "generated"
    const ext = getFileExtension(name)
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image"
    if (ext === "pdf") return "pdf"
    if (ext === "csv") return "csv"
    if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office"
    if (["txt", "md"].includes(ext)) return "text"
    return "other"
}

function getFileTypeLabel(name: string): string {
    const ext = getFileExtension(name)
    const labels: Record<string, string> = {
        doc: "Word Document",
        docx: "Word Document",
        xls: "Excel Spreadsheet",
        xlsx: "Excel Spreadsheet",
        csv: "CSV File",
        txt: "Text File",
        md: "Markdown File",
        pdf: "PDF Document",
        ppt: "PowerPoint",
        pptx: "PowerPoint",
        jpg: "JPEG Image",
        jpeg: "JPEG Image",
        png: "PNG Image",
        gif: "GIF Image",
        webp: "WebP Image",
    }
    return labels[ext] || `${ext.toUpperCase()} File`
}

function getFileIcon(name: string) {
    const type = getFileType(name)
    if (type === "image") return <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
    if (type === "pdf") return <FileText className="h-10 w-10 text-red-400/60" />
    if (type === "csv" || type === "office") return <FileSpreadsheet className="h-10 w-10 text-green-400/60" />
    return <FileText className="h-10 w-10 text-muted-foreground/40" />
}

function CSVTable({ url }: { url: string }) {
    const [rows, setRows] = useState<string[][]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        async function fetchCSV() {
            try {
                setLoading(true)
                const response = await fetch(url)
                if (!response.ok) throw new Error("Failed to fetch CSV")
                const text = await response.text()

                // Simple CSV parser (handles quoted fields)
                const lines = text.split("\n").filter(l => l.trim())
                const parsed = lines.map(line => {
                    const result: string[] = []
                    let current = ""
                    let inQuotes = false
                    for (let i = 0; i < line.length; i++) {
                        const ch = line[i]
                        if (ch === '"') {
                            inQuotes = !inQuotes
                        } else if (ch === "," && !inQuotes) {
                            result.push(current.trim())
                            current = ""
                        } else {
                            current += ch
                        }
                    }
                    result.push(current.trim())
                    return result
                })

                if (!cancelled) {
                    setRows(parsed)
                    setLoading(false)
                }
            } catch {
                if (!cancelled) {
                    setError("Could not load CSV preview")
                    setLoading(false)
                }
            }
        }
        fetchCSV()
        return () => { cancelled = true }
    }, [url])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
            </div>
        )
    }

    if (error || rows.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 py-12">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">{error || "No data in CSV file."}</p>
            </div>
        )
    }

    const headers = rows[0]
    const dataRows = rows.slice(1, 101) // Limit to first 100 rows for performance

    return (
        <div className="overflow-auto max-h-[70vh] p-4">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="text-left p-2 border-b-2 border-border font-semibold bg-muted/30 whitespace-nowrap sticky top-0">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {dataRows.map((row, ri) => (
                        <tr key={ri} className="hover:bg-muted/10">
                            {row.map((cell, ci) => (
                                <td key={ci} className="p-2 border-b border-border/30 whitespace-nowrap max-w-[300px] truncate">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length > 101 && (
                <p className="text-xs text-muted-foreground mt-3 text-center">
                    Showing first 100 of {rows.length - 1} rows
                </p>
            )}
        </div>
    )
}

export function DocumentPreview({ document, open, onOpenChange, contactId, onRefresh }: DocumentPreviewProps) {
    const [isImageLoading, setIsImageLoading] = useState(true)
    const [imageError, setImageError] = useState(false)
    const [isRequestingSignature, setIsRequestingSignature] = useState(false)
    const [signingLink, setSigningLink] = useState<string | null>(null)
    const [linkCopied, setLinkCopied] = useState(false)
    const [officeViewerFailed, setOfficeViewerFailed] = useState(false)

    // Reset state when document changes
    useEffect(() => {
        setIsImageLoading(true)
        setImageError(false)
        setSigningLink(null)
        setLinkCopied(false)
        setOfficeViewerFailed(false)
    }, [document?.id])

    const handleRequestSignature = useCallback(async () => {
        if (!document || !contactId) return
        setIsRequestingSignature(true)
        try {
            const res = await requestSignature(document.id, contactId)
            if (res.success && res.signingLink) {
                const fullLink = `${window.location.origin}${res.signingLink}`
                setSigningLink(fullLink)
                onRefresh?.()
            }
        } catch {
            // silent fail
        }
        setIsRequestingSignature(false)
    }, [document, contactId, onRefresh])

    const handleCopyLink = useCallback(async () => {
        if (!signingLink) return
        try {
            await navigator.clipboard.writeText(signingLink)
            setLinkCopied(true)
            setTimeout(() => setLinkCopied(false), 2000)
        } catch {
            // fallback
        }
    }, [signingLink])

    if (!document) return null

    const fileType = getFileType(document.name, !!document.generatedContent)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] max-w-[100vw] flex flex-col gap-0 p-0 border-none shadow-md bg-card/95 backdrop-blur-md">
                <DialogHeader className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border/40 shrink-0">
                    <div className="flex flex-col gap-2 pr-8">
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <DialogTitle className="text-sm font-semibold truncate">
                                {document.name}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                {document.generatedContent
                                    ? "Generated Document"
                                    : getFileTypeLabel(document.name)}
                                {" "}&mdash; {new Date(document.createdAt).toLocaleDateString()}
                                {document.folder && document.folder !== "General" && (
                                    <span className="ml-2 text-muted-foreground/60">in {document.folder}</span>
                                )}
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Open in new tab — best mobile experience */}
                            {document.url && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1.5"
                                    asChild
                                >
                                    <a href={document.url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Open in new tab
                                    </a>
                                </Button>
                            )}
                            {/* E-Signature button */}
                            {contactId && document.status !== "SIGNED" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1.5"
                                    onClick={handleRequestSignature}
                                    disabled={isRequestingSignature}
                                >
                                    {isRequestingSignature ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <PenLine className="h-3.5 w-3.5" />
                                    )}
                                    <span className="hidden sm:inline">Request</span> Signature
                                </Button>
                            )}
                            {document.url && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1.5"
                                    asChild
                                >
                                    <a href={document.url} download target="_blank" rel="noopener noreferrer">
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                {/* Signing link notification */}
                {signingLink && (
                    <div className="mx-5 mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                            Signing link generated. Share this with the contact:
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-[11px] p-2 rounded bg-white dark:bg-background border truncate">
                                {signingLink}
                            </code>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1 shrink-0"
                                onClick={handleCopyLink}
                            >
                                {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {linkCopied ? "Copied" : "Copy"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Signature display when signed */}
                {document.signatureUrl && document.status === "SIGNED" && (
                    <div className="mx-5 mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-2">
                            Document signed
                        </p>
                        <Image
                            src={document.signatureUrl}
                            alt="Signature"
                            width={200}
                            height={64}
                            className="max-h-16 border rounded bg-white object-contain"
                            unoptimized
                        />
                    </div>
                )}

                <div className="flex-1 overflow-auto min-h-0">
                    {/* Generated HTML content preview */}
                    {fileType === "generated" && document.generatedContent && (
                        <div className="p-6">
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-white dark:bg-background"
                                dangerouslySetInnerHTML={{ __html: document.generatedContent }}
                            />
                        </div>
                    )}

                    {/* Image preview */}
                    {fileType === "image" && (
                        <div className="relative flex items-center justify-center p-4 min-h-[300px]">
                            {isImageLoading && !imageError && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
                                </div>
                            )}
                            {imageError ? (
                                <div className="flex flex-col items-center gap-3 py-12">
                                    <ImageIcon className="h-12 w-12 text-muted-foreground/20" />
                                    <p className="text-sm text-muted-foreground">Unable to load image preview.</p>
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={document.url} target="_blank" rel="noopener noreferrer">
                                            Open in new tab
                                        </a>
                                    </Button>
                                </div>
                            ) : (
                                <div className="w-full flex items-center justify-center">
                                    <img
                                        src={document.url}
                                        alt={document.name}
                                        className="max-w-full max-h-[65vh] sm:max-h-[70vh] object-contain rounded-md"
                                        onLoad={() => setIsImageLoading(false)}
                                        onError={() => {
                                            setIsImageLoading(false)
                                            setImageError(true)
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* PDF preview */}
                    {fileType === "pdf" && (
                        <div className="flex-1 flex flex-col min-h-0">
                            <iframe
                                src={`${document.url}#view=FitH`}
                                title={document.name}
                                className="w-full flex-1 min-h-[60vh] border-none"
                            />
                        </div>
                    )}

                    {/* CSV preview with table */}
                    {fileType === "csv" && (
                        <CSVTable url={document.url} />
                    )}

                    {/* Office files: try Google Docs Viewer, fallback to download */}
                    {fileType === "office" && (
                        <div className="flex flex-col min-h-[400px]">
                            {!officeViewerFailed ? (
                                <>
                                    <iframe
                                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(document.url)}&embedded=true`}
                                        title={document.name}
                                        className="w-full flex-1 min-h-[70vh] border-none"
                                        onError={() => setOfficeViewerFailed(true)}
                                    />
                                    <div className="p-3 border-t border-border/40 flex items-center justify-between">
                                        <p className="text-[10px] text-muted-foreground">
                                            Preview powered by Google Docs Viewer. If preview does not load, the file URL may not be publicly accessible.
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-[10px]"
                                                onClick={() => setOfficeViewerFailed(true)}
                                            >
                                                Preview not working?
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-4 py-16 px-6">
                                    {getFileIcon(document.name)}
                                    <div className="text-center space-y-1">
                                        <p className="text-sm font-medium">{document.name}</p>
                                        <p className="text-xs text-muted-foreground">{getFileTypeLabel(document.name)}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground/60 max-w-sm text-center">
                                        Online preview is unavailable. The file URL may not be publicly accessible. Download the file to view it.
                                    </p>
                                    <div className="flex gap-2 mt-2">
                                        <Button variant="outline" size="sm" className="gap-1.5" asChild>
                                            <a href={document.url} download target="_blank" rel="noopener noreferrer">
                                                <Download className="h-3.5 w-3.5" />
                                                Download file
                                            </a>
                                        </Button>
                                        <Button variant="outline" size="sm" className="gap-1.5" asChild>
                                            <a
                                                href={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(document.url)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                Try Microsoft Viewer
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Text file preview */}
                    {fileType === "text" && (
                        <TextPreview url={document.url} />
                    )}

                    {/* Other file types: download only */}
                    {fileType === "other" && !document.generatedContent && (
                        <div className="flex flex-col items-center justify-center gap-4 py-16 px-6">
                            {getFileIcon(document.name)}
                            <div className="text-center space-y-1">
                                <p className="text-sm font-medium">{document.name}</p>
                                <p className="text-xs text-muted-foreground">{getFileTypeLabel(document.name)}</p>
                            </div>
                            <p className="text-xs text-muted-foreground/60 max-w-sm text-center">
                                Preview is not available for this file type. Download the file to view it.
                            </p>
                            <Button variant="outline" size="sm" className="gap-1.5 mt-2" asChild>
                                <a href={document.url} download target="_blank" rel="noopener noreferrer">
                                    <Download className="h-3.5 w-3.5" />
                                    Download file
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

/** Simple text file preview */
function TextPreview({ url }: { url: string }) {
    const [content, setContent] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        async function fetchText() {
            try {
                const response = await fetch(url)
                if (!response.ok) throw new Error("Failed")
                const text = await response.text()
                if (!cancelled) setContent(text)
            } catch {
                if (!cancelled) setContent(null)
            }
            if (!cancelled) setLoading(false)
        }
        fetchText()
        return () => { cancelled = true }
    }, [url])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
            </div>
        )
    }

    if (content === null) {
        return (
            <div className="flex flex-col items-center gap-3 py-12">
                <FileText className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">Unable to load text preview.</p>
            </div>
        )
    }

    return (
        <div className="p-4 overflow-auto max-h-[70vh]">
            <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/20 border rounded-lg p-4">
                {content}
            </pre>
        </div>
    )
}
