import { NextResponse } from "next/server"
import { findGmailIntegrationByEmail, upsertGmailIntegration, getValidGmailToken } from "@/lib/gmail-integration"
import { getHistoryChanges, fetchFullMessage } from "@/lib/gmail-watch"
import { parseGmailMessage, matchEmailToContact, stripQuotedReply } from "@/lib/gmail-parser"
import { tenantDb } from "@/lib/tenant-db"

/**
 * Gmail Pub/Sub webhook endpoint.
 *
 * Google Cloud Pub/Sub sends POST requests here when a user's inbox changes.
 * The payload contains: { message: { data: base64, messageId, publishTime } }
 * The decoded data contains: { emailAddress, historyId }
 */
export async function POST(request: Request) {
    try {
        // Verify webhook secret if configured
        const webhookSecret = process.env.GMAIL_WEBHOOK_SECRET
        if (webhookSecret) {
            const url = new URL(request.url)
            const token = url.searchParams.get("token")
            if (token !== webhookSecret) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }
        }

        const body = await request.json()
        const pubsubMessage = body.message

        if (!pubsubMessage?.data) {
            return NextResponse.json({ error: "No message data" }, { status: 400 })
        }

        // Decode the Pub/Sub message
        const decoded = JSON.parse(
            Buffer.from(pubsubMessage.data, "base64").toString("utf-8")
        )
        const { emailAddress, historyId } = decoded

        if (!emailAddress) {
            return NextResponse.json({ error: "No email address" }, { status: 400 })
        }

        // Find the Gmail integration for this email
        const integration = await findGmailIntegrationByEmail(emailAddress)
        if (!integration) {
            // No matching integration — user may have disconnected
            return NextResponse.json({ ok: true })
        }

        const { workspaceId, userId } = integration

        // Get a valid access token
        const accessToken = await getValidGmailToken(workspaceId, userId)

        // Get new messages since our last known historyId
        const startHistoryId = integration.historyId || historyId
        const newMessageIds = await getHistoryChanges(accessToken, startHistoryId)

        // Process each new message
        for (const msgId of newMessageIds) {
            try {
                const rawMessage = await fetchFullMessage(accessToken, msgId)
                const parsed = parseGmailMessage(rawMessage)

                // Skip messages sent BY the user (we already track outbound)
                if (parsed.fromEmail === emailAddress.toLowerCase()) continue

                // Match sender to a contact
                const contact = await matchEmailToContact(workspaceId, parsed.fromEmail)
                if (!contact) continue // Only import emails from known contacts

                const db = tenantDb(workspaceId)

                // Check for duplicate (same gmailMessageId)
                const existing = await db.collection("messages")
                    .where("gmailMessageId", "==", parsed.gmailMessageId)
                    .limit(1)
                    .get()
                if (!existing.empty) continue

                // Find parent message for threading via In-Reply-To
                let parentMessageId: string | undefined
                let threadId: string | undefined
                if (parsed.inReplyTo) {
                    const parentSnap = await db.collectionGroup("messages")
                        .where("emailMessageId", "==", parsed.inReplyTo)
                        .limit(1)
                        .get()
                    if (!parentSnap.empty) {
                        parentMessageId = parentSnap.docs[0].id
                        threadId = parentSnap.docs[0].data().threadId || parentSnap.docs[0].id
                    }
                }

                // Also try matching by gmailThreadId
                if (!parentMessageId && parsed.gmailThreadId) {
                    const threadSnap = await db.collectionGroup("messages")
                        .where("gmailThreadId", "==", parsed.gmailThreadId)
                        .orderBy("createdAt", "desc")
                        .limit(1)
                        .get()
                    if (!threadSnap.empty) {
                        parentMessageId = threadSnap.docs[0].id
                        threadId = threadSnap.docs[0].data().threadId || threadSnap.docs[0].id
                    }
                }

                // Store the inbound message
                const strippedBody = stripQuotedReply(parsed.body)

                await db.addToSubcollection("contacts", contact.contactId, "messages", {
                    contactId: contact.contactId,
                    type: "email",
                    direction: "INBOUND",
                    content: strippedBody,
                    subject: parsed.subject,
                    fromEmail: parsed.fromEmail,
                    createdAt: new Date(parsed.date || Date.now()),
                    gmailMessageId: parsed.gmailMessageId,
                    gmailThreadId: parsed.gmailThreadId,
                    emailMessageId: parsed.emailMessageId,
                    ...(parentMessageId && { parentMessageId }),
                    ...(threadId && { threadId }),
                    ...(parsed.attachments.length > 0 && {
                        attachments: parsed.attachments.map((a) => ({
                            filename: a.filename,
                            contentType: a.mimeType,
                            gmailAttachmentId: a.attachmentId,
                        })),
                    }),
                })
            } catch (msgErr) {
                console.error(`[GMAIL-WEBHOOK] Failed to process message ${msgId}:`, msgErr)
            }
        }

        // Update the stored historyId
        await upsertGmailIntegration(workspaceId, userId, {
            historyId,
        })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("[GMAIL-WEBHOOK] Error processing notification:", error)
        // Return 200 to avoid Pub/Sub retries on non-transient errors
        return NextResponse.json({ ok: true })
    }
}
