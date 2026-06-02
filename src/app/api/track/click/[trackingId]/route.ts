import { NextRequest, NextResponse } from "next/server";
import { recordClick } from "@/lib/email-tracking";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ trackingId: string }> }
) {
    const { trackingId } = await params;
    const linkId = request.nextUrl.searchParams.get("l");

    if (!linkId) {
        return NextResponse.json({ error: "Missing link parameter" }, { status: 400 });
    }

    const userAgent = request.headers.get("user-agent");
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip")
        || null;

    // Look up workspaceId from the tracking record
    const trackingDoc = await adminDb.collection("email_tracking").doc(trackingId).get();
    const workspaceId = trackingDoc.data()?.workspaceId;
    if (!workspaceId) {
        const fallback = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        return NextResponse.redirect(fallback, 302);
    }

    const originalUrl = await recordClick(workspaceId, trackingId, linkId, userAgent, ip);

    if (!originalUrl) {
        // Fallback: redirect to the app homepage if we can't find the original URL
        const fallback = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        return NextResponse.redirect(fallback, 302);
    }

    return NextResponse.redirect(originalUrl, 302);
}
