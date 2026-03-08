"use server"

import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { getTrackingForContact } from "@/lib/email-tracking";
import { sendTrackedEmail } from "@/lib/email";
import { captureError } from "@/lib/error-tracking";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const firestoreIdSchema = z.string().min(1).max(128);

const getMessagesSchema = z.object({ contactId: firestoreIdSchema });

const sendMessageSchema = z.object({
    contactId: firestoreIdSchema,
    type: z.string().min(1).max(50),
    content: z.string().min(1).max(10000),
});

const scheduleMessageSchema = z.object({
    contactId: firestoreIdSchema,
    type: z.string().min(1).max(50),
    content: z.string().min(1).max(10000),
    scheduledAt: z.string().min(1), // ISO date string
    attachments: z.array(z.object({
        filename: z.string(),
        url: z.string(),
        contentType: z.string().optional(),
    })).optional(),
});

const snippetSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(10000),
});

// ── Conversations ────────────────────────────────────────────────────────────

export async function getConversations() {
    try {
        // Fetch all contacts
        const contactsSnap = await adminDb.collection('contacts').get();

        // Fetch latest message per contact in parallel (only 1 message each, not all)
        const conversationPromises = contactsSnap.docs.map(async (contactDoc) => {
            const contactId = contactDoc.id;
            const contactData = contactDoc.data();

            const latestSnap = await adminDb.collection('contacts').doc(contactId).collection('messages')
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();

            if (latestSnap.empty) return null;

            const latestMessage = latestSnap.docs[0].data();
            return {
                contactId,
                contactName: contactData.name,
                email: contactData.email,
                phone: contactData.phone,
                status: contactData.status,
                lastMessage: latestMessage.content,
                lastMessageType: latestMessage.type,
                lastMessageDirection: latestMessage.direction,
                lastMessageTime: latestMessage.createdAt?.toDate ? latestMessage.createdAt.toDate().toISOString() : latestMessage.createdAt,
            };
        });

        const results = await Promise.all(conversationPromises);
        const conversations = results.filter((c): c is NonNullable<typeof c> => c !== null);

        // Sort by most recent message
        conversations.sort((a, b) => {
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        });

        return { success: true, conversations };
    } catch (error) {
        console.error("Failed to fetch conversations:", error);
        return { success: false, conversations: [] };
    }
}

export async function getMessages(contactId: string) {
    const parsed = getMessagesSchema.safeParse({ contactId });
    if (!parsed.success) return { success: false, messages: [], contact: null };
    contactId = parsed.data.contactId;

    try {
        const contactDoc = await adminDb.collection('contacts').doc(contactId).get();
        const contactData = contactDoc.data();

        const messagesSnap = await adminDb.collection('contacts').doc(contactId).collection('messages')
            .orderBy('createdAt', 'asc')
            .get();

        const messages = messagesSnap.docs.map(doc => {
            const m = doc.data();
            return {
                id: doc.id,
                ...m,
                createdAt: m.createdAt?.toDate ? m.createdAt.toDate().toISOString() : m.createdAt,
                scheduledAt: m.scheduledAt?.toDate ? m.scheduledAt.toDate().toISOString() : m.scheduledAt || null,
            };
        });

        return {
            success: true,
            messages,
            contact: contactDoc.exists ? { id: contactDoc.id, name: contactData?.name, email: contactData?.email, phone: contactData?.phone, status: contactData?.status } : null
        };
    } catch (error) {
        console.error("Failed to fetch messages:", error);
        return { success: false, messages: [], contact: null };
    }
}

// ── Send Message (with optional attachments) ─────────────────────────────────

export async function sendMessage(
    contactId: string,
    type: string,
    content: string,
    attachments?: { filename: string; url: string; contentType?: string }[]
) {
    const parsed = sendMessageSchema.safeParse({ contactId, type, content });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    contactId = parsed.data.contactId;
    type = parsed.data.type;
    content = parsed.data.content;

    try {
        let trackingId: string | null = null;

        // If sending an email, actually send it via Resend with tracking
        if (type === "email") {
            const contactDoc = await adminDb.collection('contacts').doc(contactId).get();
            const contactData = contactDoc.data();
            if (contactData?.email) {
                // Convert plain text to HTML for the email
                const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    ${content.replace(/\n/g, "<br>")}
                </div>`;

                // Build Resend attachments from URLs
                const resendAttachments = attachments?.length
                    ? await buildResendAttachments(attachments)
                    : undefined;

                const result = await sendTrackedEmail({
                    to: contactData.email,
                    subject: content.split("\n")[0].substring(0, 100), // First line as subject
                    html,
                    contactId,
                    attachments: resendAttachments,
                });
                trackingId = result.trackingId;
            }
        }

        await adminDb.collection('contacts').doc(contactId).collection('messages').add({
            contactId,
            type,
            direction: "OUTBOUND",
            content,
            createdAt: new Date(),
            ...(trackingId && { trackingId }),
            ...(attachments?.length && { attachments }),
        });

        revalidatePath("/communications");
        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)), { action: "sendMessage" });
        return { success: false, error: "Failed to send message" };
    }
}

// ── Schedule Message ─────────────────────────────────────────────────────────

export async function scheduleMessage(
    contactId: string,
    type: string,
    content: string,
    scheduledAt: string,
    attachments?: { filename: string; url: string; contentType?: string }[]
) {
    const parsed = scheduleMessageSchema.safeParse({ contactId, type, content, scheduledAt, attachments });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const scheduledDate = new Date(parsed.data.scheduledAt);
        if (scheduledDate <= new Date()) {
            return { success: false, error: "Scheduled time must be in the future" };
        }

        await adminDb.collection('contacts').doc(parsed.data.contactId).collection('messages').add({
            contactId: parsed.data.contactId,
            type: parsed.data.type,
            direction: "OUTBOUND",
            content: parsed.data.content,
            createdAt: new Date(),
            scheduledAt: scheduledDate,
            status: "scheduled",
            ...(attachments?.length && { attachments }),
        });

        revalidatePath("/communications");
        return { success: true };
    } catch (error) {
        console.error("Failed to schedule message:", error);
        return { success: false, error: "Failed to schedule message" };
    }
}

export async function cancelScheduledMessage(contactId: string, messageId: string) {
    const parsedContact = firestoreIdSchema.safeParse(contactId);
    const parsedMessage = firestoreIdSchema.safeParse(messageId);
    if (!parsedContact.success || !parsedMessage.success) return { success: false, error: "Invalid input" };

    try {
        const docRef = adminDb.collection('contacts').doc(parsedContact.data).collection('messages').doc(parsedMessage.data);
        const doc = await docRef.get();
        if (!doc.exists) return { success: false, error: "Message not found" };

        const data = doc.data();
        if (data?.status !== "scheduled") return { success: false, error: "Message is not scheduled" };

        await docRef.update({ status: "cancelled" });
        revalidatePath("/communications");
        return { success: true };
    } catch (error) {
        console.error("Failed to cancel scheduled message:", error);
        return { success: false, error: "Failed to cancel scheduled message" };
    }
}

/**
 * Process scheduled messages that are due for sending.
 * Called by the cron endpoint alongside other scheduled tasks.
 */
export async function processScheduledMessages(): Promise<{ sent: number; failed: number }> {
    const results = { sent: 0, failed: 0 };

    try {
        const now = new Date();

        // Query all contacts' messages subcollections is not efficient at scale.
        // Instead, we use a top-level collection for scheduled messages lookups.
        // For now, we scan the scheduled_messages collection.
        const scheduledSnap = await adminDb
            .collectionGroup('messages')
            .where('status', '==', 'scheduled')
            .where('scheduledAt', '<=', now)
            .limit(50)
            .get();

        for (const msgDoc of scheduledSnap.docs) {
            const msg = msgDoc.data();
            try {
                let trackingId: string | null = null;

                if (msg.type === "email") {
                    const contactDoc = await adminDb.collection('contacts').doc(msg.contactId).get();
                    const contactData = contactDoc.data();
                    if (contactData?.email) {
                        const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                            ${msg.content.replace(/\n/g, "<br>")}
                        </div>`;

                        const resendAttachments = msg.attachments?.length
                            ? await buildResendAttachments(msg.attachments)
                            : undefined;

                        const result = await sendTrackedEmail({
                            to: contactData.email,
                            subject: msg.content.split("\n")[0].substring(0, 100),
                            html,
                            contactId: msg.contactId,
                            attachments: resendAttachments,
                        });
                        trackingId = result.trackingId;
                    }
                }

                await msgDoc.ref.update({
                    status: "sent",
                    sentAt: new Date(),
                    ...(trackingId && { trackingId }),
                });
                results.sent++;
            } catch (err: any) {
                await msgDoc.ref.update({
                    status: "failed",
                    error: err?.message || "Send failed",
                });
                results.failed++;
            }
        }
    } catch (err) {
        console.error("Process scheduled messages error:", err);
    }

    return results;
}

// ── Snippets (Canned Responses) ──────────────────────────────────────────────

export async function getSnippets() {
    try {
        const snap = await adminDb.collection('email_snippets')
            .orderBy('createdAt', 'desc')
            .get();

        const snippets = snap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                title: d.title,
                content: d.content,
                userId: d.userId || null,
                createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
            };
        });

        return { success: true, snippets };
    } catch (error) {
        console.error("Failed to fetch snippets:", error);
        return { success: false, snippets: [] };
    }
}

export async function createSnippet(title: string, content: string) {
    const parsed = snippetSchema.safeParse({ title, content });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const docRef = await adminDb.collection('email_snippets').add({
            title: parsed.data.title,
            content: parsed.data.content,
            createdAt: new Date(),
        });

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Failed to create snippet:", error);
        return { success: false, error: "Failed to create snippet" };
    }
}

export async function updateSnippet(id: string, title: string, content: string) {
    const parsedId = firestoreIdSchema.safeParse(id);
    const parsed = snippetSchema.safeParse({ title, content });
    if (!parsedId.success || !parsed.success) return { success: false, error: "Invalid input" };

    try {
        await adminDb.collection('email_snippets').doc(parsedId.data).update({
            title: parsed.data.title,
            content: parsed.data.content,
            updatedAt: new Date(),
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to update snippet:", error);
        return { success: false, error: "Failed to update snippet" };
    }
}

export async function deleteSnippet(id: string) {
    const parsedId = firestoreIdSchema.safeParse(id);
    if (!parsedId.success) return { success: false, error: "Invalid input" };

    try {
        await adminDb.collection('email_snippets').doc(parsedId.data).delete();
        return { success: true };
    } catch (error) {
        console.error("Failed to delete snippet:", error);
        return { success: false, error: "Failed to delete snippet" };
    }
}

// ── Contact Documents (for attachment picker) ────────────────────────────────

export async function getContactDocuments(contactId: string) {
    const parsed = firestoreIdSchema.safeParse(contactId);
    if (!parsed.success) return { success: false, documents: [] };

    try {
        const snap = await adminDb.collection('contacts').doc(parsed.data).collection('documents')
            .orderBy('createdAt', 'desc')
            .get();

        const documents = snap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                name: d.name,
                url: d.url,
                status: d.status,
                createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
            };
        });

        return { success: true, documents };
    } catch (error) {
        console.error("Failed to fetch contact documents:", error);
        return { success: false, documents: [] };
    }
}

// ── Communication Analytics ──────────────────────────────────────────────────

export async function getCommunicationAnalytics() {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Fetch all tracking records
        const allTrackingSnap = await adminDb.collection('email_tracking')
            .orderBy('sentAt', 'desc')
            .get();

        const allTracking = allTrackingSnap.docs.map(doc => {
            const d = doc.data();
            return {
                sentAt: d.sentAt?.toDate ? d.sentAt.toDate() : new Date(d.sentAt),
                opened: d.opened ?? false,
                openedAt: d.openedAt?.toDate ? d.openedAt.toDate() : (d.openedAt ? new Date(d.openedAt) : null),
                openCount: d.openCount ?? 0,
                totalClicks: d.totalClicks ?? 0,
                clickedLinks: d.clickedLinks ?? [],
                contactId: d.contactId,
            };
        });

        // Total emails sent
        const totalEmailsAllTime = allTracking.length;
        const totalEmailsThisMonth = allTracking.filter(t => t.sentAt >= startOfMonth).length;

        // Open rate
        const opened = allTracking.filter(t => t.opened).length;
        const openRate = totalEmailsAllTime > 0 ? Math.round((opened / totalEmailsAllTime) * 100) : 0;
        const openedThisMonth = allTracking.filter(t => t.sentAt >= startOfMonth && t.opened).length;
        const openRateThisMonth = totalEmailsThisMonth > 0 ? Math.round((openedThisMonth / totalEmailsThisMonth) * 100) : 0;

        // Click rate
        const clicked = allTracking.filter(t => t.totalClicks > 0).length;
        const clickRate = totalEmailsAllTime > 0 ? Math.round((clicked / totalEmailsAllTime) * 100) : 0;

        // Response rate: count inbound messages that came after an outbound email
        // We approximate by counting contacts who have both tracking records and inbound messages
        const contactsEmailed = new Set(allTracking.map(t => t.contactId));
        let repliesReceived = 0;

        // Check for inbound messages from emailed contacts
        for (const cid of contactsEmailed) {
            try {
                const inboundSnap = await adminDb.collection('contacts').doc(cid).collection('messages')
                    .where('direction', '==', 'INBOUND')
                    .limit(1)
                    .get();
                if (!inboundSnap.empty) repliesReceived++;
            } catch {
                // skip
            }
            // Limit to checking first 100 contacts for performance
            if (repliesReceived > 100) break;
        }
        const responseRate = contactsEmailed.size > 0 ? Math.round((repliesReceived / contactsEmailed.size) * 100) : 0;

        // Best send times (hour-of-day histogram based on opens)
        const hourHistogram: number[] = new Array(24).fill(0);
        for (const t of allTracking) {
            if (t.opened && t.openedAt) {
                const hour = t.openedAt.getHours();
                hourHistogram[hour]++;
            }
        }

        // Top performing hours
        const bestHours = hourHistogram
            .map((count, hour) => ({ hour, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Recent activity (last 30 days, daily breakdown)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
        const dailyActivity: { date: string; sent: number; opened: number; clicked: number }[] = [];
        for (let i = 29; i >= 0; i--) {
            const day = new Date(now.getTime() - i * 86400000);
            const dayStr = day.toISOString().split('T')[0];
            const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
            const dayEnd = new Date(dayStart.getTime() + 86400000);

            const daySent = allTracking.filter(t => t.sentAt >= dayStart && t.sentAt < dayEnd).length;
            const dayOpened = allTracking.filter(t => t.sentAt >= dayStart && t.sentAt < dayEnd && t.opened).length;
            const dayClicked = allTracking.filter(t => t.sentAt >= dayStart && t.sentAt < dayEnd && t.totalClicks > 0).length;

            dailyActivity.push({ date: dayStr, sent: daySent, opened: dayOpened, clicked: dayClicked });
        }

        return {
            success: true,
            analytics: {
                totalEmailsAllTime,
                totalEmailsThisMonth,
                openRate,
                openRateThisMonth,
                clickRate,
                responseRate,
                repliesReceived,
                contactsEmailed: contactsEmailed.size,
                bestHours,
                hourHistogram,
                dailyActivity,
            }
        };
    } catch (error) {
        console.error("Failed to fetch communication analytics:", error);
        return { success: false, analytics: null };
    }
}

// ── Email Reply Detection ────────────────────────────────────────────────────

/**
 * Thread incoming messages by matching reply patterns.
 *
 * When processing incoming emails (e.g., via Resend webhooks), this function
 * finds the parent conversation and threads the reply correctly.
 *
 * To set up reply detection with Resend webhooks:
 * 1. Create a webhook endpoint at /api/webhooks/resend
 * 2. Configure Resend to send "email.received" events to your webhook URL
 * 3. In the webhook handler, call threadIncomingReply() to auto-thread
 * 4. Resend forwards replies if you configure a custom domain with inbound support
 *
 * Matching strategy:
 * - Primary: Match by In-Reply-To header -> find original message by Resend emailId
 * - Fallback: Match by subject line prefix (Re:, RE:, Fwd:) -> find by subject similarity
 * - Last resort: Match by sender email -> find contact and add to their thread
 */
export async function threadIncomingReply({
    fromEmail,
    subject,
    body,
    inReplyTo,
    messageId: emailMessageId,
}: {
    fromEmail: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    messageId?: string;
}) {
    try {
        let contactId: string | null = null;
        let parentMessageId: string | null = null;
        let threadId: string | null = null;

        // Strategy 1: Match by In-Reply-To header
        if (inReplyTo) {
            const trackingSnap = await adminDb.collection('email_tracking')
                .where('emailId', '==', inReplyTo)
                .limit(1)
                .get();

            if (!trackingSnap.empty) {
                const tracking = trackingSnap.docs[0].data();
                contactId = tracking.contactId;

                if (!contactId) {
                    return { success: false, error: "Tracking record has no contactId" };
                }

                // Find the original outbound message by trackingId
                const originalMsgSnap = await adminDb.collection('contacts').doc(contactId).collection('messages')
                    .where('trackingId', '==', trackingSnap.docs[0].id)
                    .limit(1)
                    .get();

                if (!originalMsgSnap.empty) {
                    parentMessageId = originalMsgSnap.docs[0].id;
                    threadId = originalMsgSnap.docs[0].data().threadId || parentMessageId;
                }
            }
        }

        // Strategy 2: Match by subject line (strip Re:/RE:/Fwd: prefixes)
        if (!contactId) {
            const cleanSubject = subject.replace(/^(Re|RE|Fwd|FWD|Fw|FW):\s*/g, '').trim();

            // Find contact by email
            const contactSnap = await adminDb.collection('contacts')
                .where('email', '==', fromEmail)
                .limit(1)
                .get();

            if (!contactSnap.empty) {
                contactId = contactSnap.docs[0].id;

                // Look for an outbound message with matching subject
                if (cleanSubject) {
                    const messagesSnap = await adminDb.collection('contacts').doc(contactId).collection('messages')
                        .where('direction', '==', 'OUTBOUND')
                        .where('type', '==', 'email')
                        .orderBy('createdAt', 'desc')
                        .limit(20)
                        .get();

                    for (const msgDoc of messagesSnap.docs) {
                        const msgContent = msgDoc.data().content || '';
                        const msgFirstLine = msgContent.split('\n')[0].substring(0, 100);
                        if (msgFirstLine.toLowerCase().includes(cleanSubject.toLowerCase()) ||
                            cleanSubject.toLowerCase().includes(msgFirstLine.toLowerCase())) {
                            parentMessageId = msgDoc.id;
                            threadId = msgDoc.data().threadId || parentMessageId;
                            break;
                        }
                    }
                }
            }
        }

        // Strategy 3: Last resort - match by sender email only
        if (!contactId) {
            const contactSnap = await adminDb.collection('contacts')
                .where('email', '==', fromEmail)
                .limit(1)
                .get();

            if (!contactSnap.empty) {
                contactId = contactSnap.docs[0].id;
            }
        }

        if (!contactId) {
            return { success: false, error: "Could not find matching contact for " + fromEmail };
        }

        // Store the incoming reply
        await adminDb.collection('contacts').doc(contactId).collection('messages').add({
            contactId,
            type: "email",
            direction: "INBOUND",
            content: body,
            subject,
            createdAt: new Date(),
            ...(parentMessageId && { parentMessageId }),
            ...(threadId && { threadId }),
            ...(emailMessageId && { emailMessageId }),
            fromEmail,
        });

        revalidatePath("/communications");
        return { success: true, contactId, parentMessageId, threadId };
    } catch (error) {
        console.error("Failed to thread incoming reply:", error);
        return { success: false, error: "Failed to thread incoming reply" };
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export async function getAllContacts() {
    try {
        const snapshot = await adminDb.collection('contacts').orderBy('name', 'asc').get();
        const contacts = snapshot.docs.map(doc => {
            const c = doc.data();
            return {
                id: doc.id,
                name: c.name,
                email: c.email,
                phone: c.phone
            };
        });
        return { success: true, contacts };
    } catch (error) {
        return { success: false, contacts: [] };
    }
}

export async function getEmailTracking(contactId: string) {
    const parsed = z.string().min(1).max(128).safeParse(contactId);
    if (!parsed.success) return { success: false, tracking: [] };

    try {
        const tracking = await getTrackingForContact(parsed.data);
        return { success: true, tracking };
    } catch (error) {
        console.error("Failed to fetch email tracking:", error);
        return { success: false, tracking: [] };
    }
}

/**
 * Build Resend-compatible attachment objects from file URLs.
 * Fetches files from URLs and converts to base64 for Resend API.
 */
async function buildResendAttachments(
    attachments: { filename: string; url: string; contentType?: string }[]
): Promise<{ filename: string; content: Buffer }[]> {
    const results: { filename: string; content: Buffer }[] = [];

    for (const att of attachments) {
        try {
            const response = await fetch(att.url);
            if (!response.ok) continue;
            const arrayBuffer = await response.arrayBuffer();
            results.push({
                filename: att.filename,
                content: Buffer.from(arrayBuffer),
            });
        } catch (err) {
            console.error(`Failed to fetch attachment ${att.filename}:`, err);
        }
    }

    return results;
}
