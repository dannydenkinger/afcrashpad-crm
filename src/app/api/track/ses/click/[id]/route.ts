import { NextRequest, NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import { verifyClickSignature } from "@/lib/email/tracking"
import { logActivity } from "@/lib/activities/timeline"
import { fireTrigger } from "@/lib/automations/triggers"

export const dynamic = "force-dynamic"

interface Ctx {
    params: Promise<{ id: string }>
}

/**
 * Click tracking. URL format:
 *   /api/track/click/{emailLogId}?url=<encoded original>&t=<hmac>
 *
 * Verifies the HMAC (so this isn't an open redirect), updates email_logs,
 * logs an activity, and 302-redirects to the original URL. If signature
 * fails or the URL is malformed, returns 400 (does NOT redirect).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
    const { id } = await ctx.params
    const url = req.nextUrl.searchParams.get("url")
    const sig = req.nextUrl.searchParams.get("t")

    if (!url || !sig) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
    }
    if (!verifyClickSignature(url, sig)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    // Fire-and-forget DB write so the redirect is fast.
    void recordClick(id, url).catch((err) => {
        console.error("[track/click] failed to record click:", err)
    })

    return NextResponse.redirect(url, { status: 302 })
}

async function recordClick(emailLogId: string, url: string): Promise<void> {
    if (!emailLogId) return
    const ref = adminDb.collection("email_logs").doc(emailLogId)
    const doc = await ref.get()
    if (!doc.exists) return
    const data = doc.data()!
    const now = new Date()
    const isFirstClick = !data.clickedAt

    await ref.update({
        clickedAt: data.clickedAt ?? now,
        lastClickedAt: now,
        clickCount: (data.clickCount ?? 0) + 1,
        lastClickedUrl: url,
        // Append per-click record so the campaign report can break down
        // engagement by individual link / URL. Capped client-side at the
        // aggregation layer to avoid runaway growth on weird mailers.
        clicks: FieldValue.arrayUnion({ url, at: now }),
    })

    if (isFirstClick && data.workspaceId && data.contactId) {
        await logActivity({
            workspaceId: data.workspaceId as string,
            type: "email_clicked",
            source: "ses",
            contactId: data.contactId as string,
            subject: `Clicked: ${data.subject ?? "(no subject)"}`,
            body: url,
            metadata: {
                url,
                campaignId: data.campaignId ?? null,
                messageId: data.messageId ?? null,
            },
            sourceRef: emailLogId,
        })

        // Fire unified-engine "email_clicked" trigger
        fireTrigger({
            workspaceId: data.workspaceId as string,
            type: "email_clicked",
            contactId: data.contactId as string,
            match: { campaignId: (data.campaignId as string) || undefined },
            payload: { emailLogId, url },
        }).catch(() => {})
    }
}
