import { NextResponse } from "next/server";
import { threadIncomingReply } from "@/app/communications/actions";

/**
 * Postmark inbound webhook handler.
 *
 * Outbound emails use reply@{POSTMARK_INBOUND_DOMAIN} as Reply-To.
 * When a contact replies, Postmark parses the email and POSTs it here.
 * Matching is done by In-Reply-To header, sender email + subject, or sender email.
 */

export async function POST(request: Request) {
    try {
        const payload = await request.json();

        const fromEmail = payload.FromFull?.Email || payload.From || "";
        const subject = payload.Subject || "(No subject)";
        const body = payload.HtmlBody || payload.TextBody || "";
        const strippedReply = payload.StrippedTextReply || "";
        const messageId = payload.MessageID || "";

        // Extract In-Reply-To from headers array
        const headers = payload.Headers || [];
        const inReplyToHeader = headers.find(
            (h: { Name: string; Value: string }) => h.Name.toLowerCase() === "in-reply-to"
        );
        const inReplyTo = inReplyToHeader?.Value || "";

        if (!fromEmail) {
            return NextResponse.json({ error: "No sender email" }, { status: 400 });
        }

        const result = await threadIncomingReply({
            fromEmail,
            subject,
            body: strippedReply || body,
            inReplyTo,
            messageId,
        });

        if (!result.success) {
            console.warn("Postmark inbound: could not thread reply:", result.error);
            return NextResponse.json({ ok: false, error: result.error });
        }

        return NextResponse.json({
            ok: true,
            contactId: result.contactId,
            threaded: !!result.parentMessageId,
        });
    } catch (error) {
        console.error("Postmark inbound webhook error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
