"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { getAuthSession } from "@/lib/auth-guard"
import { sendEmail } from "@/lib/email"
import { rateLimit } from "@/lib/rate-limit"
import { captureError } from "@/lib/error-tracking"
import { track } from "@/lib/posthog/server"

const KINDS = ["bug", "idea", "other"] as const
export type FeedbackKind = (typeof KINDS)[number]

const feedbackSchema = z.object({
    kind: z.enum(KINDS).default("other"),
    message: z.string().min(10).max(5000),
    pageUrl: z.string().max(500).optional(),
    userAgent: z.string().max(500).optional(),
    viewport: z.string().max(50).optional(),
})

const KIND_LABEL: Record<FeedbackKind, string> = {
    bug: "Bug",
    idea: "Idea",
    other: "Feedback",
}

export async function submitFeedback(input: z.infer<typeof feedbackSchema>) {
    const parsed = feedbackSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    const session = await getAuthSession()
    if (!session?.user) {
        return { success: false, error: "Not signed in" }
    }

    const userId = (session.user as { id?: string }).id || ""
    const workspaceId = (session.user as { workspaceId?: string }).workspaceId || ""
    const userEmail = session.user.email || "unknown"
    const userName = session.user.name || ""

    const h = await headers()
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"
    const limit = rateLimit(`feedback:${userId || ip}`, 10)
    if (!limit.allowed) {
        return { success: false, error: "Too many submissions. Try again in a minute." }
    }

    let workspaceName = ""
    if (workspaceId) {
        try {
            const ws = await adminDb.collection("workspaces").doc(workspaceId).get()
            workspaceName = (ws.data()?.name as string) || ""
        } catch {
            // best-effort lookup
        }
    }

    const record = {
        kind: parsed.data.kind,
        userId,
        userEmail,
        userName,
        workspaceId,
        workspaceName,
        message: parsed.data.message,
        pageUrl: parsed.data.pageUrl || "",
        userAgent: parsed.data.userAgent || "",
        viewport: parsed.data.viewport || "",
        ip,
        createdAt: new Date(),
        status: "new" as const,
    }

    let docId: string | null = null
    try {
        const ref = await adminDb.collection("feedback").add(record)
        docId = ref.id
    } catch (err) {
        captureError(err, { scope: "feedback-write" })
        return { success: false, error: "Couldn't save the message. Please try again." }
    }

    // BUG_REPORT_EMAIL kept as the env var name so existing operator
    // config doesn't need to change. FEEDBACK_EMAIL also accepted.
    const to =
        process.env.FEEDBACK_EMAIL ||
        process.env.BUG_REPORT_EMAIL ||
        "growwithvesta@gmail.com"
    const label = KIND_LABEL[parsed.data.kind]
    const html = `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
            <h2 style="margin:0 0 12px 0;">New ${label.toLowerCase()}</h2>
            <p style="color:#666;margin:0 0 16px 0;font-size:13px;">ID: ${docId}</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:4px 8px;font-weight:600;width:120px;">Type</td><td style="padding:4px 8px;">${label}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:600;">User</td><td style="padding:4px 8px;">${userName ? `${escapeHtml(userName)} &lt;${escapeHtml(userEmail)}&gt;` : escapeHtml(userEmail)}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:600;">Workspace</td><td style="padding:4px 8px;">${escapeHtml(workspaceName || workspaceId || "(none)")}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:600;">Page</td><td style="padding:4px 8px;">${escapeHtml(parsed.data.pageUrl || "(unknown)")}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:600;">Viewport</td><td style="padding:4px 8px;">${escapeHtml(parsed.data.viewport || "")}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:600;vertical-align:top;">User agent</td><td style="padding:4px 8px;font-size:12px;color:#555;">${escapeHtml(parsed.data.userAgent || "")}</td></tr>
            </table>
            <h3 style="margin:20px 0 8px 0;">Message</h3>
            <div style="padding:12px;background:#f6f6f8;border-radius:6px;white-space:pre-wrap;font-size:14px;line-height:1.5;">${escapeHtml(parsed.data.message)}</div>
        </div>
    `
    try {
        await sendEmail({
            to,
            subject: `[Vesta ${label}] ${parsed.data.message.slice(0, 60).replace(/\s+/g, " ")}`,
            html,
        })
    } catch (err) {
        captureError(err, { scope: "feedback-email", docId })
    }

    track({
        distinctId: userId,
        workspaceId: workspaceId || undefined,
        event: { name: "feedback_submitted", props: { kind: parsed.data.kind } },
    }).catch(() => {})

    return { success: true }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}
