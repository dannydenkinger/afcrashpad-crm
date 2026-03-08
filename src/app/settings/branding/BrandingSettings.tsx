"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Paintbrush, Upload, Plane, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getBrandingSettings, updateBrandingSettings, uploadBrandingLogo } from "./actions"
import type { BrandingSettings as BrandingData } from "./types"

export function BrandingSettings() {
    const [branding, setBranding] = useState<BrandingData>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        async function load() {
            try {
                const data = await getBrandingSettings()
                if (data) setBranding(data)
            } catch {
                // use defaults
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    async function handleSave() {
        setSaving(true)
        try {
            await updateBrandingSettings(branding)
            toast.success("Branding settings saved")
        } catch (err: any) {
            toast.error(err.message || "Failed to save branding settings")
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
            toast.success("Logo uploaded successfully")
        } catch (err: any) {
            toast.error(err.message || "Failed to upload logo")
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="text-center text-sm text-muted-foreground">Loading branding settings...</div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Paintbrush className="h-4 w-4" />
                    Workspace Branding
                </CardTitle>
                <CardDescription>
                    Customize how your CRM looks with your company logo, name, and brand color.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-3">
                    <Label>Company Logo</Label>
                    <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed overflow-hidden">
                            {branding.logoUrl ? (
                                <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground" style={branding.primaryColor ? { backgroundColor: branding.primaryColor } : undefined}>
                                    <Plane className="h-8 w-8" />
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload Logo
                                    </>
                                )}
                            </Button>
                            <p className="text-xs text-muted-foreground">PNG, JPG, or SVG. Max 2MB.</p>
                        </div>
                    </div>
                </div>

                {/* Company Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input
                        id="company-name"
                        value={branding.companyName || ""}
                        onChange={(e) => setBranding((prev) => ({ ...prev, companyName: e.target.value }))}
                        placeholder="AFCrashpad"
                        maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground">Displayed in the sidebar and email templates.</p>
                </div>

                {/* Primary Color */}
                <div className="space-y-1.5">
                    <Label htmlFor="primary-color">Primary Brand Color</Label>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            id="primary-color"
                            value={branding.primaryColor || "#1a1a2e"}
                            onChange={(e) => setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))}
                            className="h-10 w-14 cursor-pointer rounded border p-1"
                        />
                        <Input
                            value={branding.primaryColor || ""}
                            onChange={(e) => setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))}
                            placeholder="#1a1a2e"
                            className="w-32"
                            maxLength={20}
                        />
                    </div>
                </div>

                {/* Sidebar Preview */}
                <div className="space-y-1.5">
                    <Label>Sidebar Preview</Label>
                    <div className="border rounded-lg p-4 bg-background max-w-xs">
                        <div className="flex items-center gap-3">
                            {branding.logoUrl ? (
                                <img src={branding.logoUrl} alt="Preview" className="h-10 w-10 rounded-lg object-cover shadow" />
                            ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow" style={{ backgroundColor: branding.primaryColor || "#1a1a2e" }}>
                                    <Plane className="h-6 w-6" />
                                </div>
                            )}
                            <div>
                                <div className="text-sm font-semibold">{branding.companyName || "AFCrashpad"}</div>
                                <div className="text-xs text-muted-foreground">CRM Portal</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save Branding"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
