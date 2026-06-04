/**
 * Action handler registry. Each handler executes one node type and returns
 * a result that tells the engine what to do next:
 *
 *   { advance: true }                             — move to the next node
 *   { advance: true, jumpTo: "n3" }               — jump to a specific node id
 *   { advance: false, scheduledFor: Date }        — pause and resume later
 *   { advance: true, end: true }                  — terminate the run
 *   { advance: false, error: "..." }              — fail the run
 *
 * Handlers don't mutate run state directly — the engine does. They receive
 * a snapshot of the run + automation + the resolved contact (if any) and
 * return a typed result.
 */

import { adminDb } from "@/lib/firebase-admin"
import { sendEmail } from "@/lib/ses/sender"
import { sendSms, TwilioNotConfiguredError } from "@/lib/sms/sender"
import { addContactsToList, removeContactsFromList } from "@/lib/lists/contact-lists"
import { renderTokens, renderTokensHtml, buildContactContext } from "@/lib/templating/tokens"
import { runAI, AIKeyMissingError } from "@/lib/ai/run-ai"
import type {
    ActionType,
    AddTagNode,
    AddToListNode,
    AiSendEmailNode,
    AiClassifyNode,
    AiScoreNode,
    AiSummarizeNode,
    AssignUserNode,
    AutomationNode,
    AutomationRun,
    BranchIfNode,
    CreateTaskNode,
    IncrementFieldNode,
    RemoveFromListNode,
    RemoveTagNode,
    SendEmailNode,
    SendInternalEmailNode,
    SendSmsNode,
    StopIfNode,
    UpdateContactFieldNode,
    UpdateOpportunityNode,
    MoveOpportunityToStageNode,
    WaitNode,
    WaitUntilNode,
    WaitUntilBusinessHoursNode,
    WebhookNode,
} from "./types"

export interface ActionContext {
    workspaceId: string
    automationId: string
    run: AutomationRun
    /** All nodes in the parent automation (for branch_if to look up node ids). */
    nodes: AutomationNode[]
    /** The CRM contact, if this run is for a CRM contact. */
    contact: ActionContact | null
}

export interface ActionContact {
    id: string
    name: string | null
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    tags: Array<{ tagId: string; name?: string; color?: string }>
}

export interface ActionResult {
    /** Should the engine move past this node? */
    advance: boolean
    /** Skip the linear next-node and jump to this node id instead. */
    jumpTo?: string
    /** When advance=false, when should the run resume? */
    scheduledFor?: Date
    /** Mark the run as completed. */
    end?: boolean
    /** Mark the run as errored with this message. */
    error?: string
    /** Add to the run's contextData (merged shallow). */
    contextPatch?: Record<string, unknown>
}

// ── Handlers ───────────────────────────────────────────────────────────────

async function handleSendEmail(
    node: SendEmailNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    const to = ctx.contact?.email ?? (ctx.run.contactEmail || "")
    if (!to || !to.includes("@")) {
        return { advance: true, error: "no recipient email" }
    }
    try {
        const result = await sendEmail({
            workspaceId: ctx.workspaceId,
            to,
            subject: node.subject,
            html: node.html,
            contactId: ctx.contact?.id || undefined,
            // Mark this email_log as coming from an automation. We reuse the
            // campaignId field for now — a future schema change can split
            // this into source: "automation"|"campaign" if it gets confusing.
            campaignId: `automation:${ctx.automationId}`,
            autoResolveContact: false,
        })
        // sendEmail returns { ok, error } for soft-fail (suppression, etc).
        // Surface the soft fail in the run context but don't halt the run.
        if (!result.ok) {
            return { advance: true, error: result.error || "send skipped" }
        }
        return { advance: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "send_email failed"
        // Hard errors (SES misconfigured, credits) are NOT skipped silently
        // anymore. Surface them so the run history shows what's wrong.
        return { advance: true, error: message }
    }
}

// ── AI-generated email ─────────────────────────────────────────────────

const AI_SYSTEM_PROMPT = `You write personalized marketing/transactional emails on behalf of small-business operators using AFCrashpad CRM.

Output rules (strict):
- Output ONLY the email body as clean inline-styled HTML. No subject line, no preamble, no "Sure, here's…", no markdown fences.
- Wrap text in <p> tags with this style: style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#0f172a;"
- For the closing, use a single <p> with no inline signature image — just the sender's first name on its own line.
- Keep it short (3-5 short paragraphs max). Concrete, specific, conversational. Avoid filler like "I hope this email finds you well."
- Personalize using the recipient details given to you. Don't fabricate facts; if a detail isn't supplied, write around it.
- Never include {{ }} template syntax in the output — the recipient's name is already filled in for you.`

async function handleAiSendEmail(
    node: AiSendEmailNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    const to = ctx.contact?.email ?? (ctx.run.contactEmail || "")
    if (!to || !to.includes("@")) {
        return { advance: true, error: "no recipient email" }
    }

    const promptText = (node.prompt || "").trim()
    if (!promptText) {
        return { advance: true, error: "ai prompt empty" }
    }

    const subject = node.subject || "From your team"
    const maxTokens = Math.min(2000, Math.max(100, node.maxOutputTokens ?? 600))

    // Build a recipient context block from contact + run payload
    const firstName = ctx.contact?.firstName || ctx.contact?.name?.split(" ")[0] || ""
    const fullName = ctx.contact?.name || ""
    const email = ctx.contact?.email || ctx.run.contactEmail || ""

    const recipientBlock = [
        firstName ? `Recipient first name: ${firstName}` : "",
        fullName && fullName !== firstName ? `Full name: ${fullName}` : "",
        email ? `Email: ${email}` : "",
    ]
        .filter(Boolean)
        .join("\n")

    let html: string
    try {
        const ai = await runAI({
            workspaceId: ctx.workspaceId,
            feature: "automation_email",
            maxTokens,
            system: AI_SYSTEM_PROMPT,
            prompt: `${recipientBlock}\n\nWriting instructions:\n${promptText}\n\nWrite the email body now.`,
        })
        const text = ai.text.trim()
        if (!text) {
            return { advance: true, error: "ai returned empty body" }
        }
        // Strip stray markdown fences if the model misbehaves
        html = text
            .replace(/^```(?:html)?\s*/i, "")
            .replace(/\s*```\s*$/, "")
    } catch (err) {
        if (err instanceof AIKeyMissingError) {
            return { advance: true, error: "AI key not configured for this workspace" }
        }
        const message = err instanceof Error ? err.message : "ai generation failed"
        return { advance: true, error: message }
    }

    try {
        const result = await sendEmail({
            workspaceId: ctx.workspaceId,
            to,
            subject,
            html,
            contactId: ctx.contact?.id || undefined,
            campaignId: `automation:${ctx.automationId}:ai`,
            autoResolveContact: false,
        })
        if (!result.ok) {
            return { advance: true, error: result.error || "send skipped" }
        }
        return { advance: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "ai send failed"
        return { advance: true, error: message }
    }
}

// ── AI Classify, Score, Summarize ────────────────────────────────────────

/**
 * Build a string snapshot of the contact for AI prompts. Includes name,
 * email, status, tags, and any custom fields. We deliberately don't pass
 * the entire contact object — keeps token use down and avoids leaking
 * irrelevant internal fields (deletion timestamps, system metadata, etc).
 */
function describeContactForAI(ctx: ActionContext): string {
    const c = ctx.contact
    if (!c) return "(no contact attached to this run)"
    const lines: string[] = []
    if (c.name) lines.push(`Name: ${c.name}`)
    if (c.email) lines.push(`Email: ${c.email}`)
    if (c.phone) lines.push(`Phone: ${c.phone}`)
    if (Array.isArray(c.tags) && c.tags.length > 0) {
        lines.push(`Tags: ${c.tags.map((t: any) => t?.name).filter(Boolean).join(", ")}`)
    }
    return lines.join("\n") || "(empty contact)"
}

async function handleAiClassify(node: AiClassifyNode, ctx: ActionContext): Promise<ActionResult> {
    const options = Array.isArray(node.options) ? node.options.filter((o) => o.trim()) : []
    if (options.length === 0) return { advance: true, error: "ai_classify needs at least one option" }
    if (!ctx.contact?.id) return { advance: true, error: "ai_classify needs a contact" }

    const optionsList = options.map((o, i) => `${i + 1}. ${o}`).join("\n")
    const prompt = `You are classifying a CRM contact. Pick exactly one of the listed options.

Allowed options:
${optionsList}

Instructions:
${node.prompt || "Classify the contact based on the data below."}

Contact:
${describeContactForAI(ctx)}

Respond with ONLY the chosen option, exactly as written, no explanation.`

    let chosen = ""
    try {
        const ai = await runAI({
            workspaceId: ctx.workspaceId,
            feature: "automation_classify",
            prompt,
            maxTokens: 60,
            temperature: 0.2,
        })
        chosen = ai.text.trim().replace(/^[-*\s]+/, "").replace(/[.!]$/, "")
    } catch (err) {
        if (err instanceof AIKeyMissingError) return { advance: true, error: "AI key not configured" }
        return { advance: true, error: err instanceof Error ? err.message : "ai_classify failed" }
    }

    // Resolve to an exact option (case-insensitive). If the model invented
    // something off-list, accept the closest startsWith match before falling
    // back to "no match".
    const normalized = chosen.toLowerCase()
    const exact = options.find((o) => o.toLowerCase() === normalized)
    const startsWith = !exact ? options.find((o) => normalized.startsWith(o.toLowerCase())) : null
    const finalLabel = exact || startsWith || null
    if (!finalLabel) {
        return { advance: true, error: `ai picked an off-list label: "${chosen}"` }
    }

    try {
        // Persist the result on the contact: as a tag and/or a custom field.
        const updates: Record<string, unknown> = { updatedAt: new Date() }
        if (node.storeInCustomField) {
            updates[`customFields.${node.storeInCustomField}`] = finalLabel
        }
        if (Object.keys(updates).length > 1) {
            await adminDb.collection("contacts").doc(ctx.contact.id).update(updates)
        }
        if (node.addAsTag !== false) {
            // Reuse the existing add-tag flow by name. Cheap and safe.
            const { addTagToContactByName } = await import("@/lib/automations/tag-helpers")
            await addTagToContactByName(ctx.workspaceId, ctx.contact.id, finalLabel)
        }
    } catch (err) {
        return { advance: true, error: err instanceof Error ? err.message : "ai_classify save failed" }
    }

    return { advance: true }
}

async function handleAiScore(node: AiScoreNode, ctx: ActionContext): Promise<ActionResult> {
    if (!ctx.contact?.id) return { advance: true, error: "ai_score needs a contact" }

    const prompt = `You are scoring a CRM contact 0-100 (higher = better).

Scoring criteria:
${node.prompt || "Score how qualified this lead is."}

Contact:
${describeContactForAI(ctx)}

Respond with ONLY an integer between 0 and 100. No explanation, no symbols, just the number.`

    let raw = ""
    try {
        const ai = await runAI({
            workspaceId: ctx.workspaceId,
            feature: "automation_score",
            prompt,
            maxTokens: 12,
            temperature: 0,
        })
        raw = ai.text.trim()
    } catch (err) {
        if (err instanceof AIKeyMissingError) return { advance: true, error: "AI key not configured" }
        return { advance: true, error: err instanceof Error ? err.message : "ai_score failed" }
    }

    // Pull the first number out of the response — handles "85", "85/100",
    // and the occasional "Score: 85" the model slips in.
    const match = raw.match(/-?\d+/)
    if (!match) return { advance: true, error: `ai_score returned non-numeric: "${raw}"` }
    const score = Math.max(0, Math.min(100, parseInt(match[0], 10)))

    const fieldKey = node.storeInCustomField || "aiScore"
    try {
        await adminDb.collection("contacts").doc(ctx.contact.id).update({
            [`customFields.${fieldKey}`]: score,
            updatedAt: new Date(),
        })
    } catch (err) {
        return { advance: true, error: err instanceof Error ? err.message : "ai_score save failed" }
    }
    return { advance: true }
}

async function handleAiSummarize(node: AiSummarizeNode, ctx: ActionContext): Promise<ActionResult> {
    if (!ctx.contact?.id) return { advance: true, error: "ai_summarize needs a contact" }

    // Substitute contact tokens in the source text. Empty source defaults
    // to "summarize this contact's history" so the node is usable without
    // configuration on first drop.
    const tokens = buildContactContext(ctx.contact)
    const sourceRaw = (node.sourceText || "").trim() || `${describeContactForAI(ctx)}`
    const source = renderTokens(sourceRaw, tokens)

    const prompt = `Summarize the following CRM context in 2-3 sentences. Be specific and useful for a salesperson preparing for a call. Skip preamble.

Source:
${source}`

    let summary = ""
    try {
        const ai = await runAI({
            workspaceId: ctx.workspaceId,
            feature: "automation_summarize",
            prompt,
            maxTokens: Math.min(400, Math.max(60, node.maxOutputTokens ?? 200)),
            temperature: 0.5,
        })
        summary = ai.text.trim()
    } catch (err) {
        if (err instanceof AIKeyMissingError) return { advance: true, error: "AI key not configured" }
        return { advance: true, error: err instanceof Error ? err.message : "ai_summarize failed" }
    }
    if (!summary) return { advance: true, error: "ai returned empty summary" }

    const fieldKey = node.storeInCustomField || "aiSummary"
    try {
        await adminDb.collection("contacts").doc(ctx.contact.id).update({
            [`customFields.${fieldKey}`]: summary,
            updatedAt: new Date(),
        })
    } catch (err) {
        return { advance: true, error: err instanceof Error ? err.message : "ai_summarize save failed" }
    }
    return { advance: true }
}

async function handleSendSms(
    node: SendSmsNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    const phone = ctx.contact?.phone ?? ""
    if (!phone) {
        return { advance: true, error: "no contact phone number" }
    }
    if (!node.body?.trim()) {
        return { advance: true, error: "sms body empty" }
    }
    try {
        const result = await sendSms({
            workspaceId: ctx.workspaceId,
            to: phone,
            body: node.body,
            contactId: ctx.contact?.id || undefined,
        })
        if (!result.ok) {
            return { advance: true, error: result.error || "sms skipped" }
        }
        return { advance: true }
    } catch (err) {
        if (err instanceof TwilioNotConfiguredError) {
            return {
                advance: true,
                error: "Twilio not configured. Add credentials in Settings → Integrations → Twilio.",
            }
        }
        const message = err instanceof Error ? err.message : "sms failed"
        return { advance: true, error: message }
    }
}

async function handleWait(node: WaitNode): Promise<ActionResult> {
    const minutes = Math.max(1, Math.floor(node.delayMinutes || 0))
    const scheduledFor = new Date(Date.now() + minutes * 60_000)
    return { advance: false, scheduledFor }
}

async function handleWaitUntil(node: WaitUntilNode): Promise<ActionResult> {
    if (!node.until) return { advance: true, error: "wait_until: no date set" }
    const target = new Date(node.until)
    if (isNaN(target.getTime())) {
        return { advance: true, error: "wait_until: invalid date" }
    }
    if (target.getTime() <= Date.now()) {
        // Already in the past — advance immediately
        return { advance: true }
    }
    return { advance: false, scheduledFor: target }
}

async function handleWaitUntilBusinessHours(
    node: WaitUntilBusinessHoursNode,
): Promise<ActionResult> {
    const startHour = node.startHour ?? 9
    const endHour = node.endHour ?? 17
    const businessDays = node.businessDays ?? [1, 2, 3, 4, 5]
    const tz = node.timezone || "UTC"

    const next = nextBusinessHoursOpen(new Date(), startHour, endHour, businessDays, tz)
    if (!next) {
        // Already inside the window — advance now
        return { advance: true }
    }
    return { advance: false, scheduledFor: next }
}

/**
 * Returns the next datetime when the run should resume — `null` if already
 * within the business-hours window. Uses Intl APIs for tz math (no extra
 * deps needed).
 */
function nextBusinessHoursOpen(
    now: Date,
    startHour: number,
    endHour: number,
    businessDays: number[],
    tz: string,
): Date | null {
    // Get the components of `now` IN the target timezone via Intl
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })
    const parts = fmt.formatToParts(now)
    const get = (k: string) => parts.find((p) => p.type === k)?.value ?? ""
    const wkday = get("weekday")
    const dayOfWeekMap: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    }
    const dow = dayOfWeekMap[wkday] ?? 0
    const hour = parseInt(get("hour"), 10)

    const inWindow = businessDays.includes(dow) && hour >= startHour && hour < endHour
    if (inWindow) return null

    // Otherwise, walk forward day-by-day to find the next business day at startHour
    for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
        const candidate = new Date(now)
        candidate.setUTCDate(candidate.getUTCDate() + dayOffset)
        // Re-evaluate weekday in TZ
        const candidateParts = fmt.formatToParts(candidate)
        const candidateWkday = candidateParts.find((p) => p.type === "weekday")?.value ?? ""
        const candidateDow = dayOfWeekMap[candidateWkday] ?? 0
        if (!businessDays.includes(candidateDow)) continue
        // Construct candidate at startHour in target timezone — approximate
        // via a "set to local startHour in TZ" approach using Intl offset.
        const candidateAtOpen = atHourInTimezone(candidate, startHour, tz)
        if (candidateAtOpen.getTime() > now.getTime()) {
            return candidateAtOpen
        }
    }
    // Fallback — should not hit; if we do, just return 24h from now
    return new Date(now.getTime() + 24 * 60 * 60 * 1000)
}

/** Approximate: set the date's hour to `hour` in the target timezone. */
function atHourInTimezone(d: Date, hour: number, tz: string): Date {
    // Compute the offset between UTC and tz at this date.
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        hour12: false,
        timeZoneName: "shortOffset",
    })
    const parts = dtf.formatToParts(d)
    const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+0"
    const offsetMatch = /GMT([+-])(\d+)(?::(\d+))?/.exec(offsetPart)
    let offsetMinutes = 0
    if (offsetMatch) {
        const sign = offsetMatch[1] === "+" ? 1 : -1
        const hh = parseInt(offsetMatch[2], 10) || 0
        const mm = parseInt(offsetMatch[3] || "0", 10) || 0
        offsetMinutes = sign * (hh * 60 + mm)
    }
    // We want: localTime hour = `hour`, minute = 0 in the target TZ.
    // localTime = UTC + offset. So UTC = localTime - offset.
    const yyyy = d.getUTCFullYear()
    const mo = d.getUTCMonth()
    const dd = d.getUTCDate()
    // Build a Date as if the wall-clock in UTC matches local TZ wall-clock,
    // then subtract offset to convert.
    const wallClockUTC = Date.UTC(yyyy, mo, dd, hour, 0, 0, 0)
    return new Date(wallClockUTC - offsetMinutes * 60_000)
}

async function handleAddTag(
    node: AddTagNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    if (!ctx.contact) return { advance: true }
    const existing = ctx.contact.tags ?? []
    if (existing.some((t) => t.tagId === node.tagId)) {
        return { advance: true } // already has it
    }
    const tagDoc = await adminDb.collection("tags").doc(node.tagId).get()
    const tagData = tagDoc.exists
        ? {
              tagId: node.tagId,
              name: (tagDoc.data()?.name as string) ?? node.tagName ?? node.tagId,
              color: (tagDoc.data()?.color as string) ?? "#94a3b8",
          }
        : { tagId: node.tagId, name: node.tagName ?? node.tagId, color: "#94a3b8" }
    await adminDb
        .collection("contacts")
        .doc(ctx.contact.id)
        .update({ tags: [...existing, tagData], updatedAt: new Date() })
    return { advance: true }
}

async function handleRemoveTag(
    node: RemoveTagNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    if (!ctx.contact) return { advance: true }
    const filtered = (ctx.contact.tags ?? []).filter((t) => t.tagId !== node.tagId)
    if (filtered.length === ctx.contact.tags.length) return { advance: true }
    await adminDb
        .collection("contacts")
        .doc(ctx.contact.id)
        .update({ tags: filtered, updatedAt: new Date() })
    return { advance: true }
}

async function handleAddToList(
    node: AddToListNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    if (!ctx.contact) return { advance: true }
    await addContactsToList(ctx.workspaceId, node.listId, [ctx.contact.id])
    return { advance: true }
}

async function handleRemoveFromList(
    node: RemoveFromListNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    if (!ctx.contact) return { advance: true }
    await removeContactsFromList(ctx.workspaceId, node.listId, [ctx.contact.id])
    return { advance: true }
}

async function handleBranchIf(
    node: BranchIfNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    const truthy = await evaluateCondition(node.condition, ctx)
    const target = truthy ? node.trueNext : node.falseNext
    // null = severed end-of-path on this branch
    if (target === null) return { advance: true, end: true }
    // empty/undefined = fall through to linear next (legacy behavior)
    if (!target) return { advance: true }
    return { advance: true, jumpTo: target }
}

async function handleStopIf(
    node: StopIfNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    const truthy = await evaluateCondition(node.condition, ctx)
    if (truthy) {
        return { advance: true, end: true }
    }
    return { advance: true }
}

async function handleUpdateContactField(
    node: UpdateContactFieldNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    if (!ctx.contact) return { advance: true, error: "no contact to update" }
    const path = node.fieldPath?.trim()
    if (!path) return { advance: true, error: "fieldPath required" }
    // Block writes to sensitive system fields
    const blocked = ["workspaceId", "id", "createdAt", "createdBy"]
    if (blocked.includes(path) || blocked.some((b) => path.startsWith(b + "."))) {
        return { advance: true, error: `cannot update ${path}` }
    }
    await adminDb
        .collection("contacts")
        .doc(ctx.contact.id)
        .update({ [path]: node.value, updatedAt: new Date() })
    return { advance: true }
}

async function handleIncrementField(
    node: IncrementFieldNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    if (!ctx.contact) return { advance: true, error: "no contact" }
    const path = node.fieldPath?.trim()
    if (!path) return { advance: true, error: "fieldPath required" }
    const blocked = ["workspaceId", "id", "createdAt", "createdBy"]
    if (blocked.includes(path) || blocked.some((b) => path.startsWith(b + "."))) {
        return { advance: true, error: `cannot increment ${path}` }
    }
    // Use FieldValue.increment for atomicity (avoids read-modify-write races)
    const { FieldValue } = await import("firebase-admin/firestore")
    await adminDb
        .collection("contacts")
        .doc(ctx.contact.id)
        .update({
            [path]: FieldValue.increment(node.delta || 0),
            updatedAt: new Date(),
        })
    return { advance: true }
}

async function handleAssignUser(
    node: AssignUserNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    if (!ctx.contact) return { advance: true, error: "no contact" }
    await adminDb
        .collection("contacts")
        .doc(ctx.contact.id)
        .update({
            assigneeId: node.userId || null,
            updatedAt: new Date(),
        })
    return { advance: true }
}

async function handleCreateTask(
    node: CreateTaskNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    if (!node.title?.trim()) return { advance: true, error: "title required" }
    // Render tokens against contact context
    const tokenCtx = buildContactContext(
        ctx.contact
            ? {
                  id: ctx.contact.id,
                  name: ctx.contact.name,
                  firstName: ctx.contact.firstName,
                  lastName: ctx.contact.lastName,
                  email: ctx.contact.email,
              }
            : undefined,
        null,
    )
    const title = renderTokens(node.title, tokenCtx)
    const description = node.description ? renderTokens(node.description, tokenCtx) : ""
    const dueDate = node.dueOffsetDays
        ? new Date(Date.now() + node.dueOffsetDays * 24 * 60 * 60 * 1000)
        : null
    await adminDb.collection("tasks").add({
        workspaceId: ctx.workspaceId,
        title,
        description,
        contactId: ctx.contact?.id ?? null,
        assigneeId: node.assigneeId || null,
        dueDate,
        completed: false,
        source: `automation:${ctx.automationId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
    })
    return { advance: true }
}

async function handleMoveOpportunityToStage(
    node: MoveOpportunityToStageNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    const oppId = (ctx.run.contextData?.triggerPayload as { opportunityId?: string } | undefined)
        ?.opportunityId
    if (!oppId) {
        return { advance: true, error: "no opportunityId in trigger payload" }
    }
    if (!node.stageId) {
        return { advance: true, error: "stageId required" }
    }
    try {
        const ref = adminDb.collection("opportunities").doc(oppId)
        const doc = await ref.get()
        if (!doc.exists) return { advance: true, error: "opportunity not found" }
        const data = doc.data() ?? {}
        if (data.workspaceId !== ctx.workspaceId) {
            return { advance: true, error: "opportunity not in workspace" }
        }

        // Loop guard: if the opportunity is already in the target stage,
        // skip the write. Otherwise a pipeline_stage_entered automation
        // that ends with move_opportunity_to_stage(<same stage>) would
        // re-fire itself indefinitely.
        const sameStage = data.pipelineStageId === node.stageId
        const samePipeline = !node.pipelineId || data.pipelineId === node.pipelineId
        if (sameStage && samePipeline) {
            return { advance: true } // No-op — nothing to do
        }

        const update: Record<string, unknown> = {
            pipelineStageId: node.stageId,
            updatedAt: new Date(),
        }
        if (node.pipelineId) update.pipelineId = node.pipelineId
        await ref.update(update)
        return { advance: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "move failed"
        return { advance: true, error: message }
    }
}

async function handleUpdateOpportunity(
    node: UpdateOpportunityNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    const oppId = (ctx.run.contextData?.triggerPayload as { opportunityId?: string } | undefined)
        ?.opportunityId
    if (!oppId) {
        return { advance: true, error: "no opportunityId in trigger payload" }
    }
    const path = node.fieldPath?.trim()
    if (!path) return { advance: true, error: "fieldPath required" }
    const blocked = ["workspaceId", "id", "createdAt", "createdBy"]
    if (blocked.includes(path) || blocked.some((b) => path.startsWith(b + "."))) {
        return { advance: true, error: `cannot update ${path}` }
    }
    try {
        const ref = adminDb.collection("opportunities").doc(oppId)
        const doc = await ref.get()
        if (!doc.exists) return { advance: true, error: "opportunity not found" }
        if (doc.data()?.workspaceId !== ctx.workspaceId) {
            return { advance: true, error: "opportunity not in workspace" }
        }
        await ref.update({ [path]: node.value, updatedAt: new Date() })
        return { advance: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "update failed"
        return { advance: true, error: message }
    }
}

async function handleSendInternalEmail(
    node: SendInternalEmailNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    const recipients = (node.to || "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.includes("@"))
    if (recipients.length === 0) {
        return { advance: true, error: "no internal recipients" }
    }
    const tokenCtx = buildContactContext(
        ctx.contact
            ? {
                  id: ctx.contact.id,
                  name: ctx.contact.name,
                  firstName: ctx.contact.firstName,
                  lastName: ctx.contact.lastName,
                  email: ctx.contact.email,
              }
            : undefined,
        null,
    )
    const subject = renderTokens(node.subject || "Automation update", tokenCtx)
    const body = renderTokensHtml(node.body || "", tokenCtx)
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;color:#0f172a;">
<p style="font-size:14px;color:#64748b;margin:0 0 12px 0;">Internal notification from AFCrashpad automation</p>
<div style="font-size:15px;line-height:1.6;">${body.replace(/\n/g, "<br>")}</div>
</div>`
    let any = false
    for (const to of recipients) {
        try {
            await sendEmail({
                workspaceId: ctx.workspaceId,
                to,
                subject,
                html,
                campaignId: `automation:${ctx.automationId}:internal`,
                autoResolveContact: false,
                renderTokens: false,
            })
            any = true
        } catch (err) {
            console.warn("[automation] internal email failed:", err)
        }
    }
    return { advance: true, error: any ? undefined : "all internal sends failed" }
}

async function handleWebhook(
    node: WebhookNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    // When stopOnFailure is set, any failure halts the run. Otherwise the node
    // soft-fails (legacy behavior — keeps the run going so a flaky external
    // dependency doesn't break the rest of the sequence).
    const stop = !!node.stopOnFailure
    const fail = (err: string): ActionResult => ({ advance: !stop, error: err })

    if (!node.url || !/^https?:\/\//.test(node.url)) {
        return fail("webhook url must start with http(s)://")
    }
    try {
        const headers: Record<string, string> = { "content-type": "application/json" }
        if (node.authHeader) headers["authorization"] = node.authHeader
        const payload = {
            workspaceId: ctx.workspaceId,
            automationId: ctx.automationId,
            runId: ctx.run.id,
            contactId: ctx.contact?.id ?? null,
            email: ctx.contact?.email ?? ctx.run.contactEmail ?? null,
            firstName: ctx.contact?.firstName ?? null,
            lastName: ctx.contact?.lastName ?? null,
            triggerType: ctx.run.contextData?.triggerType ?? null,
            firedAt: new Date().toISOString(),
        }
        // 5-second timeout — long enough for normal endpoints, short enough
        // that a hung webhook doesn't tie up the engine.
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5_000)
        try {
            const res = await fetch(node.url, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal,
            })
            if (!res.ok) return fail(`webhook ${res.status}`)
        } finally {
            clearTimeout(timeout)
        }
        return { advance: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "webhook failed"
        return fail(message)
    }
}

async function evaluateCondition(
    c: { field: string; targetId: string },
    ctx: ActionContext,
): Promise<boolean> {
    if (!ctx.contact) return false

    if (c.field === "tag") {
        return (ctx.contact.tags ?? []).some((t) => t.tagId === c.targetId)
    }
    if (c.field === "list_membership") {
        const doc = await adminDb
            .collection("contact_lists")
            .doc(c.targetId)
            .collection("members")
            .doc(ctx.contact.id)
            .get()
        return doc.exists
    }
    if (c.field === "email_opened" || c.field === "email_clicked") {
        const field = c.field === "email_opened" ? "openedAt" : "clickedAt"
        const snap = await adminDb
            .collection("email_logs")
            .where("workspaceId", "==", ctx.workspaceId)
            .where("contactId", "==", ctx.contact.id)
            .where("campaignId", "==", c.targetId)
            .limit(20)
            .get()
        return snap.docs.some((d) => !!d.data()[field])
    }
    return false
}

// ── Dispatcher ─────────────────────────────────────────────────────────────

const HANDLERS: Record<ActionType, (node: AutomationNode, ctx: ActionContext) => Promise<ActionResult>> = {
    send_email: (n, c) => handleSendEmail(n as SendEmailNode, c),
    ai_send_email: (n, c) => handleAiSendEmail(n as AiSendEmailNode, c),
    ai_classify: (n, c) => handleAiClassify(n as AiClassifyNode, c),
    ai_score: (n, c) => handleAiScore(n as AiScoreNode, c),
    ai_summarize: (n, c) => handleAiSummarize(n as AiSummarizeNode, c),
    send_sms: (n, c) => handleSendSms(n as SendSmsNode, c),
    wait: (n) => handleWait(n as WaitNode),
    wait_until: (n) => handleWaitUntil(n as WaitUntilNode),
    wait_until_business_hours: (n) =>
        handleWaitUntilBusinessHours(n as WaitUntilBusinessHoursNode),
    add_tag: (n, c) => handleAddTag(n as AddTagNode, c),
    remove_tag: (n, c) => handleRemoveTag(n as RemoveTagNode, c),
    add_to_list: (n, c) => handleAddToList(n as AddToListNode, c),
    remove_from_list: (n, c) => handleRemoveFromList(n as RemoveFromListNode, c),
    branch_if: (n, c) => handleBranchIf(n as BranchIfNode, c),
    stop_if: (n, c) => handleStopIf(n as StopIfNode, c),
    update_contact_field: (n, c) => handleUpdateContactField(n as UpdateContactFieldNode, c),
    increment_field: (n, c) => handleIncrementField(n as IncrementFieldNode, c),
    assign_user: (n, c) => handleAssignUser(n as AssignUserNode, c),
    create_task: (n, c) => handleCreateTask(n as CreateTaskNode, c),
    send_internal_email: (n, c) => handleSendInternalEmail(n as SendInternalEmailNode, c),
    update_opportunity: (n, c) => handleUpdateOpportunity(n as UpdateOpportunityNode, c),
    move_opportunity_to_stage: (n, c) => handleMoveOpportunityToStage(n as MoveOpportunityToStageNode, c),
    webhook: (n, c) => handleWebhook(n as WebhookNode, c),
    end: async () => ({ advance: true, end: true }),
}

export async function runAction(
    node: AutomationNode,
    ctx: ActionContext,
): Promise<ActionResult> {
    const handler = HANDLERS[node.type]
    if (!handler) {
        return { advance: true, error: `Unknown action type: ${node.type}` }
    }
    try {
        return await handler(node, ctx)
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { advance: false, error: message }
    }
}

// Helper: load the contact for a run (with the fields action handlers need)
export async function loadActionContact(
    contactId: string,
): Promise<ActionContact | null> {
    if (!contactId) return null
    const doc = await adminDb.collection("contacts").doc(contactId).get()
    if (!doc.exists) return null
    const data = doc.data() || {}
    return {
        id: doc.id,
        name: (data.name as string) ?? null,
        firstName: (data.firstName as string) ?? null,
        lastName: (data.lastName as string) ?? null,
        email: (data.email as string) ?? null,
        phone: (data.phone as string) ?? null,
        tags: ((data.tags as ActionContact["tags"]) ?? []) as ActionContact["tags"],
    }
}
