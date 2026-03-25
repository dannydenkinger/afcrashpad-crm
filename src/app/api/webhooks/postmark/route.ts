import { NextResponse } from "next/server";
import { threadIncomingReply } from "@/app/communications/actions";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Postmark inbound webhook handler.
 *
 * Setup:
 * 1. In Postmark, go to Servers > your server > Settings > Inbound
 * 2. Set your inbound domain (e.g., inbound.afcrashpad.com)
 * 3. Set the webhook URL to: https://your-domain.com/api/webhooks/postmark
 * 4. Add an MX record for inbound.afcrashpad.com pointing to inbound.postmarkapp.com
 * 5. Set POSTMARK_INBOUND_DOMAIN=inbound.afcrashpad.com in your environment
 *
 * Outbound emails automatically use reply+{trackingId}@{POSTMARK_INBOUND_DOMAIN}
 * as the Reply-To address. When a contact replies, Postmark parses the email and
 * POSTs it here. The trackingId in the address lets us match it to the original
 * conversation instantly.
 */

export async function POST(request: Request) {
    try {
        const payload = await request.json();

        // Postmark inbound payload fields:
        // FromFull.Email, Subject, HtmlBody, TextBody, StrippedTextReply,
        // MailboxHash (the part after + in the To address), MessageID,
        // Headers (array of {Name, Value})
        const fromEmail = payload.FromFull?.Email || payload.From || "";
        const subject = payload.Subject || "(No subject)";
        // Prefer StrippedTextReply (just the new reply, no quoted text) for cleaner threads
        const body = payload.HtmlBody || payload.TextBody || "";
        const strippedReply = payload.StrippedTextReply || "";
        const mailboxHash = payload.MailboxHash || ""; // e.g., the trackingId
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

        // If we have a mailboxHash (trackingId), try direct lookup first —
        // this is the most reliable matching method
        let trackingContactId: string | null = null;
        let trackingParentId: string | null = null;
        let trackingThreadId: string | null = null;

        if (mailboxHash) {
            const trackingDoc = await adminDb.collection("email_tracking").doc(mailboxHash).get();
            if (trackingDoc.exists) {
                const tracking = trackingDoc.data()!;
                trackingContactId = tracking.contactId;

                if (trackingContactId) {
                    // Find the original outbound message that has this trackingId
                    const originalMsgSnap = await adminDb
                        .collection("contacts")
                        .doc(trackingContactId)
                        .collection("messages")
                        .where("trackingId", "==", mailboxHash)
                        .limit(1)
                        .get();

                    if (!originalMsgSnap.empty) {
                        trackingParentId = originalMsgSnap.docs[0].id;
                        trackingThreadId = originalMsgSnap.docs[0].data().threadId || trackingParentId;
                    }
                }
            }
        }

        // If direct tracking lookup succeeded, store the reply directly
        if (trackingContactId) {
            await adminDb
                .collection("contacts")
                .doc(trackingContactId)
                .collection("messages")
                .add({
                    contactId: trackingContactId,
                    type: "email",
                    direction: "INBOUND",
                    content: strippedReply || body,
                    subject,
                    createdAt: new Date(),
                    fromEmail,
                    ...(trackingParentId && { parentMessageId: trackingParentId }),
                    ...(trackingThreadId && { threadId: trackingThreadId }),
                    ...(messageId && { emailMessageId: messageId }),
                });

            return NextResponse.json({
                ok: true,
                contactId: trackingContactId,
                threaded: !!trackingParentId,
                matchMethod: "trackingId",
            });
        }

        // Fallback: use the general threadIncomingReply matching (by In-Reply-To, subject, or email)
        const result = await threadIncomingReply({
            fromEmail,
            subject,
            body: strippedReply || body,
            inReplyTo,
            messageId,
        });

        if (!result.success) {
            console.warn("Postmark inbound: could not thread reply:", result.error);
            // Return 200 so Postmark doesn't retry
            return NextResponse.json({ ok: false, error: result.error });
        }

        return NextResponse.json({
            ok: true,
            contactId: result.contactId,
            threaded: !!result.parentMessageId,
            matchMethod: "fallback",
        });
    } catch (error) {
        console.error("Postmark inbound webhook error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
