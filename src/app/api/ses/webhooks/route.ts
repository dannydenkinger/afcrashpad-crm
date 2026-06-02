import { NextRequest, NextResponse } from "next/server"
import {
    confirmSubscription,
    handleSesEvent,
    verifySnsMessage,
} from "@/lib/ses/webhooks"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    const rawBody = await req.text()
    let envelope: Record<string, unknown>
    try {
        envelope = JSON.parse(rawBody)
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    try {
        const validated = await verifySnsMessage(envelope)

        if (validated.Type === "SubscriptionConfirmation") {
            if (!validated.SubscribeURL) {
                return NextResponse.json({ error: "Missing SubscribeURL" }, { status: 400 })
            }
            await confirmSubscription(validated.SubscribeURL)
            return NextResponse.json({ ok: true, confirmed: true })
        }

        if (validated.Type === "UnsubscribeConfirmation") {
            console.log("[SES webhook] Received UnsubscribeConfirmation — ignoring")
            return NextResponse.json({ ok: true })
        }

        if (validated.Type !== "Notification") {
            return NextResponse.json({ ok: true, ignored: true })
        }

        const inner = validated.Message
        if (typeof inner !== "string") {
            return NextResponse.json({ error: "Malformed Message field" }, { status: 400 })
        }

        let sesBody: Record<string, unknown>
        try {
            sesBody = JSON.parse(inner)
        } catch {
            return NextResponse.json({ error: "Malformed inner JSON" }, { status: 400 })
        }

        await handleSesEvent(sesBody as unknown as Parameters<typeof handleSesEvent>[0])
        return NextResponse.json({ ok: true })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Validation failed"
        console.error("[SES webhook] error:", err)
        // Classify sns-validator errors:
        //   "missing required keys" → malformed payload (400)
        //   "signature" / "certificate" / "verification" → forged/tampered (401)
        //   anything else → server-side problem (500)
        if (/missing required keys?|invalid field|Unexpected token/i.test(message)) {
            return NextResponse.json({ error: message }, { status: 400 })
        }
        if (/signature|certificate|verification/i.test(message)) {
            return NextResponse.json({ error: message }, { status: 401 })
        }
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
