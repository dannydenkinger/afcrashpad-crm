import { SendEmailCommand } from "@aws-sdk/client-sesv2"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import { getConfigurationSetName, getSesClient } from "@/lib/ses/client"
import { getIdentity } from "@/lib/ses/identities"
import { deduct, InsufficientCreditsError, refund } from "@/lib/credits/email-credits"
import { logActivity } from "@/lib/activities/timeline"
import {
    buildContactContext,
    renderTokens,
    renderTokensHtml,
    type TokenContact,
    type TokenWorkspace,
} from "@/lib/templating/tokens"
import { inlineCss } from "@/lib/email/inline-css"
import { injectOpenPixel, rewriteLinks } from "@/lib/email/tracking"
import { isSuppressed } from "@/lib/email/suppressions"
import { unsubscribeUrlFor } from "@/lib/email/unsubscribe"
import type { EmailLogStatus } from "@/types"

export interface SendEmailInput {
    workspaceId: string
    to: string
    subject: string
    html: string
    text?: string
    contactId?: string | null
    campaignId?: string | null
    replyTo?: string
    /**
     * When true and contactId is not provided, the sender will look up the
     * recipient email in the workspace's contacts and attach contactId
     * automatically. Defaults to true.
     */
    autoResolveContact?: boolean
    /**
     * If true (default), `{{first_name}}`, `{{name}}`, `{{email}}`, etc. in
     * the subject and body are replaced with the recipient contact's fields.
     * Set false to send raw (e.g. system emails that shouldn't template).
     */
    renderTokens?: boolean
}

async function resolveContactIdByEmail(
    workspaceId: string,
    email: string,
): Promise<string | null> {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return null
    const snap = await adminDb
        .collection("contacts")
        .where("workspaceId", "==", workspaceId)
        .where("email", "==", normalized)
        .limit(1)
        .get()
    return snap.empty ? null : snap.docs[0].id
}

async function loadContact(contactId: string, workspaceId: string): Promise<TokenContact | null> {
    const doc = await adminDb.collection("contacts").doc(contactId).get()
    if (!doc.exists) return null
    const data = doc.data() || {}
    if (data.workspaceId !== workspaceId) return null
    return {
        id: doc.id,
        name: (data.name as string) ?? null,
        firstName: (data.firstName as string) ?? null,
        lastName: (data.lastName as string) ?? null,
        email: (data.email as string) ?? null,
        phone: (data.phone as string) ?? null,
    }
}

async function loadWorkspace(workspaceId: string): Promise<TokenWorkspace | null> {
    const doc = await adminDb.collection("workspaces").doc(workspaceId).get()
    if (!doc.exists) return null
    const data = doc.data() || {}
    return { id: doc.id, name: (data.name as string) ?? null }
}

export interface SendEmailResult {
    ok: boolean
    emailLogId: string
    messageId?: string
    error?: string
    creditsDeducted: number
    balanceAfter: number
}

export class SesIdentityNotReadyError extends Error {
    constructor(public workspaceId: string, public status: string) {
        super(`SES identity is not verified (status: ${status})`)
        this.name = "SesIdentityNotReadyError"
    }
}

function buildFrom(address: string, name?: string | null): string {
    if (!name) return address
    const cleanName = name.replace(/"/g, "'")
    return `"${cleanName}" <${address}>`
}

async function writeEmailLog(
    id: string,
    data: {
        workspaceId: string
        to: string
        fromAddress: string
        subject: string
        status: EmailLogStatus
        messageId?: string
        contactId?: string | null
        campaignId?: string | null
        errorMessage?: string
    },
) {
    await adminDb.collection("email_logs").doc(id).set({
        workspaceId: data.workspaceId,
        to: data.to,
        fromAddress: data.fromAddress,
        subject: data.subject,
        status: data.status,
        messageId: data.messageId ?? null,
        contactId: data.contactId ?? null,
        campaignId: data.campaignId ?? null,
        errorMessage: data.errorMessage ?? null,
        sentAt: FieldValue.serverTimestamp(),
    })
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const { workspaceId, to, campaignId, replyTo } = input
    const autoResolveContact = input.autoResolveContact ?? true
    const shouldRenderTokens = input.renderTokens ?? true

    if (!workspaceId) throw new Error("workspaceId required")
    if (!to || !to.includes("@")) throw new Error("valid 'to' address required")
    if (!input.subject) throw new Error("subject required")
    if (!input.html) throw new Error("html body required")

    // Suppression check: short-circuit before any SES/credit work. Prevents
    // re-sending to addresses that bounced, complained, or unsubscribed.
    if (await isSuppressed(workspaceId, to)) {
        const emailLogRef = adminDb.collection("email_logs").doc()
        await writeEmailLog(emailLogRef.id, {
            workspaceId,
            to,
            fromAddress: "(suppressed)",
            subject: input.subject,
            status: "failed",
            contactId: input.contactId ?? null,
            campaignId,
            errorMessage: "Recipient is on the workspace suppression list",
        })
        return {
            ok: false,
            emailLogId: emailLogRef.id,
            error: "suppressed",
            creditsDeducted: 0,
            balanceAfter: 0,
        }
    }

    let contactId = input.contactId ?? null
    if (!contactId && autoResolveContact) {
        contactId = await resolveContactIdByEmail(workspaceId, to)
    }

    // Render personalization tokens against the resolved contact (if any)
    // and workspace. Safe to call on plain HTML; no-ops when no tokens.
    let subject = input.subject
    let html = input.html
    let text = input.text
    if (shouldRenderTokens) {
        const [contact, workspace] = await Promise.all([
            contactId ? loadContact(contactId, workspaceId) : Promise.resolve(null),
            loadWorkspace(workspaceId),
        ])
        const ctx = buildContactContext(contact ?? { email: to }, workspace)
        // Inject {{unsubscribe_url}} so templates can include a real one-click
        // link. The token is HMAC-signed and unique per (workspace, recipient).
        const unsubUrl = unsubscribeUrlFor(workspaceId, to, campaignId ?? undefined)
        const ctxWithUnsub = {
            ...ctx,
            unsubscribe_url: unsubUrl,
            unsubscribeUrl: unsubUrl,
        } as typeof ctx & { unsubscribe_url: string; unsubscribeUrl: string }
        subject = renderTokens(subject, ctxWithUnsub)
        html = renderTokensHtml(html, ctxWithUnsub)
        text = text ? renderTokens(text, ctxWithUnsub) : text

        // Surface "Hi ," style empty-token sends. Cheap to detect, expensive
        // to ship: a missing first_name in the subject means the recipient
        // sees a salutation that's obviously template-generated.
        const looksBroken = /\b(hi|hey|hello|dear)\s*[,!.\s]/i.test(subject) && !/\b(hi|hey|hello|dear)\s+\w/i.test(subject)
        if (looksBroken) {
            console.warn(
                `[sendEmail] subject "${subject}" looks like an unfilled token. ` +
                `Contact ${contactId || to} may be missing first_name.`,
            )
        }
    }

    const identity = await getIdentity(workspaceId)
    if (!identity) throw new SesIdentityNotReadyError(workspaceId, "NOT_CONFIGURED")
    if (identity.status !== "VERIFIED") {
        throw new SesIdentityNotReadyError(workspaceId, identity.status)
    }
    if (!identity.fromAddress) {
        throw new Error("SES identity has no fromAddress configured")
    }

    const emailLogRef = adminDb.collection("email_logs").doc()
    const emailLogId = emailLogRef.id

    // Click tracking: rewrite anchor hrefs through our tracker (no-ops without
    // NEXT_PUBLIC_APP_URL + TRACKING_SECRET).
    html = rewriteLinks({ html, emailLogId })
    // Open tracking: inject 1×1 pixel just before </body>.
    html = injectOpenPixel({ html, emailLogId })
    // Inline CSS so the email renders correctly in Gmail/Outlook/etc.
    html = inlineCss(html)

    let balanceAfter = 0
    try {
        balanceAfter = await deduct(workspaceId, 1, emailLogId, "email send")
    } catch (err) {
        if (err instanceof InsufficientCreditsError) {
            await writeEmailLog(emailLogId, {
                workspaceId,
                to,
                fromAddress: identity.fromAddress,
                subject,
                status: "failed",
                contactId,
                campaignId,
                errorMessage: err.message,
            })
        }
        throw err
    }

    const fromHeader = buildFrom(identity.fromAddress, identity.fromName)
    const client = getSesClient()
    const configurationSetName = getConfigurationSetName()

    try {
        const result = await client.send(
            new SendEmailCommand({
                FromEmailAddress: fromHeader,
                Destination: { ToAddresses: [to] },
                ReplyToAddresses: replyTo ? [replyTo] : undefined,
                ConfigurationSetName: configurationSetName,
                Content: {
                    Simple: {
                        Subject: { Data: subject, Charset: "UTF-8" },
                        Body: {
                            Html: { Data: html, Charset: "UTF-8" },
                            Text: text ? { Data: text, Charset: "UTF-8" } : undefined,
                        },
                    },
                },
            }),
        )

        const messageId = result.MessageId
        await writeEmailLog(emailLogId, {
            workspaceId,
            to,
            fromAddress: identity.fromAddress,
            subject,
            status: "sent",
            messageId,
            contactId,
            campaignId,
        })

        if (contactId) {
            await logActivity({
                workspaceId,
                type: "email_sent",
                source: "ses",
                contactId,
                subject: `Email sent: ${subject}`,
                body: text ?? undefined,
                metadata: { to, messageId, campaignId: campaignId ?? null },
                sourceRef: emailLogId,
            })
        }

        return { ok: true, emailLogId, messageId, creditsDeducted: 1, balanceAfter }
    } catch (err) {
        const refundedBalance = await refund(workspaceId, 1, emailLogId, "SES send failed")
        const errorMessage = err instanceof Error ? err.message : String(err)
        await writeEmailLog(emailLogId, {
            workspaceId,
            to,
            fromAddress: identity.fromAddress,
            subject,
            status: "failed",
            contactId,
            campaignId,
            errorMessage,
        })
        return {
            ok: false,
            emailLogId,
            error: errorMessage,
            creditsDeducted: 0,
            balanceAfter: refundedBalance,
        }
    }
}
