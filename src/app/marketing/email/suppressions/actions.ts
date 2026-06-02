"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"
import {
    addSuppression,
    removeSuppression,
    type SuppressionReason,
} from "@/lib/email/suppressions"

async function ws() {
    const session = await requireAuth()
    return (session.user as { workspaceId: string }).workspaceId
}

const addSchema = z.object({
    email: z.string().email(),
    reason: z.enum(["bounce", "complaint", "unsubscribe", "manual"]).optional(),
    source: z.string().max(200).optional(),
})

export async function addSuppressionAction(input: z.infer<typeof addSchema>) {
    const workspaceId = await ws()
    const parsed = addSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid email" }
    try {
        await addSuppression({
            workspaceId,
            email: parsed.data.email,
            reason: (parsed.data.reason as SuppressionReason) ?? "manual",
            source: parsed.data.source ?? "added by user",
        })
        revalidatePath("/marketing/email/suppressions")
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed"
        return { success: false, error: message }
    }
}

const removeSchema = z.object({ email: z.string().email() })

export async function removeSuppressionAction(input: z.infer<typeof removeSchema>) {
    const workspaceId = await ws()
    const parsed = removeSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid email" }
    try {
        await removeSuppression(workspaceId, parsed.data.email)
        revalidatePath("/marketing/email/suppressions")
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed"
        return { success: false, error: message }
    }
}

const bulkAddSchema = z.object({
    emails: z.array(z.string()).min(1).max(2000),
    reason: z.enum(["bounce", "complaint", "unsubscribe", "manual"]).default("manual"),
    source: z.string().max(200).optional(),
})

export async function bulkAddSuppressionsAction(input: z.infer<typeof bulkAddSchema>) {
    const workspaceId = await ws()
    const parsed = bulkAddSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, added: 0, skipped: 0, error: parsed.error.issues[0].message }
    }

    const valid = parsed.data.emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@") && e.length <= 320)
    const unique = Array.from(new Set(valid))

    let added = 0
    let skipped = 0
    for (const email of unique) {
        try {
            await addSuppression({
                workspaceId,
                email,
                reason: (parsed.data.reason as SuppressionReason) ?? "manual",
                source: parsed.data.source ?? "bulk import",
            })
            added += 1
        } catch {
            skipped += 1
        }
    }
    revalidatePath("/marketing/email/suppressions")
    return {
        success: true,
        added,
        skipped: skipped + (parsed.data.emails.length - unique.length),
    }
}

const bulkRemoveSchema = z.object({
    emails: z.array(z.string().email()).min(1).max(2000),
})

export async function bulkRemoveSuppressionsAction(input: z.infer<typeof bulkRemoveSchema>) {
    const workspaceId = await ws()
    const parsed = bulkRemoveSchema.safeParse(input)
    if (!parsed.success) return { success: false, removed: 0, error: "Invalid input" }
    let removed = 0
    for (const email of parsed.data.emails) {
        try {
            await removeSuppression(workspaceId, email)
            removed += 1
        } catch {
            // ignore individual failures so the loop continues
        }
    }
    revalidatePath("/marketing/email/suppressions")
    return { success: true, removed }
}
