import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

/**
 * Tracks form views and field abandonment for analytics.
 * POST /api/forms/[formId]/track
 * Body: { event: "view" | "abandon", lastFieldId?: string }
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params

        // Rate limit: 1 view per IP per hour
        const { allowed } = rateLimit(getRateLimitKey(request, `form-track-${formId}`), 60)
        if (!allowed) return NextResponse.json({ ok: true })

        const formDoc = await adminDb.collection("lead_forms").doc(formId).get()
        if (!formDoc.exists) return NextResponse.json({ ok: true })

        let body: any = {}
        try { body = await request.json() } catch {}

        const event = body.event || "view"

        if (event === "view") {
            // Increment view count
            const currentViews = formDoc.data()?.viewCount || 0
            await adminDb.collection("lead_forms").doc(formId).update({
                viewCount: currentViews + 1,
            })
        } else if (event === "abandon" && body.lastFieldId) {
            // Record field abandonment
            await adminDb.collection("lead_forms").doc(formId)
                .collection("analytics")
                .add({
                    event: "abandon",
                    lastFieldId: body.lastFieldId,
                    timestamp: new Date(),
                })
        }

        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ ok: true })
    }
}
