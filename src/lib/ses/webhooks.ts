/**
 * Amazon SES event handling via SNS.
 *
 * Wire-up:
 *   1. Create an SNS topic in AWS.
 *   2. Subscribe this endpoint (HTTPS) to the topic. SNS will hit us first
 *      with a SubscriptionConfirmation — we auto-confirm by fetching the
 *      SubscribeURL from the payload. Works in dev and prod.
 *   3. Configure the SES Configuration Set (or the SES identity itself) to
 *      publish Bounce / Complaint / Delivery events to that topic.
 *
 * Security: every inbound SNS message is signature-verified with the AWS
 * `sns-validator` package before we touch our DB. Unsigned / tampered
 * messages are rejected with 401.
 */

import { adminDb } from "@/lib/firebase-admin"
import { logActivity } from "@/lib/activities/timeline"
import { addSuppression } from "@/lib/email/suppressions"
import type { EmailLogStatus } from "@/types"

// sns-validator has no TS types — narrow wrapper below.
type SnsValidatorCtor = new () => {
    validate: (
        message: Record<string, unknown>,
        cb: (err: Error | null, message?: Record<string, unknown>) => void,
    ) => void
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MessageValidator = require("sns-validator") as SnsValidatorCtor

export interface SnsEnvelope {
    Type: string
    MessageId: string
    TopicArn?: string
    Subject?: string
    Message: string
    Timestamp: string
    SignatureVersion: string
    Signature: string
    SigningCertURL: string
    SubscribeURL?: string
    UnsubscribeURL?: string
    Token?: string
}

export async function verifySnsMessage(body: Record<string, unknown>): Promise<SnsEnvelope> {
    const validator = new MessageValidator()
    return new Promise((resolve, reject) => {
        validator.validate(body, (err, validated) => {
            if (err) reject(err)
            else resolve(validated as unknown as SnsEnvelope)
        })
    })
}

/**
 * SNS may POST a SubscriptionConfirmation once when subscribing.
 * Auto-confirm by GETting the SubscribeURL.
 */
export async function confirmSubscription(subscribeUrl: string): Promise<void> {
    const res = await fetch(subscribeUrl)
    if (!res.ok) {
        throw new Error(`SNS subscription confirmation failed: ${res.status}`)
    }
}

interface SesBounceBody {
    notificationType?: "Bounce"
    eventType?: "Bounce"
    bounce: {
        bounceType: "Permanent" | "Transient" | "Undetermined"
        bounceSubType?: string
        bouncedRecipients: Array<{ emailAddress: string; diagnosticCode?: string }>
        timestamp?: string
    }
    mail: { messageId: string; destination: string[] }
}

interface SesComplaintBody {
    notificationType?: "Complaint"
    eventType?: "Complaint"
    complaint: {
        complainedRecipients: Array<{ emailAddress: string }>
        complaintFeedbackType?: string
        timestamp?: string
    }
    mail: { messageId: string; destination: string[] }
}

interface SesDeliveryBody {
    notificationType?: "Delivery"
    eventType?: "Delivery"
    delivery: {
        timestamp?: string
        recipients: string[]
        smtpResponse?: string
    }
    mail: { messageId: string; destination: string[] }
}

type SesEventBody = SesBounceBody | SesComplaintBody | SesDeliveryBody

function eventTypeOf(body: SesEventBody): string | null {
    const raw = (body as { eventType?: string }).eventType ||
        (body as { notificationType?: string }).notificationType
    return raw ?? null
}

async function findLogByMessageId(messageId: string) {
    const snap = await adminDb
        .collection("email_logs")
        .where("messageId", "==", messageId)
        .limit(1)
        .get()
    if (snap.empty) return null
    const doc = snap.docs[0]
    return { id: doc.id, data: doc.data() }
}

async function updateLog(
    id: string,
    status: EmailLogStatus,
    patch: Record<string, unknown>,
) {
    await adminDb
        .collection("email_logs")
        .doc(id)
        .update({ status, ...patch })
}

export async function handleSesEvent(body: SesEventBody): Promise<void> {
    const kind = eventTypeOf(body)
    if (!kind) return

    const mail = (body as { mail?: { messageId?: string } }).mail
    const messageId = mail?.messageId
    if (!messageId) return

    const log = await findLogByMessageId(messageId)
    if (!log) {
        console.warn(`[SES webhook] No email_log matches messageId ${messageId}`)
        return
    }

    const workspaceId = log.data.workspaceId as string | undefined
    const contactId = (log.data.contactId as string | null) ?? null

    switch (kind) {
        case "Bounce": {
            const bounce = (body as SesBounceBody).bounce
            const permanent = bounce.bounceType === "Permanent"
            const recipients = bounce.bouncedRecipients.map((r) => r.emailAddress).join(", ")
            await updateLog(log.id, "bounced", {
                bouncedAt: new Date(),
                errorMessage: `${bounce.bounceType} bounce (${bounce.bounceSubType ?? "General"}): ${recipients}`,
            })
            // Suppress permanent bounces only — transients (mailbox full,
            // greylisting) might recover. SES will eventually flip
            // hard-bouncing transients to Permanent if they keep failing.
            if (workspaceId && permanent) {
                await Promise.all(
                    bounce.bouncedRecipients.map((r) =>
                        addSuppression({
                            workspaceId,
                            email: r.emailAddress,
                            reason: "bounce",
                            source: bounce.bounceSubType ?? "Permanent",
                            sourceCampaignId: (log.data.campaignId as string | null) ?? undefined,
                            sourceMessageId: messageId,
                        }),
                    ),
                )
            }
            if (workspaceId) {
                await logActivity({
                    workspaceId,
                    type: "email_bounced",
                    source: "ses",
                    contactId,
                    subject: permanent ? "Email bounced (permanent)" : "Email bounced (transient)",
                    body: bounce.bouncedRecipients
                        .map((r) => `${r.emailAddress}${r.diagnosticCode ? ` — ${r.diagnosticCode}` : ""}`)
                        .join("\n"),
                    metadata: {
                        messageId,
                        bounceType: bounce.bounceType,
                        bounceSubType: bounce.bounceSubType,
                        suppressed: permanent,
                    },
                    sourceRef: log.id,
                })
            }
            return
        }
        case "Complaint": {
            const complaint = (body as SesComplaintBody).complaint
            await updateLog(log.id, "complained", {
                errorMessage: `Recipient complaint (${complaint.complaintFeedbackType ?? "unknown"})`,
            })
            // Always suppress complaints — they signal "this is spam to me"
            // and continuing to send risks SES throttling/banning the account.
            if (workspaceId) {
                await Promise.all(
                    complaint.complainedRecipients.map((r) =>
                        addSuppression({
                            workspaceId,
                            email: r.emailAddress,
                            reason: "complaint",
                            source: complaint.complaintFeedbackType ?? "abuse",
                            sourceCampaignId: (log.data.campaignId as string | null) ?? undefined,
                            sourceMessageId: messageId,
                        }),
                    ),
                )
            }
            if (workspaceId) {
                await logActivity({
                    workspaceId,
                    type: "email_bounced",
                    source: "ses",
                    contactId,
                    subject: "Recipient marked as spam",
                    body: complaint.complainedRecipients.map((r) => r.emailAddress).join(", "),
                    metadata: {
                        messageId,
                        complaintFeedbackType: complaint.complaintFeedbackType,
                        suppressed: true,
                    },
                    sourceRef: log.id,
                })
            }
            return
        }
        case "Delivery": {
            const delivery = (body as SesDeliveryBody).delivery
            await updateLog(log.id, "delivered", {
                deliveredAt: delivery.timestamp ? new Date(delivery.timestamp) : new Date(),
            })
            // No activity log for successful delivery — would spam timelines.
            return
        }
        default:
            // Open / Click require extra Configuration Set setup — handle later.
            return
    }
}
