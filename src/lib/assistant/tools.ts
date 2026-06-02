/**
 * Tool definitions for the in-app AI assistant.
 *
 * Two flavors:
 *   - Read-only tools (search, summary, lookups) — safe to auto-run
 *   - Write tools (Tier 1: create_task / add_note / tag_contact;
 *     Tier 2: update_contact_status / move_deal_to_stage) — also
 *     auto-run, but each write is logged to the audit log so the
 *     workspace owner can see what the assistant did and undo if
 *     needed.
 *
 * Each tool returns a compact JSON payload tiny enough to keep
 * follow-up reasoning fast.
 *
 * Adding a tool: append to TOOL_DEFS and the handlers map. Schema is
 * the official Anthropic tool input_schema (JSON Schema subset).
 */

import type Anthropic from "@anthropic-ai/sdk"
import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"

export interface ToolContext {
    workspaceId: string
    /** Caller's user id, used for audit logs on write tools. */
    userId?: string
    /** Caller's display name, used in audit logs and notes. */
    userName?: string
}

interface ToolHandler {
    (args: Record<string, unknown>, ctx: ToolContext): Promise<unknown>
}

export const TOOL_DEFS: Anthropic.Messages.ToolUnion[] = [
    {
        name: "search_contacts",
        description:
            "Search the workspace's contacts by name or email substring. Returns up to 10 matches with name, email, status, and creation date.",
        input_schema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search term — matches name or email substrings (case-insensitive).",
                },
            },
            required: ["query"],
        },
    },
    {
        name: "get_pipeline_summary",
        description:
            "Get a snapshot of the sales pipeline: count of opportunities per stage and total open deal value.",
        input_schema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "get_recent_campaigns",
        description:
            "List recent email campaigns with delivery counts and status. Default last 10.",
        input_schema: {
            type: "object",
            properties: {
                limit: {
                    type: "integer",
                    description: "Max campaigns to return (default 10, max 25).",
                },
            },
            required: [],
        },
    },
    {
        name: "get_automation_summary",
        description:
            "List the workspace's automations with enable status and runs/goals counters.",
        input_schema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "get_upcoming_appointments",
        description:
            "List upcoming confirmed bookings within the next N days (default 14).",
        input_schema: {
            type: "object",
            properties: {
                days: {
                    type: "integer",
                    description: "Window in days from now (default 14, max 90).",
                },
            },
            required: [],
        },
    },
    {
        name: "get_stale_opportunities",
        description:
            "Find open opportunities not updated in the last N days (default 14).",
        input_schema: {
            type: "object",
            properties: {
                days: {
                    type: "integer",
                    description: "Days of inactivity (default 14, max 365).",
                },
                limit: {
                    type: "integer",
                    description: "Max results (default 20, max 50).",
                },
            },
            required: [],
        },
    },
    // ── Write tools (Tier 1: low-risk, idempotent) ───────────────────────
    {
        name: "create_task",
        description:
            "Create a follow-up task in this workspace. Optionally attach to a contact.",
        input_schema: {
            type: "object",
            properties: {
                title: { type: "string", description: "Task title (required)." },
                dueInDays: {
                    type: "integer",
                    description: "Days from now the task is due. 0 = today, max 365. Defaults to 1 (tomorrow).",
                },
                contactId: { type: "string", description: "Contact id to link this task to (optional)." },
                priority: {
                    type: "string",
                    description: "Task priority — one of HIGH / MEDIUM / LOW. Defaults to MEDIUM.",
                },
            },
            required: ["title"],
        },
    },
    {
        name: "add_note_to_contact",
        description:
            "Append a note to a contact's timeline. Useful for capturing meeting summaries.",
        input_schema: {
            type: "object",
            properties: {
                contactId: { type: "string", description: "Contact id (required)." },
                content: { type: "string", description: "Note body (required, plain text)." },
            },
            required: ["contactId", "content"],
        },
    },
    {
        name: "tag_contact",
        description:
            "Add a tag to a contact by name. Creates the tag in the workspace if it doesn't exist.",
        input_schema: {
            type: "object",
            properties: {
                contactId: { type: "string", description: "Contact id (required)." },
                tagName: { type: "string", description: "Tag name (required)." },
            },
            required: ["contactId", "tagName"],
        },
    },
    // ── Write tools (Tier 2: moderate risk, lifecycle-affecting) ─────────
    {
        name: "update_contact_status",
        description:
            "Change a contact's status (e.g. Lead, Active Client, Past Client). Must be one of the workspace's configured statuses.",
        input_schema: {
            type: "object",
            properties: {
                contactId: { type: "string", description: "Contact id (required)." },
                status: { type: "string", description: "New status name (required)." },
            },
            required: ["contactId", "status"],
        },
    },
    {
        name: "move_deal_to_stage",
        description:
            "Move a deal/opportunity to a different pipeline stage. Stage must exist in the deal's pipeline.",
        input_schema: {
            type: "object",
            properties: {
                opportunityId: { type: "string", description: "Opportunity id (required)." },
                stageName: {
                    type: "string",
                    description: "Target stage name (e.g. 'Qualified', 'Closed Won').",
                },
            },
            required: ["opportunityId", "stageName"],
        },
    },
]

const handlers: Record<string, ToolHandler> = {
    search_contacts: async (args, ctx) => {
        const query = String(args.query ?? "").toLowerCase().trim()
        if (!query) return { error: "query required" }
        const snap = await adminDb
            .collection("contacts")
            .where("workspaceId", "==", ctx.workspaceId)
            .limit(500)
            .get()
        const matches = snap.docs
            .map((d) => {
                const data = d.data()
                return {
                    id: d.id,
                    name: (data.name as string) ?? "",
                    email: (data.email as string) ?? "",
                    status: (data.status as string) ?? "",
                    createdAt: tsToISO(data.createdAt),
                }
            })
            .filter(
                (c) =>
                    c.name.toLowerCase().includes(query) ||
                    c.email.toLowerCase().includes(query),
            )
            .slice(0, 10)
        return { count: matches.length, matches }
    },

    get_pipeline_summary: async (_args, ctx) => {
        const snap = await adminDb
            .collection("opportunities")
            .where("workspaceId", "==", ctx.workspaceId)
            .where("status", "==", "open")
            .limit(2000)
            .get()
        const byStage = new Map<string, { count: number; totalValue: number }>()
        let totalValue = 0
        for (const d of snap.docs) {
            const data = d.data()
            const stage = (data.pipelineStageId as string) ?? "(no stage)"
            const value = Number(data.opportunityValue) || 0
            const ent = byStage.get(stage) ?? { count: 0, totalValue: 0 }
            ent.count += 1
            ent.totalValue += value
            byStage.set(stage, ent)
            totalValue += value
        }
        // Resolve stage IDs → names (best-effort)
        const stageNames = new Map<string, string>()
        const pipelinesSnap = await adminDb
            .collection("pipelines")
            .where("workspaceId", "==", ctx.workspaceId)
            .limit(20)
            .get()
        for (const p of pipelinesSnap.docs) {
            const stagesSnap = await p.ref.collection("stages").get()
            for (const s of stagesSnap.docs) {
                stageNames.set(s.id, (s.data().name as string) ?? s.id)
            }
        }
        return {
            totalOpenOpportunities: snap.size,
            totalOpenValue: totalValue,
            byStage: [...byStage.entries()].map(([stageId, s]) => ({
                stageName: stageNames.get(stageId) ?? stageId,
                count: s.count,
                totalValue: s.totalValue,
            })),
        }
    },

    get_recent_campaigns: async (args, ctx) => {
        const limit = Math.min(25, Math.max(1, Number(args.limit) || 10))
        const snap = await adminDb
            .collection("email_campaigns")
            .where("workspaceId", "==", ctx.workspaceId)
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get()
        return {
            campaigns: snap.docs.map((d) => {
                const data = d.data()
                const stats = data.stats ?? {}
                return {
                    id: d.id,
                    name: (data.name as string) ?? "(untitled)",
                    subject: (data.subject as string) ?? "",
                    status: (data.status as string) ?? "draft",
                    sent: (stats.sent as number) ?? 0,
                    failed: (stats.failed as number) ?? 0,
                    targeted: (stats.targeted as number) ?? 0,
                    sentAt: tsToISO(data.sentAt),
                }
            }),
        }
    },

    get_automation_summary: async (_args, ctx) => {
        const snap = await adminDb
            .collection("automations")
            .where("workspaceId", "==", ctx.workspaceId)
            .limit(100)
            .get()
        return {
            automations: snap.docs.map((d) => {
                const data = d.data()
                const stats = data.stats ?? {}
                return {
                    id: d.id,
                    name: (data.name as string) ?? "(untitled)",
                    enabled: (data.enabled as boolean) ?? false,
                    triggerType: (data.trigger?.type as string) ?? "",
                    runsStarted: (stats.runsStarted as number) ?? 0,
                    runsCompleted: (stats.runsCompleted as number) ?? 0,
                    goalsReached: (stats.goalsReached as number) ?? 0,
                }
            }),
        }
    },

    get_upcoming_appointments: async (args, ctx) => {
        const days = Math.min(90, Math.max(1, Number(args.days) || 14))
        const now = new Date()
        const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
        const snap = await adminDb
            .collection("appointments")
            .where("workspaceId", "==", ctx.workspaceId)
            .where("startsAt", ">=", now)
            .where("startsAt", "<=", horizon)
            .limit(50)
            .get()
            .catch(() => null)
        if (!snap) return { appointments: [] }
        return {
            appointments: snap.docs
                .filter((d) => d.data().status !== "cancelled")
                .map((d) => {
                    const data = d.data()
                    return {
                        id: d.id,
                        name: (data.contactName as string) ?? "",
                        email: (data.contactEmail as string) ?? "",
                        startsAt: tsToISO(data.startsAt),
                        endsAt: tsToISO(data.endsAt),
                    }
                }),
        }
    },

    get_stale_opportunities: async (args, ctx) => {
        const days = Math.min(365, Math.max(1, Number(args.days) || 14))
        const limit = Math.min(50, Math.max(1, Number(args.limit) || 20))
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        const snap = await adminDb
            .collection("opportunities")
            .where("workspaceId", "==", ctx.workspaceId)
            .where("status", "==", "open")
            .where("updatedAt", "<=", cutoff)
            .limit(limit)
            .get()
        return {
            count: snap.size,
            opportunities: snap.docs.map((d) => {
                const data = d.data()
                const updatedAt = tsToISO(data.updatedAt)
                const daysIdle = Math.floor(
                    (Date.now() - new Date(updatedAt).getTime()) /
                        (24 * 60 * 60 * 1000),
                )
                return {
                    id: d.id,
                    name: (data.name as string) ?? "(unnamed)",
                    value: Number(data.opportunityValue) || 0,
                    contactId: (data.contactId as string) ?? null,
                    daysIdle,
                    updatedAt,
                }
            }),
        }
    },

    // ── Write tools — Tier 1 (low-risk) ──────────────────────────────────

    create_task: async (args, ctx) => {
        const title = String(args.title ?? "").trim()
        if (!title) return { error: "title required" }
        const days = Math.max(0, Math.min(365, Number(args.dueInDays ?? 1)))
        const contactId = args.contactId ? String(args.contactId) : null
        const priorityRaw = String(args.priority ?? "MEDIUM").toUpperCase()
        const priority = ["HIGH", "MEDIUM", "LOW"].includes(priorityRaw) ? priorityRaw : "MEDIUM"

        const dueDate = new Date(Date.now() + days * 86_400_000)
        const db = tenantDb(ctx.workspaceId)
        const ref = await db.add("tasks", {
            title,
            dueDate,
            priority,
            completed: false,
            contactId,
            assigneeId: ctx.userId || null,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdByAssistant: true,
        })
        await logAssistantWrite(ctx, "create_task", "task", ref.id, title)
        return { ok: true, taskId: ref.id, title, dueDate: dueDate.toISOString() }
    },

    add_note_to_contact: async (args, ctx) => {
        const contactId = String(args.contactId ?? "").trim()
        const content = String(args.content ?? "").trim()
        if (!contactId || !content) return { error: "contactId and content required" }

        const db = tenantDb(ctx.workspaceId)
        const owned = await db.getOwned("contacts", contactId)
        if (!owned) return { error: "contact not found" }

        const ref = await db.addToSubcollection("contacts", contactId, "notes", {
            content,
            contactId,
            createdAt: new Date(),
            updatedAt: new Date(),
            authorName: ctx.userName ? `${ctx.userName} (via AI assistant)` : "AI assistant",
            authorId: ctx.userId || null,
            createdByAssistant: true,
        })
        await logAssistantWrite(ctx, "add_note", "contact", contactId, content.slice(0, 80))
        return { ok: true, noteId: ref.id, contactId }
    },

    tag_contact: async (args, ctx) => {
        const contactId = String(args.contactId ?? "").trim()
        const tagName = String(args.tagName ?? "").trim()
        if (!contactId || !tagName) return { error: "contactId and tagName required" }

        const db = tenantDb(ctx.workspaceId)
        const owned = await db.getOwned("contacts", contactId)
        if (!owned) return { error: "contact not found" }

        const { addTagToContactByName } = await import("@/lib/automations/tag-helpers")
        await addTagToContactByName(ctx.workspaceId, contactId, tagName)
        await logAssistantWrite(ctx, "tag_contact", "contact", contactId, tagName)
        return { ok: true, contactId, tagName }
    },

    // ── Write tools — Tier 2 (lifecycle / pipeline state) ────────────────

    update_contact_status: async (args, ctx) => {
        const contactId = String(args.contactId ?? "").trim()
        const status = String(args.status ?? "").trim()
        if (!contactId || !status) return { error: "contactId and status required" }

        const db = tenantDb(ctx.workspaceId)
        const owned = await db.getOwned("contacts", contactId)
        if (!owned) return { error: "contact not found" }

        // Validate status against the workspace's configured statuses so
        // the AI can't invent ad-hoc statuses ("VeryHotLead" etc.).
        const statusesSnap = await db.collection("contact_statuses").get()
        const allowed = statusesSnap.docs.map((d) => (d.data().name as string) || "")
        const match = allowed.find((s) => s.toLowerCase() === status.toLowerCase())
        if (!match) {
            return { error: `Status not in workspace. Allowed: ${allowed.join(", ") || "(none configured)"}` }
        }

        await db.doc("contacts", contactId).update({
            status: match,
            updatedAt: new Date(),
        })
        await logAssistantWrite(ctx, "update_status", "contact", contactId, match)
        return { ok: true, contactId, status: match }
    },

    move_deal_to_stage: async (args, ctx) => {
        const oppId = String(args.opportunityId ?? "").trim()
        const stageName = String(args.stageName ?? "").trim()
        if (!oppId || !stageName) return { error: "opportunityId and stageName required" }

        const db = tenantDb(ctx.workspaceId)
        const oppDoc = await db.doc("opportunities", oppId).get()
        if (!oppDoc.exists) return { error: "opportunity not found" }
        const oppData = oppDoc.data() || {}

        // Resolve stageName to a real stage in the deal's pipeline. We
        // search across all pipelines as a fallback so the assistant can
        // move deals to canonical stages like "Closed Won" without
        // knowing which pipeline they live in.
        const pipelinesSnap = await db.collection("pipelines").get()
        let targetStageId: string | null = null
        for (const pDoc of pipelinesSnap.docs) {
            const stagesSnap = await db.subcollection("pipelines", pDoc.id, "stages").get()
            for (const sDoc of stagesSnap.docs) {
                if ((sDoc.data().name as string)?.toLowerCase() === stageName.toLowerCase()) {
                    targetStageId = sDoc.id
                    break
                }
            }
            if (targetStageId) break
        }
        if (!targetStageId) return { error: `Stage "${stageName}" not found in any pipeline` }

        const history = Array.isArray(oppData.stageHistory) ? [...oppData.stageHistory] : []
        history.push({ stageId: targetStageId, enteredAt: new Date() })
        await db.doc("opportunities", oppId).update({
            pipelineStageId: targetStageId,
            stageHistory: history,
            updatedAt: new Date(),
        })
        await logAssistantWrite(ctx, "move_deal_to_stage", "opportunity", oppId, stageName)
        return { ok: true, opportunityId: oppId, stageName, stageId: targetStageId }
    },
}

/**
 * Append a row to the workspace's audit log so admins can see exactly
 * what the AI assistant did and undo it if needed. Best-effort — a
 * failed audit log shouldn't block the actual mutation.
 */
async function logAssistantWrite(
    ctx: ToolContext,
    action: string,
    entity: string,
    entityId: string,
    note: string,
): Promise<void> {
    try {
        const { logAudit } = await import("@/lib/audit-log")
        await logAudit(ctx.workspaceId, {
            action: `assistant_${action}`,
            entity,
            entityId,
            userId: ctx.userId || "ai-assistant",
            userName: ctx.userName ? `${ctx.userName} (via AI assistant)` : "AI assistant",
            details: { note },
        })
    } catch {
        // Non-fatal — keep the mutation result visible to the user
    }
}

function tsToISO(ts: unknown): string {
    if (!ts) return ""
    if (ts instanceof Date) return ts.toISOString()
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
        return (ts as { toDate: () => Date }).toDate().toISOString()
    }
    return typeof ts === "string" ? ts : ""
}

export async function runTool(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
): Promise<string> {
    const handler = handlers[name]
    if (!handler) return JSON.stringify({ error: `Unknown tool: ${name}` })
    try {
        const result = await handler(args, ctx)
        return JSON.stringify(result)
    } catch (err) {
        const message = err instanceof Error ? err.message : "tool failed"
        return JSON.stringify({ error: message })
    }
}
