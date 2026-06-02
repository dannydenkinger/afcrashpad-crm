"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"

const saveSchema = z.object({
    accountSid: z.string().regex(/^AC[a-f0-9]{32}$/, "Account SID must start with AC and be 34 chars"),
    /** Empty string keeps the existing token (UI shows ••• when one is stored). */
    authToken: z.string().min(0).max(200),
    fromNumber: z.string().regex(/^\+[1-9]\d{6,14}$/, "Must be E.164 format (e.g. +14155551212)"),
})

export async function saveTwilioCredsAction(
    input: z.infer<typeof saveSchema>,
) {
    const session = await requireAdmin()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const parsed = saveSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    try {
        const wsRef = adminDb.collection("workspaces").doc(workspaceId)
        const existing = (await wsRef.get()).data()?.twilio ?? {}

        const next: Record<string, unknown> = {
            ...existing,
            accountSid: parsed.data.accountSid,
            fromNumber: parsed.data.fromNumber,
        }
        // Only overwrite the auth token if the user typed a new one
        if (parsed.data.authToken.trim().length > 0) {
            next.authToken = parsed.data.authToken
        }
        if (!next.authToken) {
            return { success: false, error: "Auth token is required on first setup" }
        }

        await wsRef.update({ twilio: next, updatedAt: new Date() })
        revalidatePath("/settings/integrations/twilio")
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save"
        return { success: false, error: message }
    }
}

export async function disconnectTwilioAction() {
    const session = await requireAdmin()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId
    try {
        await adminDb.collection("workspaces").doc(workspaceId).update({
            twilio: null,
            updatedAt: new Date(),
        })
        revalidatePath("/settings/integrations/twilio")
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed"
        return { success: false, error: message }
    }
}
