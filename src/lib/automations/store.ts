/**
 * Firestore CRUD for automations + runs.
 *
 * Kept thin and free of business logic — the engine + trigger dispatch read
 * and write through here so we have one place to evolve the schema.
 */

import { adminDb } from "@/lib/firebase-admin"
import { FieldValue, type Query } from "firebase-admin/firestore"
import type {
    Automation,
    AutomationNode,
    AutomationRun,
    AutomationStats,
    RunStatus,
    Trigger,
    TriggerType,
} from "./types"

const AUTOMATIONS = "automations"
const RUNS = "automation_runs"

function tsToISO(ts: unknown): string {
    if (!ts) return new Date().toISOString()
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
        return (ts as { toDate: () => Date }).toDate().toISOString()
    }
    if (ts instanceof Date) return ts.toISOString()
    return typeof ts === "string" ? ts : new Date().toISOString()
}

function emptyStats(): AutomationStats {
    return {
        runsStarted: 0,
        runsCompleted: 0,
        runsErrored: 0,
        contactsEnrolled: 0,
    }
}

function mapAutomation(id: string, data: Record<string, unknown>): Automation {
    return {
        id,
        workspaceId: (data.workspaceId as string) ?? "",
        name: (data.name as string) ?? "",
        description: (data.description as string) || undefined,
        enabled: (data.enabled as boolean) ?? false,
        trigger: (data.trigger as Trigger) ?? { type: "manual", config: {} },
        nodes: (data.nodes as AutomationNode[]) ?? [],
        stats: { ...emptyStats(), ...((data.stats as AutomationStats) ?? {}) },
        allowReEnroll: (data.allowReEnroll as boolean) ?? false,
        goal: (data.goal as Automation["goal"]) ?? undefined,
        webhookToken: (data.webhookToken as string) ?? undefined,
        createdBy: (data.createdBy as string) ?? null,
        createdAt: tsToISO(data.createdAt),
        updatedAt: tsToISO(data.updatedAt),
    }
}

function mapRun(id: string, data: Record<string, unknown>): AutomationRun {
    return {
        id,
        workspaceId: (data.workspaceId as string) ?? "",
        automationId: (data.automationId as string) ?? "",
        contactId: (data.contactId as string) ?? "",
        contactEmail: (data.contactEmail as string) || undefined,
        status: ((data.status as RunStatus) ?? "running") as RunStatus,
        currentNodeIdx: (data.currentNodeIdx as number) ?? 0,
        scheduledFor: data.scheduledFor ? tsToISO(data.scheduledFor) : undefined,
        contextData: (data.contextData as Record<string, unknown>) ?? {},
        startedAt: tsToISO(data.startedAt),
        updatedAt: tsToISO(data.updatedAt),
        completedAt: data.completedAt ? tsToISO(data.completedAt) : undefined,
        errorMessage: (data.errorMessage as string) || undefined,
    }
}

// ── Automations CRUD ───────────────────────────────────────────────────────

export interface CreateAutomationInput {
    workspaceId: string
    name: string
    description?: string
    enabled?: boolean
    trigger: Trigger
    nodes?: AutomationNode[]
    allowReEnroll?: boolean
    goal?: Automation["goal"]
    webhookToken?: string
    createdBy?: string | null
}

export async function createAutomation(input: CreateAutomationInput): Promise<Automation> {
    if (!input.workspaceId) throw new Error("workspaceId required")
    if (!input.name?.trim()) throw new Error("name required")
    const now = new Date()
    const ref = await adminDb.collection(AUTOMATIONS).add({
        workspaceId: input.workspaceId,
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        enabled: input.enabled ?? false,
        trigger: input.trigger,
        nodes: input.nodes ?? [],
        stats: emptyStats(),
        allowReEnroll: input.allowReEnroll ?? false,
        goal: input.goal ?? null,
        webhookToken: input.webhookToken ?? null,
        createdBy: input.createdBy ?? null,
        createdAt: now,
        updatedAt: now,
    })
    const snap = await ref.get()
    return mapAutomation(ref.id, snap.data()!)
}

export interface UpdateAutomationInput {
    name?: string
    description?: string | null
    enabled?: boolean
    trigger?: Trigger
    nodes?: AutomationNode[]
    allowReEnroll?: boolean
    goal?: Automation["goal"] | null
    webhookToken?: string | null
}

export async function updateAutomation(
    workspaceId: string,
    automationId: string,
    patch: UpdateAutomationInput,
): Promise<Automation> {
    const ref = adminDb.collection(AUTOMATIONS).doc(automationId)
    const doc = await ref.get()
    if (!doc.exists) throw new Error("Automation not found")
    const existing = doc.data()!
    if (existing.workspaceId !== workspaceId) throw new Error("Forbidden")

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.name !== undefined) updates.name = patch.name.trim()
    if (patch.description !== undefined) updates.description = patch.description ?? null
    if (patch.enabled !== undefined) updates.enabled = patch.enabled
    if (patch.trigger !== undefined) updates.trigger = patch.trigger
    if (patch.nodes !== undefined) updates.nodes = patch.nodes
    if (patch.allowReEnroll !== undefined) updates.allowReEnroll = patch.allowReEnroll
    if (patch.goal !== undefined) updates.goal = patch.goal
    if (patch.webhookToken !== undefined) updates.webhookToken = patch.webhookToken

    await ref.update(updates)
    const updated = await ref.get()
    return mapAutomation(ref.id, updated.data()!)
}

export async function getAutomation(
    workspaceId: string,
    automationId: string,
): Promise<Automation | null> {
    const doc = await adminDb.collection(AUTOMATIONS).doc(automationId).get()
    if (!doc.exists) return null
    const data = doc.data()!
    if (data.workspaceId !== workspaceId) return null
    return mapAutomation(doc.id, data)
}

export async function listAutomations(workspaceId: string): Promise<Automation[]> {
    if (!workspaceId) throw new Error("workspaceId required")
    const snap = await adminDb
        .collection(AUTOMATIONS)
        .where("workspaceId", "==", workspaceId)
        .orderBy("updatedAt", "desc")
        .limit(200)
        .get()
    return snap.docs.map((d) => mapAutomation(d.id, d.data()))
}

export async function deleteAutomation(
    workspaceId: string,
    automationId: string,
): Promise<void> {
    const ref = adminDb.collection(AUTOMATIONS).doc(automationId)
    const doc = await ref.get()
    if (!doc.exists) return
    if (doc.data()?.workspaceId !== workspaceId) throw new Error("Forbidden")
    await ref.delete()
    // Note: in-flight runs are NOT cascaded — they'll error on next tick when
    // they try to read their automation. Acceptable for v1; could orphan-cleanup
    // in cron later.
}

/**
 * List automations whose trigger matches a given event type. Used by the
 * trigger dispatcher to find candidates without scanning every automation.
 */
export async function findEnabledAutomationsByTrigger(
    workspaceId: string,
    triggerType: TriggerType,
): Promise<Automation[]> {
    const snap = await adminDb
        .collection(AUTOMATIONS)
        .where("workspaceId", "==", workspaceId)
        .where("enabled", "==", true)
        .where("trigger.type", "==", triggerType)
        .limit(50)
        .get()
    return snap.docs.map((d) => mapAutomation(d.id, d.data()))
}

// ── Runs ───────────────────────────────────────────────────────────────────

export interface StartRunInput {
    workspaceId: string
    automationId: string
    contactId: string
    contactEmail?: string
    contextData?: Record<string, unknown>
}

/**
 * Create a new run in "running" status at node index 0. Caller (engine) is
 * responsible for executing the first step right after.
 */
export async function startRun(input: StartRunInput): Promise<AutomationRun> {
    const now = new Date()
    const ref = await adminDb.collection(RUNS).add({
        workspaceId: input.workspaceId,
        automationId: input.automationId,
        contactId: input.contactId,
        contactEmail: input.contactEmail ?? null,
        status: "running" as RunStatus,
        currentNodeIdx: 0,
        contextData: input.contextData ?? {},
        startedAt: now,
        updatedAt: now,
    })
    // Bump enrollment counters
    await adminDb.collection(AUTOMATIONS).doc(input.automationId).update({
        "stats.runsStarted": FieldValue.increment(1),
        "stats.contactsEnrolled": FieldValue.increment(1),
        updatedAt: new Date(),
    })
    const snap = await ref.get()
    return mapRun(ref.id, snap.data()!)
}

/**
 * Atomically enroll a contact only if they have no ACTIVE run in this
 * automation. Closes the race window where two concurrent triggers both
 * read "not enrolled" and both create runs (e.g. tag_added firing twice
 * within ms, or two webhooks delivering the same event).
 *
 * Returns the new run on success, or null when an existing active run
 * already exists for this contact (caller should treat as "skipped").
 */
export async function startRunIfNotEnrolled(
    input: StartRunInput,
): Promise<AutomationRun | null> {
    const now = new Date()
    const newRunRef = adminDb.collection(RUNS).doc()
    const automationRef = adminDb.collection(AUTOMATIONS).doc(input.automationId)

    const result = await adminDb.runTransaction(async (tx) => {
        // Look for any in-flight run for this contact in this automation.
        // Only "running" + "waiting" count as active — completed/errored/
        // stopped/goal_reached are historical and don't block re-enroll.
        const existingSnap = await tx.get(
            adminDb
                .collection(RUNS)
                .where("automationId", "==", input.automationId)
                .where("contactId", "==", input.contactId)
                .where("status", "in", ["running", "waiting"])
                .limit(1),
        )
        if (!existingSnap.empty) return null

        tx.set(newRunRef, {
            workspaceId: input.workspaceId,
            automationId: input.automationId,
            contactId: input.contactId,
            contactEmail: input.contactEmail ?? null,
            status: "running" as RunStatus,
            currentNodeIdx: 0,
            contextData: input.contextData ?? {},
            startedAt: now,
            updatedAt: now,
        })
        tx.update(automationRef, {
            "stats.runsStarted": FieldValue.increment(1),
            "stats.contactsEnrolled": FieldValue.increment(1),
            updatedAt: now,
        })
        return newRunRef.id
    })

    if (!result) return null
    const snap = await newRunRef.get()
    return mapRun(newRunRef.id, snap.data()!)
}

export async function getRun(
    runId: string,
): Promise<AutomationRun | null> {
    const doc = await adminDb.collection(RUNS).doc(runId).get()
    if (!doc.exists) return null
    return mapRun(doc.id, doc.data()!)
}

export interface UpdateRunInput {
    status?: RunStatus
    currentNodeIdx?: number
    scheduledFor?: Date | null
    contextData?: Record<string, unknown>
    completedAt?: Date | null
    errorMessage?: string | null
}

export async function updateRun(
    runId: string,
    patch: UpdateRunInput,
): Promise<void> {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.status !== undefined) updates.status = patch.status
    if (patch.currentNodeIdx !== undefined) updates.currentNodeIdx = patch.currentNodeIdx
    if (patch.scheduledFor !== undefined) {
        updates.scheduledFor = patch.scheduledFor
    }
    if (patch.contextData !== undefined) updates.contextData = patch.contextData
    if (patch.completedAt !== undefined) updates.completedAt = patch.completedAt
    if (patch.errorMessage !== undefined) updates.errorMessage = patch.errorMessage
    await adminDb.collection(RUNS).doc(runId).update(updates)
}

/**
 * Atomically claim a waiting run for execution. Returns the run if we won
 * the race (status flipped waiting → running) or null if another worker
 * got there first. Prevents double-execution when the cron retries or
 * multiple workers process the same batch.
 */
export async function claimWaitingRun(
    runId: string,
): Promise<AutomationRun | null> {
    const ref = adminDb.collection(RUNS).doc(runId)
    return adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists) return null
        const data = snap.data()!
        if (data.status !== "waiting") return null
        tx.update(ref, {
            status: "running",
            scheduledFor: null,
            updatedAt: new Date(),
        })
        return mapRun(snap.id, { ...data, status: "running", scheduledFor: null })
    })
}

/**
 * Has this contact already been enrolled in this automation with an
 * ACTIVE run? Only "running" + "waiting" count — historical runs
 * (completed / errored / stopped / goal_reached) don't block re-enroll
 * unless the caller explicitly wants strict single-enrollment.
 *
 * Note: this is now best-effort visibility for UI / logging. The race-safe
 * enrollment check happens inside startRunIfNotEnrolled().
 */
export async function isContactEnrolled(
    automationId: string,
    contactId: string,
): Promise<boolean> {
    if (!contactId) return false
    const snap = await adminDb
        .collection(RUNS)
        .where("automationId", "==", automationId)
        .where("contactId", "==", contactId)
        .where("status", "in", ["running", "waiting"])
        .limit(1)
        .get()
    return !snap.empty
}

/**
 * Find waiting runs whose scheduledFor has passed. Used by the cron job to
 * pick up runs whose wait timer has elapsed and resume them.
 */
export async function findDueWaitingRuns(
    limit = 50,
): Promise<AutomationRun[]> {
    const now = new Date()
    const snap = await adminDb
        .collection(RUNS)
        .where("status", "==", "waiting")
        .where("scheduledFor", "<=", now)
        .orderBy("scheduledFor", "asc")
        .limit(limit)
        .get()
    return snap.docs.map((d) => mapRun(d.id, d.data()))
}

export async function listRunsByAutomation(
    workspaceId: string,
    automationId: string,
    limit = 100,
): Promise<AutomationRun[]> {
    const q: Query = adminDb
        .collection(RUNS)
        .where("workspaceId", "==", workspaceId)
        .where("automationId", "==", automationId)
        .orderBy("startedAt", "desc")
        .limit(limit)
    try {
        const snap = await q.get()
        return snap.docs.map((d) => mapRun(d.id, d.data()))
    } catch (err) {
        // Composite index not deployed yet — fall back to a non-ordered scan
        // so the page still loads. Sort in memory; this is bounded by `limit`.
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes("FAILED_PRECONDITION") || message.includes("requires an index")) {
            console.warn(
                "[listRunsByAutomation] composite index not deployed; falling back to in-memory sort",
            )
            const fallbackSnap = await adminDb
                .collection(RUNS)
                .where("automationId", "==", automationId)
                .limit(limit * 2)
                .get()
            const rows = fallbackSnap.docs
                .map((d) => mapRun(d.id, d.data()))
                .filter((r) => r.workspaceId === workspaceId)
                .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
                .slice(0, limit)
            return rows
        }
        throw err
    }
}

export async function bumpAutomationStat(
    automationId: string,
    field: "runsCompleted" | "runsErrored",
): Promise<void> {
    await adminDb.collection(AUTOMATIONS).doc(automationId).update({
        [`stats.${field}`]: FieldValue.increment(1),
        updatedAt: new Date(),
    })
}
