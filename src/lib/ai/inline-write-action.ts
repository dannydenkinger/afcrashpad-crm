"use server"

import { z } from "zod"
import { requireAuth } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { runAI, AIKeyMissingError } from "./run-ai"
import { requirePlan } from "@/lib/billing/plans-server"
import { track } from "@/lib/posthog/server"

const inputSchema = z.object({
    feature: z.enum(["inline_email_writer", "inline_sms_writer", "subject_line"]),
    /** What the user wants the AI to write. Free-form. */
    instruction: z.string().min(1).max(2000),
    /** Optional contact id to load + inject as context. */
    contactId: z.string().optional(),
    /** Existing draft (when refining/improving rather than writing from scratch). */
    existing: z.string().max(8000).optional(),
})

/**
 * Server action behind every inline "✨ Write with AI" button. Three modes
 * depending on `feature`:
 *
 *   inline_email_writer  → returns HTML email body
 *   inline_sms_writer    → returns plain text capped at 160 chars
 *   subject_line         → returns 3 newline-separated subject options
 *
 * The user types a short instruction ("follow up about the quote I sent
 * Tuesday"), we load contact context, and the AI returns a draft.
 * Routing (provider/model) honors the workspace's AI routing settings.
 */
export async function inlineWrite(input: {
    feature: "inline_email_writer" | "inline_sms_writer" | "subject_line"
    instruction: string
    contactId?: string
    existing?: string
}): Promise<{ success: boolean; text?: string; error?: string }> {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    if (!workspaceId) return { success: false, error: "No workspace" }

    // Free tier doesn't have Write-with-AI. The button is hidden in the
    // UI for free workspaces, but enforce server-side too.
    try {
        await requirePlan(workspaceId, "pro", "Write-with-AI")
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Pro plan required",
        }
    }

    let contactBlock = ""
    if (parsed.data.contactId) {
        try {
            const snap = await adminDb.collection("contacts").doc(parsed.data.contactId).get()
            if (snap.exists && snap.data()?.workspaceId === workspaceId) {
                const c = snap.data() || {}
                const lines: string[] = []
                if (c.name) lines.push(`Recipient name: ${c.name}`)
                if (c.email) lines.push(`Email: ${c.email}`)
                if (c.businessName) lines.push(`Business: ${c.businessName}`)
                if (c.status) lines.push(`Status: ${c.status}`)
                if (Array.isArray(c.tags) && c.tags.length > 0) {
                    lines.push(`Tags: ${c.tags.map((t: any) => t?.name).filter(Boolean).join(", ")}`)
                }
                contactBlock = lines.length > 0 ? `\n\nRecipient context:\n${lines.join("\n")}` : ""
            }
        } catch {
            // If the contact lookup fails, just continue without context
        }
    }

    // Build per-feature system prompt + user prompt
    let system: string
    let prompt: string
    let maxTokens = 600

    switch (parsed.data.feature) {
        case "inline_email_writer":
            system = `You write personal, conversational emails on behalf of a salesperson at a small business. Output rules:
- Output ONLY the email body as inline-styled HTML wrapped in <p> tags. No subject line. No preamble. No markdown fences.
- 2-4 short paragraphs max. Concrete, specific, conversational.
- The recipient's first name is already filled in by the system if relevant — don't add "Hi {{first_name}}" template syntax.
- If refining an existing draft, keep the user's voice and only change what they asked you to change.`
            prompt = parsed.data.existing
                ? `Refine the following email draft per these instructions:\n\nInstructions: ${parsed.data.instruction}${contactBlock}\n\nCurrent draft:\n${parsed.data.existing}\n\nReturn the improved HTML email body only.`
                : `Write an email body for the following instruction: ${parsed.data.instruction}${contactBlock}\n\nReturn the HTML email body only.`
            maxTokens = 800
            break

        case "inline_sms_writer":
            system = `You write friendly business SMS messages. Output rules:
- Output ONLY the SMS body — no quotes, no preamble, no explanation.
- Keep it under 160 characters total. Single message, no multi-part splits.
- Conversational, lowercase tone. No emojis unless explicitly asked.
- Do not include opt-out language ("Reply STOP to opt out") — the system appends compliance text separately.`
            prompt = parsed.data.existing
                ? `Refine this SMS draft per the instructions. Stay under 160 chars.\n\nInstructions: ${parsed.data.instruction}${contactBlock}\n\nCurrent draft: ${parsed.data.existing}`
                : `Write an SMS for: ${parsed.data.instruction}${contactBlock}\n\nUnder 160 chars. Plain text only.`
            maxTokens = 120
            break

        case "subject_line":
            system = `You generate email subject lines for a small-business sales context. Output rules:
- Return EXACTLY three subject-line options, one per line. No numbering. No quotes around them. No preamble.
- Each line under 60 characters. No emojis.
- Vary tone across the three: one direct, one curiosity-driven, one personal/specific.`
            prompt = `Generate three subject lines for an email about: ${parsed.data.instruction}${contactBlock}`
            maxTokens = 200
            break
    }

    try {
        const ai = await runAI({
            workspaceId,
            feature: parsed.data.feature,
            system,
            prompt,
            maxTokens,
            temperature: 0.7,
        })
        let text = ai.text.trim()
        // Strip leftover markdown fences if a model misbehaves
        if (parsed.data.feature === "inline_email_writer") {
            text = text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```\s*$/, "")
        }
        if (parsed.data.feature === "inline_sms_writer" && text.length > 160) {
            text = text.slice(0, 160)
        }

        track({
            distinctId: (session.user as { id?: string }).id || "",
            workspaceId,
            event: { name: "ai_write_used", props: { feature: parsed.data.feature } },
        }).catch(() => {})

        return { success: true, text }
    } catch (err) {
        if (err instanceof AIKeyMissingError) {
            return { success: false, error: "Add an AI provider key in Settings → Integrations." }
        }
        return { success: false, error: err instanceof Error ? err.message : "AI generation failed" }
    }
}
