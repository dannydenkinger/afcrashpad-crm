import { getValidGmailToken, getGmailIntegration } from "@/lib/gmail-integration"
import { randomUUID } from "crypto"

// ── Types ────────────────────────────────────────────────────────────────────

interface GmailTokens {
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
    email: string
}

export interface GmailMessage {
    id: string
    subject: string
    from: string
    date: string
    body: string
}

export interface GmailSendResult {
    gmailMessageId: string
    gmailThreadId: string
    emailMessageId: string // The Message-ID header for In-Reply-To matching
}

// ── MIME Construction ────────────────────────────────────────────────────────

function generateMessageId(domain: string): string {
    return `<${randomUUID()}@${domain}>`
}

function buildMimeMessage({
    from,
    to,
    subject,
    html,
    messageId,
    inReplyTo,
    references,
    attachments,
}: {
    from: string
    to: string
    subject: string
    html: string
    messageId: string
    inReplyTo?: string
    references?: string
    attachments?: { filename: string; content: Buffer; contentType?: string }[]
}): string {
    const boundary = `boundary_${randomUUID().replace(/-/g, "")}`
    const lines: string[] = []

    lines.push(`From: ${from}`)
    lines.push(`To: ${to}`)
    lines.push(`Subject: ${subject}`)
    lines.push(`Message-ID: ${messageId}`)
    if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`)
    if (references) lines.push(`References: ${references}`)
    lines.push(`MIME-Version: 1.0`)

    if (attachments?.length) {
        lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
        lines.push("")
        lines.push(`--${boundary}`)
        lines.push(`Content-Type: text/html; charset="UTF-8"`)
        lines.push(`Content-Transfer-Encoding: base64`)
        lines.push("")
        lines.push(Buffer.from(html, "utf-8").toString("base64"))

        for (const att of attachments) {
            lines.push(`--${boundary}`)
            lines.push(
                `Content-Type: ${att.contentType || "application/octet-stream"}; name="${att.filename}"`
            )
            lines.push(`Content-Disposition: attachment; filename="${att.filename}"`)
            lines.push(`Content-Transfer-Encoding: base64`)
            lines.push("")
            lines.push(att.content.toString("base64"))
        }

        lines.push(`--${boundary}--`)
    } else {
        lines.push(`Content-Type: text/html; charset="UTF-8"`)
        lines.push(`Content-Transfer-Encoding: base64`)
        lines.push("")
        lines.push(Buffer.from(html, "utf-8").toString("base64"))
    }

    return lines.join("\r\n")
}

function base64UrlEncode(str: string): string {
    return Buffer.from(str)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

// ── Send Email via Gmail API ─────────────────────────────────────────────────

export async function sendGmailEmail({
    workspaceId,
    userId,
    to,
    subject,
    html,
    inReplyTo,
    references,
    gmailThreadId,
    attachments,
}: {
    workspaceId: string
    userId: string
    to: string
    subject: string
    html: string
    inReplyTo?: string
    references?: string
    gmailThreadId?: string
    attachments?: { filename: string; content: Buffer; contentType?: string }[]
}): Promise<GmailSendResult> {
    const accessToken = await getValidGmailToken(workspaceId, userId)
    const integration = await getGmailIntegration(workspaceId, userId)
    if (!integration) throw new Error("Gmail integration not found")

    const fromEmail = integration.email
    const domain = fromEmail.split("@")[1] || "gmail.com"
    const messageId = generateMessageId(domain)

    const mimeMessage = buildMimeMessage({
        from: fromEmail,
        to,
        subject,
        html,
        messageId,
        inReplyTo,
        references,
        attachments,
    })

    const raw = base64UrlEncode(mimeMessage)

    const body: Record<string, string> = { raw }
    if (gmailThreadId) body.threadId = gmailThreadId

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`Gmail send error: ${res.status} ${err}`)
    }

    const data = await res.json()

    return {
        gmailMessageId: data.id,
        gmailThreadId: data.threadId,
        emailMessageId: messageId,
    }
}

// ── Fetch HARO Emails (existing functionality) ───────────────────────────────

export async function fetchHaroEmails(
    workspaceId: string,
    userId: string,
    opts?: { maxResults?: number; afterDate?: string }
): Promise<GmailMessage[]> {
    let accessToken = await getValidGmailToken(workspaceId, userId)
    const maxResults = opts?.maxResults || 5

    let query = "from:haro@helpareporter.com subject:HARO"
    if (opts?.afterDate) {
        query += ` after:${opts.afterDate}`
    }

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
    let listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    // If 401, force-refresh and retry once
    if (listRes.status === 401) {
        accessToken = await getValidGmailToken(workspaceId, userId)
        listRes = await fetch(listUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
    }

    if (!listRes.ok) {
        const err = await listRes.text()
        throw new Error(`Gmail API list error: ${listRes.status} ${err}`)
    }

    const listData = await listRes.json()
    if (!listData.messages || listData.messages.length === 0) return []

    const messages: GmailMessage[] = []
    for (const msg of listData.messages) {
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`
        const msgRes = await fetch(msgUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!msgRes.ok) continue
        const msgData = await msgRes.json()

        const headers = msgData.payload?.headers || []
        const subject = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || ""
        const from = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || ""
        const date = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || ""

        let body = ""
        const payload = msgData.payload

        if (payload?.body?.data) {
            body = base64UrlDecode(payload.body.data)
        } else if (payload?.parts) {
            const textPart = findPart(payload.parts, "text/plain")
            if (textPart?.body?.data) {
                body = base64UrlDecode(textPart.body.data)
            } else {
                const htmlPart = findPart(payload.parts, "text/html")
                if (htmlPart?.body?.data) {
                    body = stripHtml(base64UrlDecode(htmlPart.body.data))
                }
            }
        }

        messages.push({ id: msg.id, subject, from, date, body })
    }

    return messages
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function findPart(parts: any[], mimeType: string): any {
    for (const part of parts) {
        if (part.mimeType === mimeType) return part
        if (part.parts) {
            const found = findPart(part.parts, mimeType)
            if (found) return found
        }
    }
    return null
}

export function base64UrlDecode(data: string): string {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/")
    const bytes = Buffer.from(base64, "base64")
    return bytes.toString("utf-8")
}

export function stripHtml(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
}
