"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ImageUploadInput } from "@/components/ui/ImageUploadInput"
import type { FormStyle } from "./types"
import { FONT_OPTIONS, FORM_THEMES } from "./types"

const IMAGE_UPLOAD_ENDPOINT = "/api/lead-forms/upload-image"

interface Props {
    open: boolean
    onClose: () => void
    style: FormStyle
    onChange: (style: FormStyle) => void
    isMultiStep?: boolean
}

export function StyleSettings({ open, onClose, style, onChange, isMultiStep }: Props) {
    const update = (partial: Partial<FormStyle>) => onChange({ ...style, ...partial })

    const applyTheme = (themeId: string) => {
        const theme = FORM_THEMES.find(t => t.id === themeId)
        if (theme) onChange({ ...style, ...theme.style, theme: themeId })
    }

    return (
        <Sheet open={open} onOpenChange={v => !v && onClose()}>
            <SheetContent className="overflow-y-auto w-[360px] sm:w-[420px]">
                <SheetHeader>
                    <SheetTitle>Form Style</SheetTitle>
                </SheetHeader>

                <div className="space-y-6 mt-6">

                    {/* ── Themes ── */}
                    <section className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Themes</p>
                        <div className="grid grid-cols-4 gap-2">
                            {FORM_THEMES.map(theme => (
                                <button
                                    key={theme.id}
                                    onClick={() => applyTheme(theme.id)}
                                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors ${
                                        style.theme === theme.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
                                    }`}
                                >
                                    <div className="h-8 w-8 rounded-md border" style={{ backgroundColor: theme.preview }} />
                                    <span className="text-[10px] text-muted-foreground">{theme.name}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* ── Header ── */}
                    <section className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Header</p>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Title</Label>
                            <Input value={style.title} onChange={e => update({ title: e.target.value })} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Description</Label>
                            <Textarea value={style.description || ""} onChange={e => update({ description: e.target.value })} rows={2} className="text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Logo</Label>
                            <ImageUploadInput
                                value={style.logoUrl}
                                onChange={(url) => update({ logoUrl: url })}
                                uploadEndpoint={IMAGE_UPLOAD_ENDPOINT}
                                aspectHint="Recommended: ~200×60 px, transparent background"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Header image</Label>
                            <ImageUploadInput
                                value={style.headerImageUrl}
                                onChange={(url) => update({ headerImageUrl: url })}
                                uploadEndpoint={IMAGE_UPLOAD_ENDPOINT}
                                aspectHint="Recommended: 1200×400 px (3:1)"
                            />
                        </div>
                    </section>

                    {/* ── Colors ── */}
                    <section className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colors</p>
                        {[
                            { key: "backgroundColor", label: "Background" },
                            { key: "accentColor", label: "Accent / Focus" },
                            { key: "textColor", label: "Text" },
                            { key: "buttonColor", label: "Button" },
                            { key: "buttonTextColor", label: "Button Text" },
                            { key: "buttonHoverColor", label: "Button Hover" },
                        ].map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between">
                                <Label className="text-xs">{label}</Label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={(style as any)[key] || "#000000"} onChange={e => update({ [key]: e.target.value } as any)} className="h-7 w-7 rounded border cursor-pointer" />
                                    <Input value={(style as any)[key] || ""} onChange={e => update({ [key]: e.target.value } as any)} className="h-7 w-20 text-xs font-mono" />
                                </div>
                            </div>
                        ))}
                    </section>

                    {/* ── Background ── */}
                    <section className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background</p>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Background image</Label>
                            <ImageUploadInput
                                value={style.backgroundImageUrl}
                                onChange={(url) => update({ backgroundImageUrl: url || undefined })}
                                uploadEndpoint={IMAGE_UPLOAD_ENDPOINT}
                                aspectHint="Recommended: 1920×1080 px or larger"
                            />
                        </div>
                        {style.backgroundImageUrl && (
                            <div className="space-y-1.5">
                                <Label className="text-xs">Overlay Opacity ({style.backgroundOverlayOpacity ?? 100}%)</Label>
                                <input type="range" min={0} max={100} value={style.backgroundOverlayOpacity ?? 100}
                                    onChange={e => update({ backgroundOverlayOpacity: Number(e.target.value) })} className="w-full" />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label className="text-xs">Gradient</Label>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={!!style.backgroundGradient}
                                    onChange={e => update({
                                        backgroundGradient: e.target.checked
                                            ? { direction: "to-bottom", color1: style.backgroundColor, color2: style.accentColor }
                                            : undefined
                                    })}
                                    className="h-4 w-4" />
                                <span className="text-xs text-muted-foreground">Enable gradient background</span>
                            </div>
                            {style.backgroundGradient && (
                                <div className="flex items-center gap-2 ml-6">
                                    <select value={style.backgroundGradient.direction}
                                        onChange={e => update({ backgroundGradient: { ...style.backgroundGradient!, direction: e.target.value as any } })}
                                        className="h-7 px-2 text-xs border rounded bg-background">
                                        <option value="to-bottom">Top to Bottom</option>
                                        <option value="to-right">Left to Right</option>
                                        <option value="to-bottom-right">Diagonal</option>
                                    </select>
                                    <input type="color" value={style.backgroundGradient.color1} onChange={e => update({ backgroundGradient: { ...style.backgroundGradient!, color1: e.target.value } })} className="h-6 w-6 rounded border cursor-pointer" />
                                    <input type="color" value={style.backgroundGradient.color2} onChange={e => update({ backgroundGradient: { ...style.backgroundGradient!, color2: e.target.value } })} className="h-6 w-6 rounded border cursor-pointer" />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ── Typography ── */}
                    <section className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Typography</p>
                        <select value={style.fontFamily} onChange={e => update({ fontFamily: e.target.value })}
                            className="w-full h-8 px-2 text-sm border rounded-md bg-background">
                            {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                    </section>

                    {/* ── Container ── */}
                    <section className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Container</p>
                        <div className="flex gap-2">
                            <div className="flex-1 space-y-1">
                                <Label className="text-xs">Width</Label>
                                <Input type="number" value={style.containerWidth ?? 560} onChange={e => update({ containerWidth: Number(e.target.value) })} className="h-7 text-xs" />
                            </div>
                            <div className="w-16 space-y-1">
                                <Label className="text-xs">Unit</Label>
                                <select value={style.containerWidthUnit || "px"} onChange={e => update({ containerWidthUnit: e.target.value as "px" | "%" })}
                                    className="h-7 w-full px-1 text-xs border rounded bg-background">
                                    <option value="px">px</option>
                                    <option value="%">%</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 space-y-1">
                                <Label className="text-xs">Padding ({style.formPadding ?? 40}px)</Label>
                                <input type="range" min={0} max={80} value={style.formPadding ?? 40}
                                    onChange={e => update({ formPadding: Number(e.target.value) })} className="w-full" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <Label className="text-xs">Field Spacing ({style.fieldSpacing ?? 20}px)</Label>
                                <input type="range" min={8} max={40} value={style.fieldSpacing ?? 20}
                                    onChange={e => update({ fieldSpacing: Number(e.target.value) })} className="w-full" />
                            </div>
                        </div>
                    </section>

                    {/* ── Layout ── */}
                    <section className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layout</p>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Columns</Label>
                            <div className="flex gap-1">
                                {(["single", "two-column"] as const).map(l => (
                                    <button key={l} onClick={() => update({ layout: l })}
                                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${style.layout === l ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                        {l === "single" ? "Single" : "Two Columns"}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Border Radius</Label>
                            <div className="flex gap-1">
                                {(["none", "sm", "md", "lg", "full"] as const).map(r => (
                                    <button key={r} onClick={() => update({ borderRadius: r })}
                                        className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${style.borderRadius === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ── Button ── */}
                    <section className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submit Button</p>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Button Text</Label>
                            <Input value={style.buttonText} onChange={e => update({ buttonText: e.target.value })} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Alignment</Label>
                            <div className="flex gap-1">
                                {(["left", "center", "right", "full"] as const).map(a => (
                                    <button key={a} onClick={() => update({ buttonAlignment: a })}
                                        className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${(style.buttonAlignment || "full") === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                        {a.charAt(0).toUpperCase() + a.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Width</Label>
                            <div className="flex gap-1">
                                {(["auto", "full"] as const).map(w => (
                                    <button key={w} onClick={() => update({ buttonWidth: w })}
                                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${(style.buttonWidth || "full") === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                        {w === "auto" ? "Auto" : "Full Width"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ── Progress Bar (multi-step only) ── */}
                    {isMultiStep && (
                        <section className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress Bar</p>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Style</Label>
                                <div className="flex gap-1">
                                    {(["bar", "dots", "steps"] as const).map(s => (
                                        <button key={s} onClick={() => update({ progressBarStyle: s })}
                                            className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${(style.progressBarStyle || "bar") === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Color</Label>
                                <input type="color" value={style.progressBarColor || style.accentColor}
                                    onChange={e => update({ progressBarColor: e.target.value })} className="h-6 w-6 rounded border cursor-pointer" />
                            </div>
                        </section>
                    )}

                    {/* ── After Submission ── */}
                    <section className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">After Submission</p>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Success Message</Label>
                            <Textarea value={style.successMessage} onChange={e => update({ successMessage: e.target.value })} rows={2} className="text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Redirect URL (optional)</Label>
                            <Input value={style.redirectUrl || ""} onChange={e => update({ redirectUrl: e.target.value })} placeholder="https://yoursite.com/thank-you" className="h-8 text-sm" />
                            <p className="text-[11px] text-muted-foreground">Redirects instead of showing the success message</p>
                        </div>
                    </section>

                    {/* ── Custom CSS ── */}
                    <section className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom CSS</p>
                        <Textarea
                            value={style.customCss || ""}
                            onChange={e => update({ customCss: e.target.value })}
                            placeholder={`/* Custom styles */\n.vesta-form-${'{formId}'} input {\n  /* your styles */\n}`}
                            rows={4}
                            className="text-xs font-mono"
                        />
                        <p className="text-[11px] text-muted-foreground">Advanced: add custom CSS scoped to your form</p>
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    )
}
