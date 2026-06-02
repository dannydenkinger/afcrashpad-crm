"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Trash2, Plus, ArrowUp, ArrowDown, Copy,
    Sliders, ShieldCheck, Palette, GitBranch,
} from "lucide-react"
import type { FormField, FieldValidation, FieldStyle } from "./types"
import { ConditionalLogicEditor } from "@/components/forms/ConditionalLogicEditor"
import { IconButton } from "@/components/ui/IconButton"

/**
 * Common regex presets surfaced as one-tap chips in the validation tab.
 * Picking a preset also seeds a sensible default error message — users
 * can still customize the regex and the message afterwards.
 */
const REGEX_PRESETS: { label: string; pattern: string; errorMessage: string }[] = [
    { label: "Email", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", errorMessage: "Please enter a valid email address" },
    { label: "URL", pattern: "^https?://.+", errorMessage: "Please enter a valid URL starting with http:// or https://" },
    { label: "Phone (US)", pattern: "^\\+?1?[-. ]?\\(?\\d{3}\\)?[-. ]?\\d{3}[-. ]?\\d{4}$", errorMessage: "Please enter a valid US phone number" },
    { label: "Zip (US)", pattern: "^\\d{5}(-\\d{4})?$", errorMessage: "Please enter a valid US zip code" },
    { label: "Numbers only", pattern: "^\\d+$", errorMessage: "Numbers only" },
    { label: "Letters only", pattern: "^[A-Za-z]+$", errorMessage: "Letters only" },
    { label: "Slug", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$", errorMessage: "Lowercase letters, numbers, and hyphens only" },
    { label: "No spaces", pattern: "^\\S+$", errorMessage: "No spaces allowed" },
]

interface Props {
    field: FormField
    allFields?: FormField[]
    onChange: (field: FormField) => void
    onDelete: () => void
    onDuplicate?: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    isFirst: boolean
    isLast: boolean
}

export function FieldPropertiesEditor({
    field, allFields, onChange, onDelete, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast,
}: Props) {
    const update = (partial: Partial<FormField>) => onChange({ ...field, ...partial })
    const updateValidation = (partial: Partial<FieldValidation>) =>
        onChange({ ...field, validation: { ...field.validation, ...partial } })
    const updateStyle = (partial: Partial<FieldStyle>) =>
        onChange({ ...field, fieldStyle: { ...field.fieldStyle, ...partial } })

    const hasOptions = ["dropdown", "radio", "checkbox"].includes(field.type)
    const isTextType = ["short_text", "long_text", "email", "phone", "number"].includes(field.type)
    const isDisplayOnly = ["header", "divider", "image", "rich_text", "hidden"].includes(field.type)
    const showLogic = !isDisplayOnly && allFields && allFields.length > 1
    const showValidation = isTextType
    const showStyle = !isDisplayOnly

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Field</p>
                    <p className="text-sm font-semibold truncate">
                        {field.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton label="Move up" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
                        <ArrowUp className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton label="Move down" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
                        <ArrowDown className="h-3.5 w-3.5" />
                    </IconButton>
                    {onDuplicate && (
                        <IconButton label="Duplicate" className="h-7 w-7" onClick={onDuplicate}>
                            <Copy className="h-3.5 w-3.5" />
                        </IconButton>
                    )}
                    <IconButton label="Delete" className="h-7 w-7 text-destructive" onClick={onDelete}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                </div>
            </div>

            <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-8 p-0.5">
                    <TabsTrigger value="basic" className="text-[10px] px-1 gap-1">
                        <Sliders className="h-3 w-3" />
                        <span className="hidden sm:inline">Basic</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="validation"
                        className="text-[10px] px-1 gap-1"
                        disabled={!showValidation}
                    >
                        <ShieldCheck className="h-3 w-3" />
                        <span className="hidden sm:inline">Rules</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="logic"
                        className="text-[10px] px-1 gap-1"
                        disabled={!showLogic}
                    >
                        <GitBranch className="h-3 w-3" />
                        <span className="hidden sm:inline">Logic</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="style"
                        className="text-[10px] px-1 gap-1"
                        disabled={!showStyle}
                    >
                        <Palette className="h-3 w-3" />
                        <span className="hidden sm:inline">Style</span>
                    </TabsTrigger>
                </TabsList>

                {/* ── Basic Tab ── */}
                <TabsContent value="basic" className="space-y-3 mt-3">
                    {field.type !== "divider" && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Label</Label>
                            <Input value={field.label} onChange={e => update({ label: e.target.value })} className="h-8 text-sm" />
                        </div>
                    )}

                    {!isDisplayOnly && !["radio", "checkbox", "rating", "scale", "file_upload", "signature", "full_name", "address", "phone_intl"].includes(field.type) && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Placeholder</Label>
                            <Input value={field.placeholder || ""} onChange={e => update({ placeholder: e.target.value })} className="h-8 text-sm" />
                        </div>
                    )}

                    {!isDisplayOnly && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Help text</Label>
                            <Input value={field.helpText || ""} onChange={e => update({ helpText: e.target.value })} placeholder="Optional description" className="h-8 text-sm" />
                        </div>
                    )}

                    {!isDisplayOnly && (
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Required</Label>
                            <Switch checked={field.required} onCheckedChange={checked => update({ required: checked })} />
                        </div>
                    )}

                    {!isDisplayOnly && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Width</Label>
                            <div className="flex gap-1">
                                {(["full", "half"] as const).map(w => (
                                    <button key={w} onClick={() => update({ width: w })}
                                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${field.width === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                                        {w === "full" ? "Full" : "Half"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Type-specific basic props */}

                    {field.type === "hidden" && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Default value</Label>
                            <Input value={field.defaultValue || ""} onChange={e => update({ defaultValue: e.target.value })} className="h-8 text-sm" />
                        </div>
                    )}

                    {field.type === "image" && (
                        <>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Image URL</Label>
                                <Input value={field.imageUrl || ""} onChange={e => update({ imageUrl: e.target.value })} placeholder="https://..." className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Alt text</Label>
                                <Input value={field.imageAlt || ""} onChange={e => update({ imageAlt: e.target.value })} className="h-8 text-sm" />
                            </div>
                        </>
                    )}

                    {field.type === "rich_text" && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Content (HTML)</Label>
                            <Textarea value={field.richTextContent || ""} onChange={e => update({ richTextContent: e.target.value })} rows={4} className="text-xs font-mono" />
                        </div>
                    )}

                    {field.type === "rating" && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Max stars</Label>
                            <div className="flex gap-1">
                                {[5, 10].map(n => (
                                    <button key={n} onClick={() => update({ ratingMax: n })}
                                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${(field.ratingMax || 5) === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                        {n} stars
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {field.type === "scale" && (
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs">Min</Label>
                                    <Input type="number" value={field.scaleMin ?? 1} onChange={e => update({ scaleMin: Number(e.target.value) })} className="h-7 text-xs" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs">Max</Label>
                                    <Input type="number" value={field.scaleMax ?? 10} onChange={e => update({ scaleMax: Number(e.target.value) })} className="h-7 text-xs" />
                                </div>
                            </div>
                            <Label className="text-xs">Min label</Label>
                            <Input value={field.scaleMinLabel || ""} onChange={e => update({ scaleMinLabel: e.target.value })} placeholder="Not likely" className="h-7 text-xs" />
                            <Label className="text-xs">Max label</Label>
                            <Input value={field.scaleMaxLabel || ""} onChange={e => update({ scaleMaxLabel: e.target.value })} placeholder="Very likely" className="h-7 text-xs" />
                        </div>
                    )}

                    {field.type === "full_name" && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Name parts</Label>
                            {(["prefix", "first", "middle", "last", "suffix"] as const).map(part => (
                                <label key={part} className="flex items-center gap-2 text-xs">
                                    <input type="checkbox"
                                        checked={(field.nameFields || ["first", "last"]).includes(part)}
                                        onChange={e => {
                                            const current = field.nameFields || ["first", "last"]
                                            update({ nameFields: e.target.checked ? [...current, part] : current.filter(p => p !== part) })
                                        }}
                                        className="h-3.5 w-3.5"
                                    />
                                    {part.charAt(0).toUpperCase() + part.slice(1)}
                                </label>
                            ))}
                        </div>
                    )}

                    {field.type === "address" && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Address parts</Label>
                            {(["street", "city", "state", "zip", "country"] as const).map(part => (
                                <label key={part} className="flex items-center gap-2 text-xs">
                                    <input type="checkbox"
                                        checked={(field.addressFields || ["street", "city", "state", "zip", "country"]).includes(part)}
                                        onChange={e => {
                                            const current = field.addressFields || ["street", "city", "state", "zip", "country"]
                                            update({ addressFields: e.target.checked ? [...current, part] : current.filter(p => p !== part) })
                                        }}
                                        className="h-3.5 w-3.5"
                                    />
                                    {part.charAt(0).toUpperCase() + part.slice(1)}
                                </label>
                            ))}
                        </div>
                    )}

                    {field.type === "file_upload" && (
                        <div className="space-y-2">
                            <Label className="text-xs">Max files</Label>
                            <Input type="number" value={field.validation?.maxFiles ?? 1} onChange={e => updateValidation({ maxFiles: Number(e.target.value) })} className="h-7 text-xs" />
                            <Label className="text-xs">Max file size (MB)</Label>
                            <Input type="number" value={(field.validation?.maxFileSize ?? 25 * 1048576) / 1048576} onChange={e => updateValidation({ maxFileSize: Number(e.target.value) * 1048576 })} className="h-7 text-xs" />
                            <Label className="text-xs">Allowed types</Label>
                            <Input value={field.validation?.allowedFileTypes?.join(", ") || ""} onChange={e => updateValidation({ allowedFileTypes: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="image/*, .pdf, .doc" className="h-7 text-xs" />
                        </div>
                    )}

                    {/* Options Editor */}
                    {hasOptions && (
                        <div className="space-y-1.5 pt-2 border-t">
                            <Label className="text-xs">Options</Label>
                            {(field.options || []).map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                    <Input value={opt} onChange={e => {
                                        const newOpts = [...(field.options || [])]
                                        newOpts[idx] = e.target.value
                                        update({ options: newOpts })
                                    }} className="h-7 text-xs flex-1" />
                                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => update({ options: (field.options || []).filter((_, i) => i !== idx) })}>
                                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" className="h-7 text-xs w-full"
                                onClick={() => update({ options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })}>
                                <Plus className="h-3 w-3 mr-1" /> Add option
                            </Button>
                        </div>
                    )}
                </TabsContent>

                {/* ── Validation / Rules Tab ── */}
                <TabsContent value="validation" className="space-y-3 mt-3">
                    {showValidation ? (
                        <>
                            {["short_text", "long_text", "email", "phone"].includes(field.type) && (
                                <>
                                    <div className="flex gap-2">
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-xs">Min length</Label>
                                            <Input type="number" value={field.validation?.minLength ?? ""} onChange={e => updateValidation({ minLength: e.target.value ? Number(e.target.value) : undefined })} className="h-7 text-xs" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-xs">Max length</Label>
                                            <Input type="number" value={field.validation?.maxLength ?? ""} onChange={e => updateValidation({ maxLength: e.target.value ? Number(e.target.value) : undefined })} className="h-7 text-xs" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs">Show character count</Label>
                                        <Switch checked={field.showCharCount || false} onCheckedChange={checked => update({ showCharCount: checked })} />
                                    </div>
                                </>
                            )}
                            {field.type === "number" && (
                                <div className="flex gap-2">
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs">Min value</Label>
                                        <Input type="number" value={field.validation?.min ?? ""} onChange={e => updateValidation({ min: e.target.value ? Number(e.target.value) : undefined })} className="h-7 text-xs" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs">Max value</Label>
                                        <Input type="number" value={field.validation?.max ?? ""} onChange={e => updateValidation({ max: e.target.value ? Number(e.target.value) : undefined })} className="h-7 text-xs" />
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <Label className="text-xs">Regex pattern</Label>
                                <div className="flex flex-wrap gap-1 mb-1">
                                    {REGEX_PRESETS.map((p) => {
                                        const isActive = field.validation?.pattern === p.pattern
                                        return (
                                            <button
                                                key={p.label}
                                                type="button"
                                                onClick={() => updateValidation({
                                                    pattern: isActive ? "" : p.pattern,
                                                    customMessage: isActive ? field.validation?.customMessage : (field.validation?.customMessage || p.errorMessage),
                                                })}
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                                    isActive
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                                }`}
                                                title={p.pattern}
                                            >
                                                {p.label}
                                            </button>
                                        )
                                    })}
                                </div>
                                <Input value={field.validation?.pattern || ""} onChange={e => updateValidation({ pattern: e.target.value })} placeholder="^[A-Z].*  (or pick a preset above)" className="h-7 text-xs font-mono" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Custom error message</Label>
                                <Input value={field.validation?.customMessage || ""} onChange={e => updateValidation({ customMessage: e.target.value })} placeholder="Please enter a valid…" className="h-7 text-xs" />
                            </div>
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">
                            Validation rules apply to text, email, phone, and number fields.
                        </p>
                    )}
                </TabsContent>

                {/* ── Logic Tab ── */}
                <TabsContent value="logic" className="space-y-3 mt-3">
                    {showLogic ? (
                        <ConditionalLogicEditor
                            field={field}
                            allFields={allFields!}
                            onChange={logic => update({ conditionalLogic: logic })}
                        />
                    ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">
                            Add another field first — conditional logic shows or hides this field based on others&apos; values.
                        </p>
                    )}
                </TabsContent>

                {/* ── Style Tab ── */}
                <TabsContent value="style" className="space-y-3 mt-3">
                    {showStyle ? (
                        <>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Label position</Label>
                                <div className="flex gap-1">
                                    {(["top", "left", "hidden"] as const).map(pos => (
                                        <button key={pos} onClick={() => updateStyle({ labelPosition: pos })}
                                            className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${(field.fieldStyle?.labelPosition || "top") === pos ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                            {pos.charAt(0).toUpperCase() + pos.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Font size</Label>
                                <div className="flex gap-1">
                                    {(["sm", "md", "lg"] as const).map(s => (
                                        <button key={s} onClick={() => updateStyle({ fontSize: s })}
                                            className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${(field.fieldStyle?.fontSize || "md") === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                            {s.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Input height</Label>
                                <div className="flex gap-1">
                                    {(["sm", "md", "lg"] as const).map(s => (
                                        <button key={s} onClick={() => updateStyle({ inputHeight: s })}
                                            className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${(field.fieldStyle?.inputHeight || "md") === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                            {s.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Label color</Label>
                                <input type="color" value={field.fieldStyle?.labelColor || "#1f2937"} onChange={e => updateStyle({ labelColor: e.target.value })} className="h-6 w-6 rounded border cursor-pointer" />
                            </div>
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">
                            Style options apply to interactive fields.
                        </p>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
