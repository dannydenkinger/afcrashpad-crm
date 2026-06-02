"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Hexagon, Loader2, ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { getBrandingSettings, updateBrandingSettings, uploadBrandingLogo } from "./actions"
import type { BrandingSettings as BrandingData } from "./types"

const DEFAULT_PRIMARY = "#1a1a2e"
const DEFAULT_SECONDARY = "#7c3aed"
const DEFAULT_TEXT = "#1a1a1a"
const DEFAULT_FONT = "Inter, system-ui, -apple-system, sans-serif"

export function BrandingSettings() {
    const [branding, setBranding] = useState<BrandingData>({})
    const [original, setOriginal] = useState<BrandingData>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        async function load() {
            try {
                const data = await getBrandingSettings()
                if (data) {
                    setBranding(data)
                    setOriginal(data)
                }
            } catch {
                // use defaults
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const dirty = useMemo(() => {
        const keys: (keyof BrandingData)[] = [
            "companyName", "primaryColor", "secondaryColor", "textColor",
            "logoUrl", "footerAddress", "fontFamily", "websiteUrl", "bookingLinkUrl",
        ]
        return keys.some((k) => (branding[k] || "") !== (original[k] || ""))
    }, [branding, original])

    function patch<K extends keyof BrandingData>(key: K, value: BrandingData[K]) {
        setBranding((prev) => ({ ...prev, [key]: value }))
    }

    async function handleSave() {
        setSaving(true)
        try {
            await updateBrandingSettings(branding)
            setOriginal(branding)
            toast.success("Branding saved")
        } catch (err: any) {
            toast.error(err.message || "Failed to save branding")
        } finally {
            setSaving(false)
        }
    }

    async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 2 * 1024 * 1024) {
            toast.error("File too large. Max 2MB.")
            return
        }
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append("logo", file)
            const result = await uploadBrandingLogo(formData)
            setBranding((prev) => ({ ...prev, logoUrl: result.url }))
            toast.success("Logo uploaded")
        } catch (err: any) {
            toast.error(err.message || "Failed to upload logo")
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="h-24 rounded-lg border bg-muted/20 animate-pulse" />
                <div className="h-24 rounded-lg border bg-muted/20 animate-pulse" />
                <div className="h-24 rounded-lg border bg-muted/20 animate-pulse" />
            </div>
        )
    }

    return (
        <>
            <div className="space-y-8 pb-24">
                {/* Identity — logo + name + live sidebar preview */}
                <Section
                    title="Identity"
                    description="Logo and company name shown in the sidebar and outbound email."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-start">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Logo</Label>
                                <div className="flex items-center gap-3">
                                    <LogoTile url={branding.logoUrl} bgColor={branding.primaryColor} />
                                    <div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            className="hidden"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                        >
                                            {uploading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                    Uploading
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="mr-2 h-3.5 w-3.5" />
                                                    {branding.logoUrl ? "Replace" : "Upload"}
                                                </>
                                            )}
                                        </Button>
                                        {branding.logoUrl && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="ml-1 text-muted-foreground"
                                                onClick={() => patch("logoUrl", "")}
                                            >
                                                Remove
                                            </Button>
                                        )}
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            PNG, JPG, or SVG. Up to 2MB.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="company-name" className="text-xs">Company name</Label>
                                <Input
                                    id="company-name"
                                    value={branding.companyName || ""}
                                    onChange={(e) => patch("companyName", e.target.value)}
                                    placeholder="Your company"
                                    maxLength={100}
                                />
                            </div>
                        </div>

                        <SidebarPreview branding={branding} />
                    </div>
                </Section>

                {/* Colors */}
                <Section
                    title="Brand colors"
                    description="Primary shows in the app sidebar; the rest get applied in marketing emails."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ColorField
                            label="Primary"
                            help="App sidebar, logo tile"
                            value={branding.primaryColor}
                            placeholder={DEFAULT_PRIMARY}
                            onChange={(v) => patch("primaryColor", v)}
                        />
                        <ColorField
                            label="Accent"
                            help="Email buttons & links"
                            value={branding.secondaryColor}
                            placeholder={DEFAULT_SECONDARY}
                            onChange={(v) => patch("secondaryColor", v)}
                        />
                        <ColorField
                            label="Body text"
                            help="Email body copy"
                            value={branding.textColor}
                            placeholder={DEFAULT_TEXT}
                            onChange={(v) => patch("textColor", v)}
                        />
                    </div>
                </Section>

                {/* Typography */}
                <Section
                    title="Typography"
                    description="Default body font for outbound email. Email clients fall back to web-safe fonts if the stack isn't installed."
                >
                    <div className="space-y-1.5">
                        <Label htmlFor="font-family" className="text-xs">Font family (CSS stack)</Label>
                        <Input
                            id="font-family"
                            value={branding.fontFamily || ""}
                            onChange={(e) => patch("fontFamily", e.target.value)}
                            placeholder={DEFAULT_FONT}
                            maxLength={200}
                            className="font-mono text-xs"
                        />
                    </div>
                </Section>

                {/* Email essentials */}
                <Section
                    title="Email essentials"
                    description="The contact info that needs to appear in every marketing email."
                >
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="footer-address" className="text-xs">
                                Footer address <span className="text-muted-foreground font-normal">(CAN-SPAM)</span>
                            </Label>
                            <Input
                                id="footer-address"
                                value={branding.footerAddress || ""}
                                onChange={(e) => patch("footerAddress", e.target.value)}
                                placeholder="123 Main St, Suite 100, San Francisco, CA 94105"
                                maxLength={500}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Required by US/EU email law in marketing-email footers. Auto-injected into starter templates.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="website-url" className="text-xs">Website URL</Label>
                            <Input
                                id="website-url"
                                type="url"
                                value={branding.websiteUrl || ""}
                                onChange={(e) => patch("websiteUrl", e.target.value)}
                                placeholder="https://yourcompany.com"
                                maxLength={500}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="booking-link" className="text-xs">Booking link</Label>
                            <Input
                                id="booking-link"
                                type="url"
                                value={branding.bookingLinkUrl || ""}
                                onChange={(e) => patch("bookingLinkUrl", e.target.value)}
                                placeholder="https://calendly.com/yourname/30min"
                                maxLength={500}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Calendly, Cal.com, SavvyCal — anywhere your prospects can pick a time. Adds a "Send my booking link" quick-action to the contact pages.
                            </p>
                        </div>
                    </div>
                </Section>
            </div>

            {/* Sticky save bar */}
            <div
                className={`fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-transform duration-200 ${
                    dirty ? "translate-y-0" : "translate-y-full pointer-events-none"
                }`}
            >
                <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">You have unsaved changes.</p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBranding(original)}
                            disabled={saving}
                        >
                            Discard
                        </Button>
                        <Button onClick={handleSave} disabled={saving} size="sm">
                            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            Save changes
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}

function Section({
    title,
    description,
    children,
}: {
    title: string
    description?: string
    children: React.ReactNode
}) {
    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-base font-semibold tracking-tight">{title}</h2>
                {description && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
                )}
            </div>
            {children}
        </section>
    )
}

function ColorField({
    label,
    help,
    value,
    placeholder,
    onChange,
}: {
    label: string
    help?: string
    value: string | undefined
    placeholder: string
    onChange: (v: string) => void
}) {
    const display = value || ""
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">{label}</Label>
            <div className="flex items-stretch rounded-md border focus-within:ring-1 focus-within:ring-ring focus-within:border-ring overflow-hidden">
                <label className="relative w-10 shrink-0 cursor-pointer">
                    <input
                        type="color"
                        value={display || placeholder}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label={`${label} color picker`}
                    />
                    <div
                        className="h-full w-full"
                        style={{ backgroundColor: display || placeholder }}
                    />
                </label>
                <input
                    type="text"
                    value={display}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    maxLength={20}
                    className="flex-1 min-w-0 border-0 bg-transparent px-2 py-1.5 text-sm font-mono outline-none"
                />
            </div>
            {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
        </div>
    )
}

function LogoTile({ url, bgColor }: { url?: string; bgColor?: string }) {
    if (url) {
        return (
            <div className="h-16 w-16 shrink-0 rounded-lg border overflow-hidden bg-card">
                <img src={url} alt="Logo" className="h-full w-full object-cover" />
            </div>
        )
    }
    return (
        <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed bg-muted/40"
            style={bgColor ? { backgroundColor: bgColor, borderStyle: "solid" } : undefined}
        >
            {bgColor ? (
                <Hexagon className="h-7 w-7 text-white/90" />
            ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
            )}
        </div>
    )
}

function SidebarPreview({ branding }: { branding: BrandingData }) {
    return (
        <div className="w-full sm:w-56 shrink-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Sidebar preview
            </div>
            <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2.5">
                    {branding.logoUrl ? (
                        <img
                            src={branding.logoUrl}
                            alt="Preview"
                            className="h-9 w-9 rounded-md object-cover shadow-sm"
                        />
                    ) : (
                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-md shadow-sm"
                            style={{ backgroundColor: branding.primaryColor || DEFAULT_PRIMARY }}
                        >
                            <Hexagon className="h-5 w-5 text-white/90" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                            {branding.companyName || "Your company"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">CRM Portal</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
