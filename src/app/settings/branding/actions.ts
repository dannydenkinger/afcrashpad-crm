"use server"

import { z } from "zod"
import { adminDb } from "@/lib/firebase-admin"
import { getAdminStorageBucket } from "@/lib/firebase-admin"
import { requireAdmin } from "@/lib/auth-guard"
import { auth } from "@/auth"
import { logAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import type { BrandingSettings } from "./types"

const updateBrandingSchema = z.object({
    companyName: z.string().max(100).optional(),
    primaryColor: z.string().max(20).optional(),
    logoUrl: z.string().max(1000).optional(),
})

export async function getBrandingSettings(): Promise<BrandingSettings | null> {
    try {
        const doc = await adminDb.collection("settings").doc("branding").get()
        if (!doc.exists) return null
        const data = doc.data()
        return {
            companyName: data?.companyName || undefined,
            primaryColor: data?.primaryColor || undefined,
            logoUrl: data?.logoUrl || undefined,
        }
    } catch {
        return null
    }
}

export async function updateBrandingSettings(data: BrandingSettings) {
    await requireAdmin()

    const parsed = updateBrandingSchema.safeParse(data)
    if (!parsed.success) throw new Error("Invalid input: " + parsed.error.message)

    await adminDb.collection("settings").doc("branding").set(
        {
            ...parsed.data,
            updatedAt: new Date(),
        },
        { merge: true }
    )

    const session = await auth()
    if (session?.user) {
        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "update",
            entity: "settings",
            entityId: "branding",
            entityName: "Branding Settings",
            metadata: parsed.data,
        }).catch(() => {})
    }

    revalidatePath("/settings")
    revalidatePath("/")
    return { success: true }
}

export async function uploadBrandingLogo(formData: FormData): Promise<{ url: string }> {
    await requireAdmin()

    const file = formData.get("logo") as File
    if (!file || file.size === 0) throw new Error("No file provided")
    if (file.size > 2 * 1024 * 1024) throw new Error("File too large. Max 2MB.")
    if (!file.type.startsWith("image/")) throw new Error("File must be an image")

    const bucket = getAdminStorageBucket()
    const ext = file.name.split(".").pop() || "png"
    const fileName = `branding/logo-${Date.now()}.${ext}`
    const fileRef = bucket.file(fileName)

    const buffer = Buffer.from(await file.arrayBuffer())

    await fileRef.save(buffer, {
        metadata: {
            contentType: file.type,
        },
    })

    await fileRef.makePublic()

    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`

    // Save URL to branding settings
    await adminDb.collection("settings").doc("branding").set(
        { logoUrl: url, updatedAt: new Date() },
        { merge: true }
    )

    revalidatePath("/settings")
    revalidatePath("/")

    return { url }
}
