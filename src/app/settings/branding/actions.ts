"use server"

import { z } from "zod"
import { tenantDb } from "@/lib/tenant-db"
import { getAdminStorageBucket } from "@/lib/firebase-admin"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"
import { requirePlan } from "@/lib/billing/plans-server"
import { logAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import type { BrandingSettings } from "./types"

const updateBrandingSchema = z.object({
    companyName: z.string().max(100).optional(),
    primaryColor: z.string().max(20).optional(),
    secondaryColor: z.string().max(20).optional(),
    textColor: z.string().max(20).optional(),
    logoUrl: z.string().max(1000).optional(),
    footerAddress: z.string().max(500).optional(),
    fontFamily: z.string().max(200).optional(),
    websiteUrl: z.string().max(500).optional(),
    bookingLinkUrl: z.string().max(500).optional(),
})

export async function getBrandingSettings(): Promise<BrandingSettings | null> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const doc = await db.settingsDoc("branding").get()
        if (!doc.exists) return null
        const data = doc.data()
        return {
            companyName: data?.companyName || undefined,
            primaryColor: data?.primaryColor || undefined,
            secondaryColor: data?.secondaryColor || undefined,
            textColor: data?.textColor || undefined,
            logoUrl: data?.logoUrl || undefined,
            footerAddress: data?.footerAddress || undefined,
            fontFamily: data?.fontFamily || undefined,
            websiteUrl: data?.websiteUrl || undefined,
            bookingLinkUrl: data?.bookingLinkUrl || undefined,
        }
    } catch {
        return null
    }
}

export async function updateBrandingSettings(data: BrandingSettings) {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    await requirePlan(workspaceId, "pro", "Workspace branding")
    const db = tenantDb(workspaceId)

    const parsed = updateBrandingSchema.safeParse(data)
    if (!parsed.success) throw new Error("Invalid input: " + parsed.error.message)

    await db.settingsDoc("branding").set(
        {
            ...parsed.data,
            updatedAt: new Date(),
        },
        { merge: true }
    )

    logAudit(workspaceId, {
        userId: session.user.id || "",
        userEmail: session.user.email || "",
        userName: session.user.name || "",
        action: "update",
        entity: "settings",
        entityId: "branding",
        entityName: "Branding Settings",
        metadata: parsed.data,
    }).catch(() => {})

    revalidatePath("/settings")
    revalidatePath("/")
    return { success: true }
}

export async function uploadBrandingLogo(formData: FormData): Promise<{ url: string }> {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    const file = formData.get("logo") as File
    if (!file || file.size === 0) throw new Error("No file provided")
    if (file.size > 2 * 1024 * 1024) throw new Error("File too large. Max 2MB.")
    const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])
    if (!ALLOWED_TYPES.has(file.type)) throw new Error("Use JPG, PNG, GIF, or WebP (SVG not allowed)")

    const bucket = getAdminStorageBucket()
    const ext = file.name.split(".").pop() || "png"
    const fileName = `branding/${workspaceId}/logo-${Date.now()}.${ext}`
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
    await db.settingsDoc("branding").set(
        { logoUrl: url, updatedAt: new Date() },
        { merge: true }
    )

    revalidatePath("/settings")
    revalidatePath("/")

    return { url }
}
