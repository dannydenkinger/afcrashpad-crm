import { NextRequest, NextResponse } from "next/server"
import { handleEvent, verifyWebhookSignature } from "@/lib/zernio/webhooks"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    const rawBody = await req.text()
    const signature = req.headers.get("x-zernio-signature")

    if (!verifyWebhookSignature(rawBody, signature)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    let event: unknown
    try {
        event = JSON.parse(rawBody)
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (!event || typeof event !== "object" || !("type" in event)) {
        return NextResponse.json({ error: "Malformed event" }, { status: 400 })
    }

    try {
        await handleEvent(event as { type: string; data: Record<string, unknown> })
        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error("[Zernio] webhook handler error:", err)
        return NextResponse.json({ error: "Handler failed" }, { status: 500 })
    }
}
