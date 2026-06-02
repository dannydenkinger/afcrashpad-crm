"use client"

import { useRef, useState } from "react"
import { ImageIcon, Loader2, Upload, X, Link as LinkIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/**
 * Image input that supports BOTH URL paste and file upload (drag or click).
 * Renders a thumbnail preview when a value is set. Clears via X button.
 *
 *   <ImageUploadInput
 *       value={style.logoUrl}
 *       onChange={(url) => updateStyle({ logoUrl: url })}
 *       uploadEndpoint="/api/lead-forms/upload-image"
 *   />
 */
export interface ImageUploadInputProps {
    value: string | null | undefined
    onChange: (url: string | null) => void
    /** POST endpoint that accepts FormData with a `file` field and returns `{url}`. */
    uploadEndpoint: string
    /** Optional placeholder for the URL input. */
    placeholder?: string
    /** Optional aspect-ratio hint shown in the empty drop zone. */
    aspectHint?: string
    className?: string
}

export function ImageUploadInput({
    value,
    onChange,
    uploadEndpoint,
    placeholder = "https://… or drop an image",
    aspectHint,
    className,
}: ImageUploadInputProps) {
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [showUrlInput, setShowUrlInput] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    async function uploadFile(file: File) {
        if (!file.type.startsWith("image/")) {
            toast.error("Please pick an image file")
            return
        }
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)
            const res = await fetch(uploadEndpoint, { method: "POST", body: formData })
            const data = await res.json()
            if (!res.ok || !data.success) {
                toast.error(data.error || "Upload failed")
                return
            }
            onChange(data.url)
            toast.success("Image uploaded")
        } catch {
            toast.error("Upload failed")
        } finally {
            setUploading(false)
        }
    }

    function handleFiles(files: FileList | null) {
        if (!files?.length) return
        uploadFile(files[0])
    }

    return (
        <div className={cn("space-y-1.5", className)}>
            {value ? (
                // ── Has image: thumbnail + replace + clear ──
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                    <div className="h-12 w-12 rounded border bg-checkered overflow-hidden shrink-0 flex items-center justify-center bg-white">
                        <img
                            src={value}
                            alt=""
                            className="h-full w-full object-contain"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none"
                            }}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted-foreground truncate" title={value}>
                            {value.replace(/^https?:\/\//, "")}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="text-[10px] text-primary hover:underline disabled:opacity-50"
                            >
                                Replace
                            </button>
                            <span className="text-muted-foreground/40 text-[10px]">·</span>
                            <button
                                type="button"
                                onClick={() => setShowUrlInput(true)}
                                className="text-[10px] text-muted-foreground hover:text-foreground"
                            >
                                Use URL
                            </button>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => onChange(null)}
                        title="Remove image"
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ) : (
                // ── No image: drop zone + URL fallback ──
                <>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault()
                            setDragOver(true)
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault()
                            setDragOver(false)
                            handleFiles(e.dataTransfer.files)
                        }}
                        className={cn(
                            "rounded-md border-2 border-dashed p-3 text-center cursor-pointer transition-colors",
                            dragOver
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/40 hover:bg-muted/30",
                        )}
                    >
                        {uploading ? (
                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-1">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Uploading…
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                                    <Upload className="h-3 w-3" />
                                    <span>
                                        Drop or <span className="text-primary font-medium">click to upload</span>
                                    </span>
                                </div>
                                {aspectHint && (
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">{aspectHint}</p>
                                )}
                            </>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowUrlInput((v) => !v)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                        <LinkIcon className="h-3 w-3" />
                        {showUrlInput ? "Hide URL input" : "Or paste a URL"}
                    </button>
                </>
            )}

            {/* URL input — shown when toggled or when an existing URL is used */}
            {showUrlInput && (
                <Input
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value || null)}
                    placeholder={placeholder}
                    className="h-7 text-xs"
                    autoFocus
                />
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
            />
        </div>
    )
}
