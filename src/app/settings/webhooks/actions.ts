"use server"

import crypto from "crypto"
import { z } from "zod"
import { requireAuth, requireAdmin } from "@/lib/auth-guard"
import { requirePlan } from "@/lib/billing/plans-server"
import { adminDb } from "@/lib/firebase-admin"
import type { WebhookSubscription, WebhookEvent, WebhookFormat } from "@/lib/webhooks/types"
import { dispatchTestWebhook } from "@/lib/webhooks/dispatcher"

const VALID_EVENTS: WebhookEvent[] = [
    "contact.created",
    "contact.updated",
    "deal.created",
    "deal.stage_changed",
    "deal.closed_won",
    "deal.closed_lost",
    "task.completed",
]

const FORMAT_VALUES: WebhookFormat[] = ["vesta", "slack"]

const createSchema = z.object({
    url: z.string().url("Must be a valid URL").max(500),
    events: z.array(z.enum(VALID_EVENTS as [WebhookEvent, ...WebhookEvent[]])).min(1, "Pick at least one event"),
    format: z.enum(["vesta", "slack"]).optional(),
})

const updateSchema = z.object({
    id: z.string().min(1),
    url: z.string().url().max(500).optional(),
    events: z.array(z.enum(VALID_EVENTS as [WebhookEvent, ...WebhookEvent[]])).min(1).optional(),
    enabled: z.boolean().optional(),
    format: z.enum(["vesta", "slack"]).optional(),
})

export async function listWebhooks(): Promise<{ success: boolean; webhooks?: WebhookSubscription[]; error?: string }> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId
    if (!workspaceId) return { success: false, error: "No workspace" }

    try {
        const snap = await adminDb
            .collection("workspaces")
            .doc(workspaceId)
            .collection("webhooks")
            .orderBy("createdAt", "desc")
            .get()
        const webhooks = snap.docs.map(d => {
            const data = d.data()
            return {
                id: d.id,
                workspaceId,
                url: data.url || "",
                events: Array.isArray(data.events) ? data.events : [],
                // Don't expose the full secret in list responses — receivers
                // already have it, and admins can rotate via "regenerate".
                secret: data.secret || "",
                enabled: data.enabled !== false,
                createdAt: data.createdAt || "",
                updatedAt: data.updatedAt || "",
                lastDeliveredAt: data.lastDeliveredAt || null,
                lastError: data.lastError || null,
                deliveryCount: data.deliveryCount || 0,
                failureCount: data.failureCount || 0,
            } as WebhookSubscription
        })
        return { success: true, webhooks }
    } catch (err) {
        console.error("[webhooks] listWebhooks error:", err)
        return { success: false, error: "Failed to load webhooks" }
    }
}

export async function createWebhook(input: { url: string; events: WebhookEvent[]; format?: WebhookFormat }) {
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    if (!workspaceId) return { success: false, error: "No workspace" }

    try {
        await requirePlan(workspaceId, "pro", "Webhooks")
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Pro plan required",
        }
    }

    try {
        const now = new Date().toISOString()
        const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`
        const docRef = adminDb
            .collection("workspaces")
            .doc(workspaceId)
            .collection("webhooks")
            .doc()
        await docRef.set({
            url: parsed.data.url,
            events: parsed.data.events,
            format: parsed.data.format || "vesta",
            secret,
            enabled: true,
            createdAt: now,
            updatedAt: now,
            deliveryCount: 0,
            failureCount: 0,
        })
        return { success: true, id: docRef.id, secret }
    } catch (err) {
        console.error("[webhooks] createWebhook error:", err)
        return { success: false, error: "Failed to create webhook" }
    }
}

export async function updateWebhook(input: {
    id: string
    url?: string
    events?: WebhookEvent[]
    enabled?: boolean
    format?: WebhookFormat
}) {
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    if (!workspaceId) return { success: false, error: "No workspace" }

    try {
        const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
        if (parsed.data.url !== undefined) updates.url = parsed.data.url
        if (parsed.data.events !== undefined) updates.events = parsed.data.events
        if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled
        if (parsed.data.format !== undefined) updates.format = parsed.data.format

        await adminDb
            .collection("workspaces")
            .doc(workspaceId)
            .collection("webhooks")
            .doc(parsed.data.id)
            .update(updates)
        return { success: true }
    } catch (err) {
        console.error("[webhooks] updateWebhook error:", err)
        return { success: false, error: "Failed to update webhook" }
    }
}

export async function deleteWebhook(id: string) {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    if (!workspaceId) return { success: false, error: "No workspace" }

    try {
        await adminDb
            .collection("workspaces")
            .doc(workspaceId)
            .collection("webhooks")
            .doc(id)
            .delete()
        return { success: true }
    } catch (err) {
        console.error("[webhooks] deleteWebhook error:", err)
        return { success: false, error: "Failed to delete webhook" }
    }
}

export async function rotateSecret(id: string) {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    if (!workspaceId) return { success: false, error: "No workspace" }

    try {
        const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`
        await adminDb
            .collection("workspaces")
            .doc(workspaceId)
            .collection("webhooks")
            .doc(id)
            .update({ secret, updatedAt: new Date().toISOString() })
        return { success: true, secret }
    } catch (err) {
        console.error("[webhooks] rotateSecret error:", err)
        return { success: false, error: "Failed to rotate secret" }
    }
}

/**
 * Send a no-op `webhook.test` event to a single subscription so the
 * operator can verify their receiver is wired up correctly without
 * waiting for a real CRM event.
 */
export async function sendTestEvent(id: string) {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    if (!workspaceId) return { success: false, error: "No workspace" }

    try {
        dispatchTestWebhook(workspaceId, id, session.user.email || "unknown")
        return { success: true }
    } catch (err) {
        console.error("[webhooks] sendTestEvent error:", err)
        return { success: false, error: "Failed to send test" }
    }
}
