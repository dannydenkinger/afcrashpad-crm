"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"
import { getConnection } from "@/lib/zernio/sub-accounts"
import { cancelPost, schedulePost } from "@/lib/zernio/posts"
import {
    ZernioError,
    ZernioNotConfiguredError,
    isZernioConfigured,
} from "@/lib/zernio/client"
import { uploadMedia } from "@/lib/media/upload"
import { adminDb } from "@/lib/firebase-admin"
import type { SocialPlatform } from "@/types"

const platformEnum = z.enum([
    "facebook",
    "instagram",
    "twitter",
    "linkedin",
    "tiktok",
    "pinterest",
    "youtube",
    "threads",
])

const schedulePostSchema = z.object({
    platforms: z.array(platformEnum).min(1),
    content: z.string().min(1).max(5000),
    mediaUrls: z.array(z.string().url()).max(10).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    contactId: z.string().nullable().optional(),
})

export async function schedulePostAction(input: z.infer<typeof schedulePostSchema>) {
    if (!isZernioConfigured()) {
        return {
            success: false,
            error: "Zernio is not configured. Set ZERNIO_API_KEY on the server.",
        }
    }

    const session = await requireAuth()
    const user = session.user as { id: string; workspaceId: string }

    const parsed = schedulePostSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    const connection = await getConnection(user.workspaceId)
    if (!connection?.zernioAccountId) {
        return {
            success: false,
            error: "No social accounts connected. Connect your socials in Settings first.",
        }
    }

    try {
        const post = await schedulePost({
            workspaceId: user.workspaceId,
            zernioAccountId: connection.zernioAccountId,
            platforms: parsed.data.platforms as SocialPlatform[],
            content: parsed.data.content,
            mediaUrls: parsed.data.mediaUrls ?? [],
            scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
            contactId: parsed.data.contactId ?? null,
            createdBy: user.id,
        })
        revalidatePath("/marketing/social")
        return { success: true, post }
    } catch (err) {
        if (err instanceof ZernioNotConfiguredError) {
            return { success: false, error: err.message }
        }
        if (err instanceof ZernioError) {
            return { success: false, error: `Zernio ${err.status}: ${err.message}` }
        }
        const message = err instanceof Error ? err.message : "Failed to schedule post"
        console.error("[Social] schedulePostAction error:", err)
        return { success: false, error: message }
    }
}

export async function uploadSocialMediaAction(formData: FormData) {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const file = formData.get("file")
    if (!(file instanceof File)) {
        return { success: false, error: "No file provided" }
    }

    try {
        const uploaded = await uploadMedia(file, {
            workspaceId,
            scope: "social",
        })
        return {
            success: true,
            url: uploaded.url,
            contentType: uploaded.contentType,
            sizeBytes: uploaded.sizeBytes,
            originalName: uploaded.originalName,
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed"
        console.error("[Social] uploadSocialMediaAction error:", err)
        return { success: false, error: message }
    }
}

const contactSearchSchema = z.object({
    query: z.string().max(200),
    limit: z.number().int().positive().max(50).optional(),
})

export async function searchContactsAction(input: z.infer<typeof contactSearchSchema>) {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const parsed = contactSearchSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid query", contacts: [] }

    const q = parsed.data.query.trim().toLowerCase()
    const limit = parsed.data.limit ?? 20

    try {
        // Firestore lacks full-text search. Pull a page of contacts for this
        // workspace and filter client-side. For larger workspaces, wire up
        // Algolia or Typesense and replace this.
        const snap = await adminDb
            .collection("contacts")
            .where("workspaceId", "==", workspaceId)
            .orderBy("createdAt", "desc")
            .limit(1000)
            .get()

        const all = snap.docs.map((d) => {
            const data = d.data()
            return {
                id: d.id,
                name: (data.name as string) || "",
                email: (data.email as string) || "",
                phone: (data.phone as string) || "",
            }
        })

        const filtered = q
            ? all.filter(
                  (c) =>
                      c.name.toLowerCase().includes(q) ||
                      c.email.toLowerCase().includes(q) ||
                      c.phone.toLowerCase().includes(q),
              )
            : all

        // Sort by name for stable, human-friendly results. Fall back to email.
        const sorted = [...filtered].sort((a, b) => {
            const an = (a.name || a.email).toLowerCase()
            const bn = (b.name || b.email).toLowerCase()
            return an.localeCompare(bn)
        })

        return { success: true, contacts: sorted.slice(0, limit) }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed"
        return { success: false, error: message, contacts: [] }
    }
}

export async function cancelPostAction(postId: string) {
    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    try {
        const post = await cancelPost(workspaceId, postId)
        revalidatePath("/marketing/social")
        return { success: true, post }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to cancel post"
        return { success: false, error: message }
    }
}
