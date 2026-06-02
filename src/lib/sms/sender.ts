/**
 * Twilio-backed SMS sender. Per-workspace credentials live on the workspace
 * doc under `twilio: { accountSid, authToken, fromNumber }`.
 *
 * Multi-tenant safety: there's deliberately NO env-var fallback. If env
 * fallback existed and the operator ever set TWILIO_ACCOUNT_SID, every
 * workspace without their own creds would silently send from the
 * operator's Twilio number — billing the operator and impersonating
 * them. Workspaces that haven't connected Twilio get a
 * TwilioNotConfiguredError, which the call site renders as a clear
 * "Connect Twilio in Settings" message.
 *
 * Each send writes to sms_logs with status + Twilio message SID. Replies
 * land at /api/webhooks/twilio (separate route, not configured here).
 */

import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import {
    buildContactContext,
    renderTokens,
    type TokenContact,
    type TokenWorkspace,
} from "@/lib/templating/tokens"

export interface SendSmsInput {
    workspaceId: string
    to: string
    body: string
    contactId?: string | null
    /** Set false for system messages that shouldn't render {{ }} tokens. */
    renderTokens?: boolean
}

export interface SendSmsResult {
    ok: boolean
    smsLogId: string
    messageSid?: string
    error?: string
}

export class TwilioNotConfiguredError extends Error {
    constructor(public workspaceId: string) {
        super("Twilio is not configured for this workspace")
        this.name = "TwilioNotConfiguredError"
    }
}

interface TwilioCreds {
    accountSid: string
    authToken: string
    fromNumber: string
}

async function loadCreds(workspaceId: string): Promise<TwilioCreds | null> {
    const wsDoc = await adminDb.collection("workspaces").doc(workspaceId).get()
    const wsData = wsDoc.data() ?? {}
    const ws = wsData.twilio as Partial<TwilioCreds> | undefined
    if (ws?.accountSid && ws?.authToken && ws?.fromNumber) {
        return ws as TwilioCreds
    }
    return null
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

async function writeSmsLog(
    id: string,
    data: {
        workspaceId: string
        to: string
        from: string
        body: string
        status: "sent" | "failed" | "delivered" | "undelivered"
        messageSid?: string
        contactId?: string | null
        errorMessage?: string
    },
) {
    await adminDb.collection("sms_logs").doc(id).set({
        workspaceId: data.workspaceId,
        to: data.to,
        from: data.from,
        body: data.body,
        status: data.status,
        messageSid: data.messageSid ?? null,
        contactId: data.contactId ?? null,
        errorMessage: data.errorMessage ?? null,
        sentAt: FieldValue.serverTimestamp(),
    })
}

function isE164(phone: string): boolean {
    return /^\+[1-9]\d{1,14}$/.test(phone)
}

/** Best-effort E.164 normalization. Defaults to +1 for US 10-digit numbers. */
function normalizePhone(phone: string): string {
    const trimmed = phone.trim().replace(/\s+/g, "").replace(/[()-]/g, "")
    if (isE164(trimmed)) return trimmed
    if (/^\d{10}$/.test(trimmed)) return "+1" + trimmed
    if (/^1\d{10}$/.test(trimmed)) return "+" + trimmed
    return trimmed
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    const { workspaceId, to } = input
    const renderToks = input.renderTokens ?? true

    if (!workspaceId) throw new Error("workspaceId required")
    if (!to) throw new Error("'to' phone required")
    if (!input.body) throw new Error("body required")

    const phone = normalizePhone(to)
    if (!isE164(phone)) {
        const ref = adminDb.collection("sms_logs").doc()
        await writeSmsLog(ref.id, {
            workspaceId,
            to: phone,
            from: "(unknown)",
            body: input.body,
            status: "failed",
            contactId: input.contactId,
            errorMessage: "Invalid phone number (must be E.164 like +14155551212)",
        })
        return { ok: false, smsLogId: ref.id, error: "invalid phone" }
    }

    const creds = await loadCreds(workspaceId)
    if (!creds) {
        const ref = adminDb.collection("sms_logs").doc()
        await writeSmsLog(ref.id, {
            workspaceId,
            to: phone,
            from: "(twilio not configured)",
            body: input.body,
            status: "failed",
            contactId: input.contactId,
            errorMessage:
                "Twilio not configured. Settings → Integrations → Twilio.",
        })
        throw new TwilioNotConfiguredError(workspaceId)
    }

    let body = input.body
    if (renderToks) {
        const [contact, workspace] = await Promise.all([
            input.contactId ? loadContact(input.contactId, workspaceId) : Promise.resolve(null),
            loadWorkspace(workspaceId),
        ])
        const ctx = buildContactContext(contact ?? { phone: phone }, workspace)
        body = renderTokens(body, ctx)
    }
    // SMS hard cap (single segment ≈ 160 chars; multi-segment up to ~1600).
    if (body.length > 1600) body = body.slice(0, 1600)

    const ref = adminDb.collection("sms_logs").doc()
    try {
        const twilioMod = (await import("twilio")).default
        const client = twilioMod(creds.accountSid, creds.authToken)
        const message = await client.messages.create({
            from: creds.fromNumber,
            to: phone,
            body,
        })
        await writeSmsLog(ref.id, {
            workspaceId,
            to: phone,
            from: creds.fromNumber,
            body,
            status: "sent",
            messageSid: message.sid,
            contactId: input.contactId,
        })
        return { ok: true, smsLogId: ref.id, messageSid: message.sid }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await writeSmsLog(ref.id, {
            workspaceId,
            to: phone,
            from: creds.fromNumber,
            body,
            status: "failed",
            contactId: input.contactId,
            errorMessage: message,
        })
        return { ok: false, smsLogId: ref.id, error: message }
    }
}
