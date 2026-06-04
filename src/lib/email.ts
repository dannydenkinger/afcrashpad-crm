import { Resend } from "resend";
import { createTrackedEmail, updateTrackingEmailId } from "@/lib/email-tracking";
import { getGmailIntegration } from "@/lib/gmail-integration";
import { sendGmailEmail } from "@/lib/gmail";
import { isSuppressed } from "@/lib/email/suppressions";

export class EmailSuppressedError extends Error {
    constructor(email: string) {
        super(`Recipient ${email} is on the workspace suppression list`);
        this.name = "EmailSuppressedError";
    }
}

let resend: Resend | null = null;

function getResend() {
    if (!resend) {
        const key = process.env.RESEND_API_KEY;
        if (!key) throw new Error("RESEND_API_KEY is not set");
        resend = new Resend(key);
    }
    return resend;
}

/**
 * Send an email via Resend (without tracking).
 * Use sendTrackedEmail() when you have a contactId and want open/click tracking.
 */
export async function sendEmail({
    to,
    subject,
    html,
}: {
    to: string;
    subject: string;
    html: string;
}) {
    const from = process.env.RESEND_FROM_EMAIL || "AFCrashpad <noreply@afcrashpad.com>";

    const { data, error } = await getResend().emails.send({
        from,
        to,
        subject,
        html,
    });

    if (error) {
        console.error("Resend email error:", error);
        throw new Error(error.message || "Failed to send email");
    }

    return data;
}

/**
 * Send an email with open and click tracking.
 * Injects a tracking pixel and wraps links for click tracking.
 * Returns the trackingId for reference.
 */
export async function sendTrackedEmail({
    to,
    subject,
    html,
    contactId,
    workspaceId,
    attachments,
}: {
    to: string;
    subject: string;
    html: string;
    contactId: string;
    workspaceId: string;
    attachments?: { filename: string; content: Buffer }[];
}): Promise<{ data: any; trackingId: string }> {
    const { trackingId, trackedHtml } = await createTrackedEmail(workspaceId, {
        contactId,
        recipientEmail: to,
        subject,
        html,
    });

    const from = process.env.RESEND_FROM_EMAIL || "AFCrashpad <noreply@afcrashpad.com>";

    const { data, error } = await getResend().emails.send({
        from,
        to,
        subject,
        html: trackedHtml,
        ...(attachments?.length && { attachments }),
    });

    if (error) {
        console.error("Resend email error:", error);
        throw new Error(error.message || "Failed to send email");
    }

    // Store the Resend email ID in the tracking record
    if (data?.id) {
        updateTrackingEmailId(workspaceId, trackingId, data.id).catch(() => {});
    }

    return { data, trackingId };
}

/**
 * Unified email send — uses Gmail API if the user has a Gmail integration,
 * otherwise falls back to Resend. Both paths inject open/click tracking.
 */
export async function sendEmailUnified({
    to,
    subject,
    html,
    contactId,
    workspaceId,
    userId,
    inReplyTo,
    references,
    gmailThreadId,
    attachments,
}: {
    to: string;
    subject: string;
    html: string;
    contactId: string;
    workspaceId: string;
    userId: string;
    inReplyTo?: string;
    references?: string;
    gmailThreadId?: string;
    attachments?: { filename: string; url: string; contentType?: string }[];
}): Promise<{
    trackingId: string;
    gmailMessageId?: string;
    gmailThreadId?: string;
    emailMessageId?: string;
}> {
    if (await isSuppressed(workspaceId, to)) {
        throw new EmailSuppressedError(to);
    }

    const gmailIntegration = await getGmailIntegration(workspaceId, userId);

    // Create tracking record with instrumented HTML
    const { trackingId, trackedHtml } = await createTrackedEmail(workspaceId, {
        contactId,
        recipientEmail: to,
        subject,
        html,
    });

    if (gmailIntegration?.refreshToken) {
        // Send via Gmail API
        // Convert URL-based attachments to Buffers for Gmail MIME
        let gmailAttachments: { filename: string; content: Buffer; contentType?: string }[] | undefined;
        if (attachments?.length) {
            gmailAttachments = await Promise.all(
                attachments.map(async (att) => {
                    const res = await fetch(att.url);
                    const buffer = Buffer.from(await res.arrayBuffer());
                    return { filename: att.filename, content: buffer, contentType: att.contentType };
                })
            );
        }

        const result = await sendGmailEmail({
            workspaceId,
            userId,
            to,
            subject,
            html: trackedHtml,
            inReplyTo,
            references,
            gmailThreadId,
            attachments: gmailAttachments,
        });

        return {
            trackingId,
            gmailMessageId: result.gmailMessageId,
            gmailThreadId: result.gmailThreadId,
            emailMessageId: result.emailMessageId,
        };
    } else {
        // Fallback to Resend
        let resendAttachments: { filename: string; content: Buffer }[] | undefined;
        if (attachments?.length) {
            resendAttachments = await Promise.all(
                attachments.map(async (att) => {
                    const res = await fetch(att.url);
                    const buffer = Buffer.from(await res.arrayBuffer());
                    return { filename: att.filename, content: buffer };
                })
            );
        }

        const { data } = await sendTrackedEmail({
            to,
            subject,
            html,
            contactId,
            workspaceId,
            attachments: resendAttachments,
        });

        return { trackingId };
    }
}
