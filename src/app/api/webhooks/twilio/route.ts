/**
 * Twilio inbound SMS webhook. Configured per-workspace by setting Twilio's
 * "A message comes in" URL to /api/webhooks/twilio?ws=<workspaceId>.
 *
 * Validates the X-Twilio-Signature header against the workspace's auth token
 * (Twilio's standard request validation). On success:
 *   - Writes the reply to sms_logs (status="received")
 *   - Resolves From number → contact, fires sms_replied automation trigger
 *   - Auto-suppresses the contact from SMS if the body is STOP/UNSUBSCRIBE/etc.
 *
 * STOP-keyword handling is built-in to Twilio for free tier numbers, but we
 * mirror it on our side so the contact's record reflects the opt-out.
 */

import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { adminDb } from "@/lib/firebase-admin"
import { fireTrigger } from "@/lib/automations/triggers"

export const dynamic = "force-dynamic"

const STOP_KEYWORDS = new Set([
    "stop",
    "stopall",
    "unsubscribe",
    "cancel",
    "end",
    "quit",
])

export async function POST(req: NextRequest) {
    const ws = req.nextUrl.searchParams.get("ws") ?? ""
    if (!ws) {
        return NextResponse.json({ error: "missing ws param" }, { status: 400 })
    }

    // Read form-encoded body (Twilio sends application/x-www-form-urlencoded)
    const text = await req.text()
    const params: Record<string, string> = {}
    for (const [k, v] of new URLSearchParams(text).entries()) {
        params[k] = v
    }

    // Validate signature against the workspace's auth token
    const wsDoc = await adminDb.collection("workspaces").doc(ws).get()
    if (!wsDoc.exists) {
        return NextResponse.json({ error: "workspace not found" }, { status: 404 })
    }
    const wsData = wsDoc.data() ?? {}
    const t = (wsData.twilio as { authToken?: string } | undefined) ?? {}
    if (!t.authToken) {
        return NextResponse.json({ error: "twilio not configured" }, { status: 503 })
    }

    const sig = req.headers.get("x-twilio-signature") ?? ""
    const fullUrl = req.nextUrl.toString()
    const valid = twilio.validateRequest(t.authToken, sig, fullUrl, params)
    if (!valid && process.env.TWILIO_ALLOW_UNSIGNED !== "1") {
        return NextResponse.json({ error: "invalid signature" }, { status: 401 })
    }

    const fromNumber = (params.From || "").trim()
    const body = (params.Body || "").trim()
    const messageSid = (params.MessageSid || params.SmsMessageSid || "").trim()

    if (!fromNumber || !body) {
        return new NextResponse("", { status: 200, headers: { "content-type": "text/xml" } })
    }

    // Resolve sender number → contact (best-effort; phones in CRM may not be normalized)
    const contactSnap = await adminDb
        .collection("contacts")
        .where("workspaceId", "==", ws)
        .where("phone", "==", fromNumber)
        .limit(1)
        .get()
    const contactId = contactSnap.empty ? "" : contactSnap.docs[0].id

    // Log the inbound message
    const ref = adminDb.collection("sms_logs").doc()
    await ref.set({
        workspaceId: ws,
        to: "(inbound)",
        from: fromNumber,
        body,
        status: "received",
        messageSid,
        contactId: contactId || null,
        sentAt: new Date(),
    })

    // STOP-keyword handling: tag the contact as sms_unsubscribed
    if (STOP_KEYWORDS.has(body.trim().toLowerCase()) && contactId) {
        await adminDb
            .collection("contacts")
            .doc(contactId)
            .update({
                smsUnsubscribed: true,
                smsUnsubscribedAt: new Date(),
                updatedAt: new Date(),
            })
    }

    // Fire automation trigger
    fireTrigger({
        workspaceId: ws,
        type: "sms_replied",
        contactId,
        payload: { body, fromNumber, messageSid },
    }).catch(() => {})

    // Twilio expects an XML TwiML response (empty <Response/> = no auto-reply)
    return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>", {
        status: 200,
        headers: { "content-type": "text/xml" },
    })
}
