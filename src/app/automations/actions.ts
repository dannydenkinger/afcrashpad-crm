"use server"

import crypto from "node:crypto"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import {
    createAutomation,
    deleteAutomation,
    getAutomation,
    startRun,
    updateAutomation,
} from "@/lib/automations/store"
import { advanceRun } from "@/lib/automations/engine"
import { getStarter } from "@/lib/automations/starters"
import { requirePlan } from "@/lib/billing/plans-server"
import { trackFirstForWorkspace } from "@/lib/posthog/firsts"
import { track } from "@/lib/posthog/server"
import type {
    Automation,
    AutomationNode,
    Trigger,
    TriggerType,
} from "@/lib/automations/types"

/** Mint the public webhook-in token for an automation (HMAC-signed). */
function mintWebhookToken(workspaceId: string, automationId: string): string {
    const envSecret = process.env.TRACKING_SECRET
    if (!envSecret && process.env.NODE_ENV === "production") {
        throw new Error("TRACKING_SECRET must be set in production")
    }
    const secret = envSecret || "vesta-dev-fallback-secret-do-not-use-in-prod"
    const payload = `${workspaceId}.${automationId}`
    const encoded = Buffer.from(payload)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    const sig = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
        .slice(0, 32)
    return `${encoded}.${sig}`
}

async function ws() {
    const session = await requireAuth()
    const u = session.user as { id: string; workspaceId: string }
    return { workspaceId: u.workspaceId, userId: u.id }
}

const TRIGGER_TYPES: TriggerType[] = [
    "contact_created",
    "contact_added_to_list",
    "tag_added",
    "tag_removed",
    "form_submitted",
    "pipeline_stage_entered",
    "opportunity_created",
    "opportunity_won",
    "opportunity_lost",
    "opportunity_value_changed",
    "opportunity_stale",
    "email_opened",
    "email_clicked",
    "contact_field_updated",
    "sms_replied",
    "appointment_booked",
    "birthday",
    "anniversary",
    "webhook_in",
    "manual",
]

const triggerSchema = z.object({
    type: z.enum(TRIGGER_TYPES as [TriggerType, ...TriggerType[]]),
    config: z
        .object({
            listId: z.string().optional(),
            tagId: z.string().optional(),
            formId: z.string().optional(),
            stageId: z.string().optional(),
            campaignId: z.string().optional(),
        })
        .default({}),
})

// Loose node schema — actual shape varies by type. We trust the UI to send
// a valid node and let the engine ignore unknown fields.
const nodeSchema = z
    .object({
        id: z.string().min(1),
        type: z.enum([
            "send_email",
            "ai_send_email",
            "send_sms",
            "wait",
            "wait_until",
            "wait_until_business_hours",
            "add_tag",
            "remove_tag",
            "add_to_list",
            "remove_from_list",
            "branch_if",
            "stop_if",
            "update_contact_field",
            "increment_field",
            "assign_user",
            "create_task",
            "send_internal_email",
            "update_opportunity",
            "move_opportunity_to_stage",
            "webhook",
            "end",
        ]),
    })
    .passthrough()

const goalSchema = z
    .object({
        type: z.enum(TRIGGER_TYPES as [TriggerType, ...TriggerType[]]),
        config: z
            .object({
                listId: z.string().optional(),
                tagId: z.string().optional(),
                formId: z.string().optional(),
                stageId: z.string().optional(),
                campaignId: z.string().optional(),
                pipelineId: z.string().optional(),
                fieldPath: z.string().optional(),
                staleDays: z.number().int().positive().max(365).optional(),
            })
            .default({}),
    })
    .nullable()
    .optional()

const createSchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    enabled: z.boolean().optional(),
    trigger: triggerSchema,
    nodes: z.array(nodeSchema).optional(),
    allowReEnroll: z.boolean().optional(),
    goal: goalSchema,
})

export async function createAutomationAction(
    input: z.infer<typeof createSchema>,
) {
    const { workspaceId, userId } = await ws()
    try {
        await requirePlan(workspaceId, "pro", "Automations")
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Plan required",
        }
    }
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }
    try {
        const created = await createAutomation({
            workspaceId,
            name: parsed.data.name,
            description: parsed.data.description,
            enabled: parsed.data.enabled ?? false,
            trigger: parsed.data.trigger as Trigger,
            nodes: (parsed.data.nodes ?? []) as AutomationNode[],
            allowReEnroll: parsed.data.allowReEnroll,
            goal: (parsed.data.goal ?? undefined) as Automation["goal"],
            createdBy: userId,
        })

        // Mint a webhook token for any trigger that's webhook-driven
        if (
            parsed.data.trigger.type === "webhook_in" ||
            parsed.data.trigger.type === "appointment_booked"
        ) {
            const token = mintWebhookToken(workspaceId, created.id)
            await updateAutomation(workspaceId, created.id, {
                webhookToken: token,
            })
            created.webhookToken = token
        }

        trackFirstForWorkspace({
            workspaceId,
            userId,
            key: "automationCreatedAt",
            event: { name: "first_automation_created" },
        }).catch(() => {})

        revalidatePath("/automations")
        return { success: true, automation: created }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create"
        return { success: false, error: message }
    }
}

const updateSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    trigger: triggerSchema.optional(),
    nodes: z.array(nodeSchema).optional(),
    allowReEnroll: z.boolean().optional(),
    goal: goalSchema,
})

export async function updateAutomationAction(
    input: z.infer<typeof updateSchema>,
) {
    const { workspaceId, userId } = await ws()
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }
    try {
        // Mint webhook token if switching trigger to webhook_in or
        // appointment_booked and we don't have one yet
        let webhookToken: string | undefined = undefined
        const wasEnabled = await getAutomation(workspaceId, parsed.data.id).then(
            (a) => a?.enabled ?? false,
        )
        if (
            parsed.data.trigger?.type === "webhook_in" ||
            parsed.data.trigger?.type === "appointment_booked"
        ) {
            const existing = await getAutomation(workspaceId, parsed.data.id)
            if (existing && !existing.webhookToken) {
                webhookToken = mintWebhookToken(workspaceId, parsed.data.id)
            }
        }

        const updated = await updateAutomation(workspaceId, parsed.data.id, {
            name: parsed.data.name,
            description: parsed.data.description,
            enabled: parsed.data.enabled,
            trigger: parsed.data.trigger as Trigger | undefined,
            nodes: parsed.data.nodes as AutomationNode[] | undefined,
            allowReEnroll: parsed.data.allowReEnroll,
            goal: parsed.data.goal === undefined ? undefined : (parsed.data.goal as Automation["goal"] | null),
            webhookToken,
        })

        if (!wasEnabled && updated.enabled) {
            track({
                distinctId: userId,
                workspaceId,
                event: { name: "automation_published" },
            }).catch(() => {})
        }

        revalidatePath("/automations")
        revalidatePath(`/automations/${updated.id}`)
        return { success: true, automation: updated }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update"
        return { success: false, error: message }
    }
}

export async function toggleAutomationAction(input: {
    id: string
    enabled: boolean
}) {
    return updateAutomationAction({ id: input.id, enabled: input.enabled })
}

export async function deleteAutomationAction(id: string) {
    const { workspaceId } = await ws()
    try {
        await deleteAutomation(workspaceId, id)
        revalidatePath("/automations")
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete"
        return { success: false, error: message }
    }
}

let _starterIdCounter = 1
function newStarterId(): string {
    return `n${Date.now().toString(36)}${(_starterIdCounter++).toString(36)}`
}

/**
 * Fork a starter template into a new (paused) automation in this workspace.
 * Users edit it from there. Always created `enabled: false` so they can't
 * accidentally fire half-configured drips.
 */
export async function forkStarterAction(slug: string) {
    const { workspaceId, userId } = await ws()
    try {
        await requirePlan(workspaceId, "pro", "Automations")
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Plan required",
        }
    }
    const starter = getStarter(slug)
    if (!starter) return { success: false, error: "Starter not found" }
    try {
        const created = await createAutomation({
            workspaceId,
            name: starter.name,
            description: starter.description,
            enabled: false,
            trigger: starter.trigger,
            nodes: starter.buildNodes(newStarterId),
            createdBy: userId,
        })

        trackFirstForWorkspace({
            workspaceId,
            userId,
            key: "automationCreatedAt",
            event: { name: "first_automation_created" },
        }).catch(() => {})

        revalidatePath("/automations")
        return { success: true, automation: created }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fork"
        return { success: false, error: message }
    }
}

const testEnrollSchema = z.object({
    automationId: z.string().min(1),
    /** Email to enroll. If a contact with this email exists, use it; else
     *  enroll as an external recipient (engine treats as no contact). */
    email: z.string().email(),
})

const bulkEnrollSchema = z.object({
    automationId: z.string().min(1),
    audience: z.discriminatedUnion("type", [
        z.object({ type: z.literal("all_contacts") }),
        z.object({ type: z.literal("by_list"), listId: z.string().min(1) }),
        z.object({ type: z.literal("by_tag"), tagId: z.string().min(1) }),
    ]),
})

/**
 * Manually enroll a batch of contacts into an automation. Honors the
 * automation's allowReEnroll setting — by default skips contacts that have
 * an existing run, opts them in if re-enrollment is allowed.
 *
 * Capped at 1000 contacts per call; for larger backfills run repeatedly.
 */
export async function bulkEnrollAction(
    input: z.infer<typeof bulkEnrollSchema>,
) {
    const { workspaceId } = await ws()
    const parsed = bulkEnrollSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid input" }

    try {
        const automation = await getAutomation(workspaceId, parsed.data.automationId)
        if (!automation) return { success: false, error: "Automation not found" }
        const allowReEnroll = automation.allowReEnroll ?? false

        // Resolve contacts by audience type
        let contactIds: string[] = []
        if (parsed.data.audience.type === "all_contacts") {
            const snap = await adminDb
                .collection("contacts")
                .where("workspaceId", "==", workspaceId)
                .limit(1000)
                .get()
            contactIds = snap.docs.map((d) => d.id)
        } else if (parsed.data.audience.type === "by_list") {
            const { listMemberIds } = await import("@/lib/lists/contact-lists")
            contactIds = await listMemberIds(
                workspaceId,
                parsed.data.audience.listId,
                1000,
            )
        } else if (parsed.data.audience.type === "by_tag") {
            const tagId = parsed.data.audience.tagId
            const snap = await adminDb
                .collection("contacts")
                .where("workspaceId", "==", workspaceId)
                .limit(1000)
                .get()
            contactIds = snap.docs
                .filter((d) =>
                    ((d.data().tags as Array<{ tagId: string }>) ?? []).some(
                        (t) => t.tagId === tagId,
                    ),
                )
                .map((d) => d.id)
        }

        let enrolled = 0
        let skipped = 0
        for (const contactId of contactIds) {
            if (!allowReEnroll) {
                const { isContactEnrolled } = await import("@/lib/automations/store")
                if (await isContactEnrolled(automation.id, contactId)) {
                    skipped += 1
                    continue
                }
            }
            const run = await startRun({
                workspaceId,
                automationId: automation.id,
                contactId,
                contextData: {
                    triggerType: "manual",
                    triggerMatch: {},
                    triggerPayload: { bulkEnroll: true },
                    triggeredAt: new Date().toISOString(),
                },
            })
            advanceRun(run.id).catch(() => {})
            enrolled += 1
        }

        revalidatePath(`/automations/${parsed.data.automationId}`)
        return {
            success: true,
            enrolled,
            skipped,
            attempted: contactIds.length,
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Bulk enroll failed"
        return { success: false, error: message }
    }
}

/**
 * Manually enroll a single email as a test run. Useful for testing a flow
 * without waiting for the natural trigger to fire. Bypasses the
 * single-enrollment guard so you can test repeatedly.
 */
export async function enrollTestRunAction(
    input: z.infer<typeof testEnrollSchema>,
) {
    const { workspaceId } = await ws()
    const parsed = testEnrollSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid email" }

    try {
        const automation = await getAutomation(workspaceId, parsed.data.automationId)
        if (!automation) return { success: false, error: "Automation not found" }

        // Try to resolve the email to an existing CRM contact (so add_tag,
        // update_field, etc. have something to operate on)
        const lower = parsed.data.email.toLowerCase()
        const snap = await adminDb
            .collection("contacts")
            .where("workspaceId", "==", workspaceId)
            .where("email", "==", lower)
            .limit(1)
            .get()
        const contactId = snap.empty ? "" : snap.docs[0].id

        const run = await startRun({
            workspaceId,
            automationId: parsed.data.automationId,
            contactId,
            contactEmail: lower,
            contextData: {
                triggerType: "manual",
                triggerMatch: {},
                triggerPayload: { test: true },
                triggeredAt: new Date().toISOString(),
            },
        })

        // Fire the first step. If it lands on a wait, the cron picks it up.
        advanceRun(run.id).catch((err) => {
            console.error(`[test-enroll] advanceRun failed:`, err)
        })

        revalidatePath(`/automations/${parsed.data.automationId}`)
        return { success: true, runId: run.id }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Test failed"
        return { success: false, error: message }
    }
}
