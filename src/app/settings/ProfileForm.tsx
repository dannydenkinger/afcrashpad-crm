"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { updateProfile } from "./users/actions"
import { toast } from "sonner"
import { Loader2, Camera } from "lucide-react"

export function ProfileForm({ initialName, initialPhone, email, role, initialImageUrl }: {
    initialName: string | null
    initialPhone: string | null
    email: string
    role: string
    initialImageUrl?: string | null
}) {
    const [name, setName] = useState(initialName || "")
    const [phone, setPhone] = useState(initialPhone || "")
    const [isSaving, setIsSaving] = useState(false)
    const [imageUrl, setImageUrl] = useState(initialImageUrl || "")
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await updateProfile(name, phone)
            toast.success("Profile Updated", {
                description: "Your personal information has been saved.",
            })
        } catch (error) {
            toast.error("Error", {
                description: "Failed to update profile.",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File must be under 5MB")
            return
        }

        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
            toast.error("Only JPEG, PNG, WebP, and GIF images are allowed")
            return
        }

        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)

            const res = await fetch("/api/profile/avatar", { method: "POST", body: formData })
            const data = await res.json()

            if (data.success && data.url) {
                setImageUrl(data.url)
                toast.success("Profile photo updated")
            } else {
                toast.error(data.error || "Upload failed")
            }
        } catch {
            toast.error("Failed to upload image")
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    return (
        <div className="space-y-6">
            {/* Profile Photo */}
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <Avatar className="h-16 w-16 border">
                        <AvatarImage src={imageUrl || undefined} alt={name || "Profile"} />
                        <AvatarFallback className="text-xl">{name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <button
                        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        {isUploading ? (
                            <Loader2 className="h-5 w-5 text-white animate-spin" />
                        ) : (
                            <Camera className="h-5 w-5 text-white" />
                        )}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleImageUpload}
                    />
                </div>
                <div>
                    <p className="text-xs font-medium">Profile photo</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Click the avatar to upload. Max 5MB.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/20">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</div>
                    <div className="text-sm text-muted-foreground mt-1">{email}</div>
                </div>
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Role</div>
                    <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-[11px] uppercase tracking-wider">{role}</div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-xs">Display name</label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs">Phone number</label>
                    <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                    />
                </div>
            </div>

            <div className="pt-2 flex justify-end">
                <Button onClick={handleSave} disabled={isSaving || (!name && !phone)} size="sm">
                    {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Save changes
                </Button>
            </div>
        </div>
    )
}
