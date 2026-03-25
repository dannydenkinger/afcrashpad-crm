import { Resend } from "resend";
import { createTrackedEmail, updateTrackingEmailId } from "@/lib/email-tracking";

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
    const from = process.env.RESEND_FROM_EMAIL || "AFCrashpad CRM <support@afcrashpad.com>";

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
    attachments,
    replyTo,
}: {
    to: string;
    subject: string;
    html: string;
    contactId: string;
    attachments?: { filename: string; content?: Buffer; path?: string; contentType?: string }[];
    replyTo?: string;
}): Promise<{ data: any; trackingId: string }> {
    const { trackingId, trackedHtml } = await createTrackedEmail({
        contactId,
        recipientEmail: to,
        subject,
        html,
    });

    const from = process.env.RESEND_FROM_EMAIL || "AFCrashpad CRM <support@afcrashpad.com>";

    // Auto-generate a reply-to address that routes through Postmark inbound
    // so replies are captured and threaded back to the conversation.
    const inboundDomain = process.env.POSTMARK_INBOUND_DOMAIN;
    const effectiveReplyTo = replyTo || (inboundDomain ? `reply@${inboundDomain}` : undefined);

    const { data, error } = await getResend().emails.send({
        from,
        to,
        subject,
        html: trackedHtml,
        ...(attachments?.length && { attachments }),
        ...(effectiveReplyTo && { replyTo: effectiveReplyTo }),
    });

    if (error) {
        console.error("Resend email error:", error);
        throw new Error(error.message || "Failed to send email");
    }

    // Store the Resend email ID in the tracking record
    if (data?.id) {
        updateTrackingEmailId(trackingId, data.id).catch(() => {});
    }

    return { data, trackingId };
}
