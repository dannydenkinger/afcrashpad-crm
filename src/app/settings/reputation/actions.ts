"use server"

import { z } from "zod"
import { tenantDb } from "@/lib/tenant-db"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"
import { sendEmail } from "@/lib/ses/sender"
import { revalidatePath } from "next/cache"

export interface ReputationSettings {
    googleReviewUrl?: string
    facebookReviewUrl?: string
    yelpReviewUrl?: string
    customReviewUrl?: string
    customReviewLabel?: string
    /** Subject + intro shown in the request email. Tokens: {{first_name}}, {{company}}. */
    emailSubject?: string
    emailIntro?: string
}

const settingsSchema = z.object({
    googleReviewUrl: z.string().url().optional().or(z.literal("")),
    facebookReviewUrl: z.string().url().optional().or(z.literal("")),
    yelpReviewUrl: z.string().url().optional().or(z.literal("")),
    customReviewUrl: z.string().url().optional().or(z.literal("")),
    customReviewLabel: z.string().max(60).optional(),
    emailSubject: z.string().max(160).optional(),
    emailIntro: z.string().max(2000).optional(),
})

const requestReviewSchema = z.object({
    contactId: z.string().min(1),
})

export async function getReputationSettings(): Promise<ReputationSettings | null> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)
    const doc = await db.settingsDoc("reputation").get()
    if (!doc.exists) return null
    return doc.data() as ReputationSettings
}

export async function updateReputationSettings(input: ReputationSettings) {
    const session = await requireAdmin()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const parsed = settingsSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const db = tenantDb(workspaceId)
    const data: Record<string, unknown> = {
        updatedAt: new Date(),
        workspaceId,
    }
    for (const [k, v] of Object.entries(parsed.data)) {
        if (v !== undefined && v !== "") data[k] = v
        else if (v === "") data[k] = null
    }
    await db.settingsDoc("reputation").set(data, { merge: true })
    revalidatePath("/settings/reputation")
    return { success: true }
}

/**
 * Sends a review-request email to a contact using the configured review URLs.
 * Renders a clean HTML email with a button per channel that has a URL set.
 * No-ops with an error if no review URLs are configured.
 */
export async function requestReview(input: { contactId: string }) {
    const parsed = requestReviewSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid input" }

    const session = await requireAuth()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    const db = tenantDb(workspaceId)

    const settings = (await getReputationSettings()) ?? {}
    const links: Array<{ label: string; url: string; color: string }> = []
    if (settings.googleReviewUrl) links.push({ label: "Leave a Google review", url: settings.googleReviewUrl, color: "#4285F4" })
    if (settings.facebookReviewUrl) links.push({ label: "Review on Facebook", url: settings.facebookReviewUrl, color: "#1877F2" })
    if (settings.yelpReviewUrl) links.push({ label: "Review on Yelp", url: settings.yelpReviewUrl, color: "#D32323" })
    if (settings.customReviewUrl) {
        links.push({
            label: settings.customReviewLabel?.trim() || "Leave a review",
            url: settings.customReviewUrl,
            color: "#10B981",
        })
    }

    if (links.length === 0) {
        return { success: false, error: "No review URLs configured. Add at least one in Settings → Reputation." }
    }

    const contactDoc = await db.doc("contacts", parsed.data.contactId).get()
    if (!contactDoc.exists) return { success: false, error: "Contact not found" }
    const contact = contactDoc.data() || {}
    const email = (contact.email as string | undefined) || ""
    if (!email) return { success: false, error: "Contact has no email address" }
    const firstName = (contact.name as string | undefined)?.split(" ")[0] || ""

    // Workspace name for the email signature
    const workspaceDoc = await db.doc("workspaces", workspaceId).get().catch(() => null)
    const company = (workspaceDoc?.data()?.name as string | undefined) || "us"

    const subject = (settings.emailSubject || "Quick favor — would you leave us a review?")
        .replace(/\{\{first_name\}\}/gi, firstName)
        .replace(/\{\{company\}\}/gi, company)

    const intro = (
        settings.emailIntro ||
        "Thanks again for working with us. If you have a minute, a quick review would mean a lot — it helps other people find us."
    )
        .replace(/\{\{first_name\}\}/gi, firstName)
        .replace(/\{\{company\}\}/gi, company)

    const buttonsHtml = links
        .map(
            (l) => `
            <a href="${l.url}" style="display:inline-block;margin:6px 4px;padding:11px 18px;background:${l.color};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
                ${l.label}
            </a>`,
        )
        .join("\n")

    const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;color:#0f172a;">
            <p style="font-size:16px;line-height:1.6;">${firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"}</p>
            <p style="font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
            <div style="margin:20px 0;">${buttonsHtml}</div>
            <p style="font-size:14px;color:#64748b;line-height:1.6;">— ${escapeHtml(company)}</p>
        </div>
    `

    try {
        await sendEmail({
            workspaceId,
            to: email,
            subject,
            html,
            contactId: parsed.data.contactId,
            campaignId: `review-request:${parsed.data.contactId}`,
            autoResolveContact: false,
        })

        // Drop a tiny activity record so it shows up on the timeline
        await db.add("activities", {
            contactId: parsed.data.contactId,
            type: "review_requested",
            subject: "Review request sent",
            body: `Sent review email to ${email}`,
            createdAt: new Date(),
        })

        return { success: true }
    } catch (err) {
        console.error("requestReview error:", err)
        return { success: false, error: err instanceof Error ? err.message : "Failed to send review request" }
    }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}
