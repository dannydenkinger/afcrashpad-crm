"use server"

import { z } from "zod"
import { removeSuppression } from "@/lib/email/suppressions"
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe"

const resubSchema = z.object({
    token: z.string().min(1),
})

/**
 * Re-subscribe action invoked from the unsub confirmation page. Verifies
 * the same HMAC token used to unsubscribe, then deletes the suppression.
 */
export async function resubscribeAction(input: z.infer<typeof resubSchema>) {
    const parsed = resubSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid request" }
    const verified = verifyUnsubscribeToken(parsed.data.token)
    if (!verified) return { success: false, error: "Invalid or tampered token" }
    try {
        await removeSuppression(verified.workspaceId, verified.email)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed"
        return { success: false, error: message }
    }
}
