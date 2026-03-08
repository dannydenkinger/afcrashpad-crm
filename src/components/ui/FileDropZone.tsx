"use client"

import { useState, useRef, useCallback } from "react"
import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileDropZoneProps {
    onFilesSelected: (files: File[]) => void
    accept?: string
    multiple?: boolean
    maxSizeMB?: number
    disabled?: boolean
    className?: string
    compact?: boolean
    children?: React.ReactNode
}

export function FileDropZone({
    onFilesSelected,
    accept,
    multiple = false,
    maxSizeMB,
    disabled = false,
    className,
    compact = false,
    children,
}: FileDropZoneProps) {
    const [isDragOver, setIsDragOver] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dragCountRef = useRef(0)

    const acceptedExtensions = accept
        ? accept.split(",").map((s) => s.trim().toLowerCase())
        : undefined

    const validateFile = useCallback(
        (file: File): string | null => {
            if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
                return `"${file.name}" exceeds ${maxSizeMB}MB limit`
            }
            if (acceptedExtensions) {
                const ext = "." + file.name.split(".").pop()?.toLowerCase()
                const mimeMatch = acceptedExtensions.some(
                    (a) => a.startsWith(".") ? ext === a : file.type.startsWith(a.replace("*", ""))
                )
                if (!mimeMatch) {
                    return `"${file.name}" is not an accepted file type`
                }
            }
            return null
        },
        [maxSizeMB, acceptedExtensions]
    )

    const handleFiles = useCallback(
        (fileList: FileList | null) => {
            if (!fileList || fileList.length === 0) return
            setError(null)

            const files = Array.from(fileList)
            const selected = multiple ? files : [files[0]]

            const errors: string[] = []
            const valid: File[] = []
            for (const file of selected) {
                const err = validateFile(file)
                if (err) {
                    errors.push(err)
                } else {
                    valid.push(file)
                }
            }

            if (errors.length > 0) {
                setError(errors.join(". "))
            }
            if (valid.length > 0) {
                onFilesSelected(valid)
            }
        },
        [multiple, validateFile, onFilesSelected]
    )

    const handleDragEnter = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            if (disabled) return
            dragCountRef.current += 1
            if (dragCountRef.current === 1) {
                setIsDragOver(true)
            }
        },
        [disabled]
    )

    const handleDragLeave = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            dragCountRef.current -= 1
            if (dragCountRef.current === 0) {
                setIsDragOver(false)
            }
        },
        []
    )

    const handleDragOver = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
        },
        []
    )

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            dragCountRef.current = 0
            setIsDragOver(false)
            if (disabled) return
            handleFiles(e.dataTransfer.files)
        },
        [disabled, handleFiles]
    )

    const handleClick = () => {
        if (disabled) return
        fileInputRef.current?.click()
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files)
        e.target.value = ""
    }

    const acceptLabel = acceptedExtensions
        ?.filter((a) => a.startsWith("."))
        .map((a) => a.toUpperCase().slice(1))
        .join(", ")

    return (
        <div className="space-y-1.5">
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={handleClick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick() } }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={cn(
                    "relative border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer select-none",
                    "border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/20",
                    isDragOver && "border-primary bg-primary/5 scale-[1.01]",
                    disabled && "opacity-50 cursor-not-allowed hover:border-muted-foreground/25 hover:bg-transparent",
                    compact ? "p-4" : "p-8",
                    className
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={accept}
                    multiple={multiple}
                    onChange={handleInputChange}
                    disabled={disabled}
                />
                {children ? (
                    children
                ) : (
                    <>
                        <div className={cn(
                            "rounded-full bg-muted/50 flex items-center justify-center transition-colors",
                            isDragOver && "bg-primary/10",
                            compact ? "p-2" : "p-3"
                        )}>
                            <Upload className={cn(
                                "text-muted-foreground transition-colors",
                                isDragOver && "text-primary",
                                compact ? "h-4 w-4" : "h-6 w-6"
                            )} />
                        </div>
                        <div className="text-center">
                            <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
                                {isDragOver ? "Drop files here" : "Drag & drop files here"}
                            </p>
                            <p className={cn("text-muted-foreground mt-0.5", compact ? "text-[10px]" : "text-xs")}>
                                or click to browse
                            </p>
                        </div>
                        {(acceptLabel || maxSizeMB) && (
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                                {[
                                    acceptLabel && `Accepts: ${acceptLabel}`,
                                    maxSizeMB && `Max ${maxSizeMB}MB`,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        )}
                    </>
                )}
            </div>
            {error && (
                <p className="text-xs text-destructive px-1">{error}</p>
            )}
        </div>
    )
}
