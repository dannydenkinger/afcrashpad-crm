/**
 * Zernio posts: schedule, cancel, list.
 *
 * Every post is mirrored in our `social_posts` collection so we can:
 *  - Render a calendar without round-tripping to Zernio
 *  - Attach posts to a CRM contact and log timeline activities
 *  - Survive Zernio downtime with local source-of-truth metadata
 *
 * The Zernio post ID is stored on our doc; webhooks update our doc by that ID.
 */

import { adminDb } from "@/lib/firebase-admin"
import { zernioRequest } from "@/lib/zernio/client"
import { logActivity } from "@/lib/activities/timeline"
import type { SocialPlatform, SocialPost, SocialPostStatus } from "@/types"

function tsToISO(ts: unknown): string | null {
    if (!ts) return null
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
        return (ts as { toDate: () => Date }).toDate().toISOString()
    }
    if (ts instanceof Date) return ts.toISOString()
    return typeof ts === "string" ? ts : null
}

function mapPost(id: string, data: Record<string, unknown>): SocialPost {
    return {
        id,
        workspaceId: (data.workspaceId as string) ?? "",
        zernioPostId: (data.zernioPostId as string) ?? null,
        platforms: (data.platforms as SocialPlatform[]) ?? [],
        content: (data.content as string) ?? "",
        mediaUrls: (data.mediaUrls as string[]) ?? [],
        scheduledAt: tsToISO(data.scheduledAt),
        publishedAt: tsToISO(data.publishedAt),
        status: (data.status as SocialPostStatus) ?? "draft",
        contactId: (data.contactId as string) ?? null,
        errorMessage: (data.errorMessage as string) ?? null,
        zernioAccountId: (data.zernioAccountId as string) ?? null,
        createdBy: (data.createdBy as string) ?? null,
        createdAt: tsToISO(data.createdAt) ?? new Date().toISOString(),
        updatedAt: tsToISO(data.updatedAt) ?? new Date().toISOString(),
    }
}

export interface SchedulePostInput {
    workspaceId: string
    zernioAccountId: string
    platforms: SocialPlatform[]
    content: string
    mediaUrls?: string[]
    scheduledAt: Date | null // null => publish immediately
    contactId?: string | null
    createdBy?: string | null
}

export async function schedulePost(input: SchedulePostInput): Promise<SocialPost> {
    const {
        workspaceId,
        zernioAccountId,
        platforms,
        content,
        mediaUrls = [],
        scheduledAt,
        contactId,
        createdBy,
    } = input

    if (!workspaceId) throw new Error("workspaceId required")
    if (!zernioAccountId) throw new Error("zernioAccountId required")
    if (!content || !content.trim()) throw new Error("content required")
    if (!platforms || platforms.length === 0) throw new Error("at least one platform required")

    const now = new Date()

    // Write local-first, then reconcile with Zernio. If Zernio rejects, we
    // mark the doc as "failed" with the error.
    const localStatus: SocialPostStatus = scheduledAt ? "scheduled" : "publishing"
    const ref = await adminDb.collection("social_posts").add({
        workspaceId,
        zernioAccountId,
        zernioPostId: null,
        platforms,
        content,
        mediaUrls,
        scheduledAt: scheduledAt ?? null,
        publishedAt: null,
        status: localStatus,
        contactId: contactId ?? null,
        errorMessage: null,
        createdBy: createdBy ?? null,
        createdAt: now,
        updatedAt: now,
    })

    try {
        const res = await zernioRequest<{ id: string; scheduled_at?: string }>("/v1/posts", {
            method: "POST",
            body: {
                sub_account_id: zernioAccountId,
                platforms,
                content,
                media_urls: mediaUrls,
                scheduled_at: scheduledAt ? scheduledAt.toISOString() : undefined,
            },
        })

        const nextStatus: SocialPostStatus = scheduledAt ? "scheduled" : "publishing"
        await ref.update({
            zernioPostId: res.id,
            status: nextStatus,
            updatedAt: new Date(),
        })

        if (contactId) {
            await logActivity({
                workspaceId,
                type: "social_post_scheduled",
                source: "zernio",
                contactId,
                subject: scheduledAt
                    ? `Post scheduled for ${scheduledAt.toLocaleString()}`
                    : "Social post queued for immediate publish",
                body: content.slice(0, 500),
                metadata: { platforms, mediaUrls, zernioPostId: res.id },
                sourceRef: ref.id,
            })
        }

        const snap = await ref.get()
        return mapPost(ref.id, snap.data()!)
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        await ref.update({
            status: "failed",
            errorMessage,
            updatedAt: new Date(),
        })
        if (contactId) {
            await logActivity({
                workspaceId,
                type: "social_post_failed",
                source: "zernio",
                contactId,
                subject: "Social post failed to schedule",
                body: errorMessage,
                metadata: { platforms },
                sourceRef: ref.id,
            })
        }
        throw err
    }
}

export async function cancelPost(workspaceId: string, postId: string): Promise<SocialPost> {
    const ref = adminDb.collection("social_posts").doc(postId)
    const doc = await ref.get()
    if (!doc.exists) throw new Error("Post not found")
    const data = doc.data()!
    if (data.workspaceId !== workspaceId) throw new Error("Forbidden")
    if (data.status === "published") throw new Error("Cannot cancel a published post")
    if (data.status === "canceled") return mapPost(ref.id, data)

    if (data.zernioPostId) {
        try {
            await zernioRequest(`/v1/posts/${data.zernioPostId}`, { method: "DELETE" })
        } catch (err) {
            console.error("[Zernio] cancel failed on remote side:", err)
        }
    }

    await ref.update({ status: "canceled", updatedAt: new Date() })

    if (data.contactId) {
        await logActivity({
            workspaceId,
            type: "social_post_canceled",
            source: "zernio",
            contactId: data.contactId as string,
            subject: "Social post canceled",
            metadata: { zernioPostId: data.zernioPostId },
            sourceRef: ref.id,
        })
    }

    const updated = await ref.get()
    return mapPost(ref.id, updated.data()!)
}

export async function listPosts(
    workspaceId: string,
    opts: { from?: Date; to?: Date; status?: SocialPostStatus; limit?: number } = {},
): Promise<SocialPost[]> {
    let query = adminDb
        .collection("social_posts")
        .where("workspaceId", "==", workspaceId) as FirebaseFirestore.Query
    if (opts.status) {
        query = query.where("status", "==", opts.status)
    }
    query = query.orderBy("scheduledAt", "asc").limit(opts.limit ?? 500)
    const snap = await query.get()
    return snap.docs
        .map((d) => mapPost(d.id, d.data()))
        .filter((p) => {
            if (opts.from && p.scheduledAt && new Date(p.scheduledAt) < opts.from) return false
            if (opts.to && p.scheduledAt && new Date(p.scheduledAt) > opts.to) return false
            return true
        })
}

export async function getPost(
    workspaceId: string,
    postId: string,
): Promise<SocialPost | null> {
    const doc = await adminDb.collection("social_posts").doc(postId).get()
    if (!doc.exists) return null
    const data = doc.data()!
    if (data.workspaceId !== workspaceId) return null
    return mapPost(doc.id, data)
}

export async function findPostByZernioId(zernioPostId: string): Promise<SocialPost | null> {
    const snap = await adminDb
        .collection("social_posts")
        .where("zernioPostId", "==", zernioPostId)
        .limit(1)
        .get()
    if (snap.empty) return null
    const doc = snap.docs[0]
    return mapPost(doc.id, doc.data())
}

export async function markPostPublished(
    postId: string,
    opts: { publishedAt?: Date; zernioPostId?: string } = {},
): Promise<void> {
    const ref = adminDb.collection("social_posts").doc(postId)
    const doc = await ref.get()
    if (!doc.exists) return
    const data = doc.data()!
    await ref.update({
        status: "published",
        publishedAt: opts.publishedAt ?? new Date(),
        zernioPostId: opts.zernioPostId ?? data.zernioPostId ?? null,
        updatedAt: new Date(),
    })
    if (data.contactId) {
        await logActivity({
            workspaceId: data.workspaceId,
            type: "social_post_published",
            source: "zernio",
            contactId: data.contactId as string,
            subject: "Social post published",
            body: (data.content as string)?.slice(0, 500),
            metadata: {
                platforms: data.platforms,
                zernioPostId: opts.zernioPostId ?? data.zernioPostId,
            },
            sourceRef: postId,
        })
    }
}

export async function markPostFailed(postId: string, errorMessage: string): Promise<void> {
    const ref = adminDb.collection("social_posts").doc(postId)
    const doc = await ref.get()
    if (!doc.exists) return
    const data = doc.data()!
    await ref.update({ status: "failed", errorMessage, updatedAt: new Date() })
    if (data.contactId) {
        await logActivity({
            workspaceId: data.workspaceId,
            type: "social_post_failed",
            source: "zernio",
            contactId: data.contactId as string,
            subject: "Social post failed",
            body: errorMessage,
            metadata: {
                platforms: data.platforms,
                zernioPostId: data.zernioPostId,
            },
            sourceRef: postId,
        })
    }
}
