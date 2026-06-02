import crypto from "crypto"
import { getWebhookSecret } from "@/lib/zernio/client"
import {
    findPostByZernioId,
    markPostFailed,
    markPostPublished,
} from "@/lib/zernio/posts"

/**
 * Verifies an HMAC-SHA256 signature of the raw request body.
 * Expected header: `x-zernio-signature: sha256=<hex>`
 *
 * Uses timing-safe comparison.
 */
export function verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | null,
): boolean {
    const secret = getWebhookSecret()
    if (!secret) {
        // Server is misconfigured. Reject rather than accept.
        return false
    }
    if (!signatureHeader) return false

    const provided = signatureHeader.replace(/^sha256=/i, "").trim()
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")

    if (provided.length !== expected.length) return false
    try {
        return crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"))
    } catch {
        return false
    }
}

export type ZernioEventType =
    | "post.published"
    | "post.failed"
    | "post.scheduled"
    | "account.connected"
    | "account.disconnected"

export interface ZernioEvent {
    type: ZernioEventType | string
    data: {
        post_id?: string
        sub_account_id?: string
        error?: string
        published_at?: string
        [key: string]: unknown
    }
}

export async function handleEvent(event: ZernioEvent): Promise<void> {
    const postId = event.data?.post_id
    switch (event.type) {
        case "post.published": {
            if (!postId) return
            const local = await findPostByZernioId(postId)
            if (!local) return
            const publishedAt = event.data.published_at
                ? new Date(event.data.published_at)
                : new Date()
            await markPostPublished(local.id, {
                publishedAt,
                zernioPostId: postId,
            })
            return
        }
        case "post.failed": {
            if (!postId) return
            const local = await findPostByZernioId(postId)
            if (!local) return
            await markPostFailed(
                local.id,
                typeof event.data.error === "string" ? event.data.error : "Unknown error",
            )
            return
        }
        default:
            // Unhandled event types — log and ignore.
            console.log("[Zernio] unhandled webhook event:", event.type)
    }
}
