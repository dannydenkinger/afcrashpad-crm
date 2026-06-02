import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { TRACKING_PIXEL_PNG } from "@/lib/email/tracking"
import { logActivity } from "@/lib/activities/timeline"
import { fireTrigger } from "@/lib/automations/triggers"

export const dynamic = "force-dynamic"

interface Ctx {
    params: Promise<{ id: string }>
}

/**
 * Open tracking pixel. Returns a 1×1 transparent PNG always (so email clients
 * never show a broken-image icon), and asynchronously updates email_logs.
 *
 * Idempotent: only sets `openedAt` and logs the activity on first open. Repeat
 * loads (e.g. recipient re-opens) update `lastOpenedAt` and bump `openCount`.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
    const { id: rawId } = await ctx.params
    const id = rawId.replace(/\.png$/i, "")

    // Fire-and-forget the DB update; don't block the pixel response.
    void recordOpen(id).catch((err) => {
        console.error("[track/open] failed to record open:", err)
    })

    return new NextResponse(new Uint8Array(TRACKING_PIXEL_PNG), {
        status: 200,
        headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            Pragma: "no-cache",
            Expires: "0",
        },
    })
}

async function recordOpen(emailLogId: string): Promise<void> {
    if (!emailLogId) return
    const ref = adminDb.collection("email_logs").doc(emailLogId)
    const doc = await ref.get()
    if (!doc.exists) return
    const data = doc.data()!
    const now = new Date()
    const isFirstOpen = !data.openedAt

    await ref.update({
        openedAt: data.openedAt ?? now,
        lastOpenedAt: now,
        openCount: (data.openCount ?? 0) + 1,
    })

    if (isFirstOpen && data.workspaceId && data.contactId) {
        await logActivity({
            workspaceId: data.workspaceId as string,
            type: "email_opened",
            source: "ses",
            contactId: data.contactId as string,
            subject: `Opened: ${data.subject ?? "(no subject)"}`,
            metadata: {
                campaignId: data.campaignId ?? null,
                messageId: data.messageId ?? null,
            },
            sourceRef: emailLogId,
        })

        // Fire unified-engine "email_opened" trigger so automations like
        // "if opened welcome → send tip series" can pick it up.
        fireTrigger({
            workspaceId: data.workspaceId as string,
            type: "email_opened",
            contactId: data.contactId as string,
            match: { campaignId: (data.campaignId as string) || undefined },
            payload: { emailLogId, subject: data.subject ?? null },
        }).catch(() => {})
    }
}
