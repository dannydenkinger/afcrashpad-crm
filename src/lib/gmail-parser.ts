/**
 * Parse Gmail API message payloads into structured data.
 */

import { adminDb } from "@/lib/firebase-admin"
import { base64UrlDecode, findPart, stripHtml } from "@/lib/gmail"

export interface ParsedGmailMessage {
    gmailMessageId: string
    gmailThreadId: string
    subject: string
    from: string
    fromEmail: string
    to: string
    date: string
    body: string
    htmlBody?: string
    emailMessageId: string  // Message-ID header
    inReplyTo?: string
    references?: string
    attachments: { filename: string; mimeType: string; attachmentId: string }[]
}

/**
 * Parse a full Gmail API message response into structured fields.
 */
export function parseGmailMessage(gmailMessage: any): ParsedGmailMessage {
    const headers = gmailMessage.payload?.headers || []

    const getHeader = (name: string): string =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ""

    const subject = getHeader("Subject")
    const from = getHeader("From")
    const to = getHeader("To")
    const date = getHeader("Date")
    const emailMessageId = getHeader("Message-ID") || getHeader("Message-Id")
    const inReplyTo = getHeader("In-Reply-To") || undefined
    const references = getHeader("References") || undefined

    // Extract sender email from "Name <email>" format
    const emailMatch = from.match(/<([^>]+)>/)
    const fromEmail = emailMatch ? emailMatch[1] : from.trim()

    // Extract body
    let body = ""
    let htmlBody: string | undefined
    const payload = gmailMessage.payload

    if (payload?.body?.data) {
        const decoded = base64UrlDecode(payload.body.data)
        if (payload.mimeType === "text/html") {
            htmlBody = decoded
            body = stripHtml(decoded)
        } else {
            body = decoded
        }
    } else if (payload?.parts) {
        const textPart = findPart(payload.parts, "text/plain")
        if (textPart?.body?.data) {
            body = base64UrlDecode(textPart.body.data)
        }
        const htmlPart = findPart(payload.parts, "text/html")
        if (htmlPart?.body?.data) {
            htmlBody = base64UrlDecode(htmlPart.body.data)
            if (!body) body = stripHtml(htmlBody)
        }
    }

    // Extract attachments
    const attachments: ParsedGmailMessage["attachments"] = []
    function extractAttachments(parts: any[]) {
        for (const part of parts) {
            if (part.filename && part.body?.attachmentId) {
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType || "application/octet-stream",
                    attachmentId: part.body.attachmentId,
                })
            }
            if (part.parts) extractAttachments(part.parts)
        }
    }
    if (payload?.parts) extractAttachments(payload.parts)

    return {
        gmailMessageId: gmailMessage.id,
        gmailThreadId: gmailMessage.threadId,
        subject,
        from,
        fromEmail: fromEmail.toLowerCase(),
        to,
        date,
        body,
        htmlBody,
        emailMessageId,
        inReplyTo,
        references,
        attachments,
    }
}

/**
 * Match an email address to a contact in the workspace.
 */
export async function matchEmailToContact(
    workspaceId: string,
    email: string
): Promise<{ contactId: string; contactName: string } | null> {
    const normalizedEmail = email.toLowerCase().trim()
    const snap = await adminDb
        .collection("contacts")
        .where("workspaceId", "==", workspaceId)
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get()

    if (snap.empty) return null

    const doc = snap.docs[0]
    return {
        contactId: doc.id,
        contactName: doc.data().name || normalizedEmail,
    }
}

/**
 * Strip quoted reply content from email body.
 * Removes common patterns like "On ... wrote:" and "> " prefixed lines.
 */
export function stripQuotedReply(body: string): string {
    const lines = body.split("\n")
    const result: string[] = []

    for (const line of lines) {
        // Stop at "On ... wrote:" pattern
        if (/^On .+ wrote:$/i.test(line.trim())) break
        // Stop at "---------- Forwarded message ----------"
        if (/^-{5,}\s*Forwarded message/i.test(line.trim())) break
        // Stop at consecutive quoted lines
        if (line.trim().startsWith(">")) break
        result.push(line)
    }

    return result.join("\n").trim()
}
