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
        <div className="space-y-6 max-w-xl">
            {/* Profile Photo */}
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <Avatar className="h-20 w-20 border-2">
                        <AvatarImage src={imageUrl || undefined} alt={name || "Profile"} />
                        <AvatarFallback className="text-2xl">{name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <button
                        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        {isUploading ? (
                            <Loader2 className="h-6 w-6 text-white animate-spin" />
                        ) : (
                            <Camera className="h-6 w-6 text-white" />
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
                    <p className="text-sm font-semibold">Profile Photo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Click the avatar to upload a new photo. Max 5MB.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-muted/20 p-4 border rounded-lg mb-6">
                <div>
                    <div className="font-semibold text-muted-foreground uppercase tracking-wider text-xs">Email Address</div>
                    <div className="font-medium text-muted-foreground mt-1">{email}</div>
                </div>
                <div>
                    <div className="font-semibold text-muted-foreground uppercase tracking-wider text-xs">System Role</div>
                    <div className="font-medium text-primary bg-primary/10 inline-flex px-2 py-0.5 rounded-md font-bold text-xs mt-1">{role}</div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Display Name</label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Phone Number</label>
                    <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                    />
                </div>
            </div>

            <div className="pt-4 flex justify-end">
                <Button onClick={handleSave} disabled={isSaving || (!name && !phone)}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </div>
        </div>
    )
}
