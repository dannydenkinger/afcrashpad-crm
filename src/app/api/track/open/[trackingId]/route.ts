import { NextRequest } from "next/server";
import { recordOpen } from "@/lib/email-tracking";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Transparent 1x1 GIF pixel (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
);

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ trackingId: string }> }
) {
    const { trackingId } = await params;

    // Fire-and-forget: record the open event without blocking the response
    const userAgent = request.headers.get("user-agent");
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip")
        || null;

    // Look up workspaceId from the tracking record, then record the open
    adminDb.collection("email_tracking").doc(trackingId).get()
        .then(doc => {
            const workspaceId = doc.data()?.workspaceId;
            if (workspaceId) {
                return recordOpen(workspaceId, trackingId, userAgent, ip);
            }
        })
        .catch(() => {});

    return new Response(TRANSPARENT_GIF, {
        status: 200,
        headers: {
            "Content-Type": "image/gif",
            "Content-Length": String(TRANSPARENT_GIF.length),
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    });
}
