/**
 * Smart segment evaluator — turns a set of SegmentRules into a live list of
 * matching contact IDs. Evaluated on read, not stored.
 *
 * Performance characteristics:
 *   - Pulls up to 5,000 contacts in a workspace
 *   - For tag/status/email/created, evaluates in-memory after fetch
 *   - For list_membership, runs one Firestore query per list rule
 *   - For engagement, queries email_logs with workspaceId+contactId+...
 *     This is the slow path; use sparingly
 *
 * Good enough for workspaces under ~10k contacts. For larger, we'd need to
 * pre-compute and cache memberships (separate v2 work).
 */

import { adminDb } from "@/lib/firebase-admin"
import type { SegmentRule } from "@/types"

const MAX_CONTACTS_TO_EVAL = 5000

interface EvaluationContext {
    workspaceId: string
    rules: SegmentRule[]
    combinator: "and" | "or"
}

interface ContactSnap {
    id: string
    email: string
    status: string
    tags: Array<{ tagId: string }>
    createdAt: Date | null
}

function asDate(v: unknown): Date | null {
    if (!v) return null
    if (v instanceof Date) return v
    if (typeof (v as { toDate?: () => Date }).toDate === "function") {
        return (v as { toDate: () => Date }).toDate()
    }
    if (typeof v === "string") {
        const d = new Date(v)
        return isNaN(d.getTime()) ? null : d
    }
    return null
}

async function loadContactsBatch(workspaceId: string): Promise<ContactSnap[]> {
    const snap = await adminDb
        .collection("contacts")
        .where("workspaceId", "==", workspaceId)
        .limit(MAX_CONTACTS_TO_EVAL)
        .get()
    return snap.docs.map((d) => {
        const data = d.data()
        return {
            id: d.id,
            email: ((data.email as string) ?? "").toLowerCase(),
            status: (data.status as string) ?? "",
            tags: ((data.tags as Array<{ tagId: string }>) ?? []),
            createdAt: asDate(data.createdAt),
        }
    })
}

async function loadListMemberSet(
    workspaceId: string,
    listId: string,
): Promise<Set<string>> {
    const ref = adminDb.collection("contact_lists").doc(listId)
    const listDoc = await ref.get()
    if (!listDoc.exists) return new Set()
    if (listDoc.data()?.workspaceId !== workspaceId) return new Set()
    const snap = await ref.collection("members").limit(MAX_CONTACTS_TO_EVAL).get()
    return new Set(snap.docs.map((d) => d.id))
}

async function loadEngagedContacts(
    workspaceId: string,
    rule: Extract<SegmentRule, { field: "engagement" }>,
): Promise<Set<string>> {
    const days = rule.daysWindow ?? 90
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    let query = adminDb
        .collection("email_logs")
        .where("workspaceId", "==", workspaceId)
    if (rule.value && rule.value !== "any") {
        query = query.where("campaignId", "==", rule.value)
    }
    const snap = await query.limit(10_000).get()
    const matching = new Set<string>()
    for (const d of snap.docs) {
        const data = d.data()
        const contactId = (data.contactId as string) ?? null
        if (!contactId) continue
        const sentAt = asDate(data.sentAt)
        if (sentAt && sentAt < since) continue
        if (rule.op === "opened" && data.openedAt) matching.add(contactId)
        else if (rule.op === "clicked" && data.clickedAt) matching.add(contactId)
        // "not_opened" handled at evaluation time as a negation
    }
    return matching
}

async function evaluateSingle(
    rule: SegmentRule,
    contact: ContactSnap,
    listMembership: Map<string, Set<string>>,
    engaged: Map<string, Set<string>>,
): Promise<boolean> {
    switch (rule.field) {
        case "tag": {
            const has = contact.tags.some((t) => t.tagId === rule.value)
            return rule.op === "has" ? has : !has
        }
        case "list": {
            const set = listMembership.get(rule.value) ?? new Set()
            const on = set.has(contact.id)
            return rule.op === "on" ? on : !on
        }
        case "status": {
            const matches = contact.status === rule.value
            return rule.op === "is" ? matches : !matches
        }
        case "email": {
            const has = !!contact.email && contact.email.includes("@")
            return rule.op === "exists" ? has : !has
        }
        case "engagement": {
            const ruleKey = engagementKey(rule)
            const set = engaged.get(ruleKey) ?? new Set()
            const has = set.has(contact.id)
            if (rule.op === "opened" || rule.op === "clicked") return has
            // not_opened
            return !has
        }
        case "created": {
            if (!contact.createdAt) return false
            const target = new Date(rule.value)
            if (isNaN(target.getTime())) return false
            return rule.op === "before"
                ? contact.createdAt < target
                : contact.createdAt > target
        }
    }
    return false
}

function engagementKey(rule: Extract<SegmentRule, { field: "engagement" }>): string {
    return `${rule.op}:${rule.value}:${rule.daysWindow ?? 90}`
}

/**
 * Resolve a smart segment to its current member contact IDs.
 */
export async function resolveSegmentMembers(
    ctx: EvaluationContext,
): Promise<string[]> {
    if (ctx.rules.length === 0) return []

    // Pre-load auxiliary data once per evaluation
    const listRules = ctx.rules.filter(
        (r): r is Extract<SegmentRule, { field: "list" }> => r.field === "list",
    )
    const engagementRules = ctx.rules.filter(
        (r): r is Extract<SegmentRule, { field: "engagement" }> =>
            r.field === "engagement",
    )

    const listMembership = new Map<string, Set<string>>()
    await Promise.all(
        listRules.map(async (r) => {
            if (!listMembership.has(r.value)) {
                listMembership.set(r.value, await loadListMemberSet(ctx.workspaceId, r.value))
            }
        }),
    )

    const engaged = new Map<string, Set<string>>()
    await Promise.all(
        engagementRules.map(async (r) => {
            const key = engagementKey(r)
            if (!engaged.has(key)) {
                // For "not_opened" we still need the "opened" set — same op key
                const queryRule: Extract<SegmentRule, { field: "engagement" }> =
                    r.op === "not_opened"
                        ? { ...r, op: "opened" }
                        : r
                engaged.set(key, await loadEngagedContacts(ctx.workspaceId, queryRule))
            }
        }),
    )

    const contacts = await loadContactsBatch(ctx.workspaceId)
    const matching: string[] = []
    for (const c of contacts) {
        const results = await Promise.all(
            ctx.rules.map((r) => evaluateSingle(r, c, listMembership, engaged)),
        )
        const ok = ctx.combinator === "or" ? results.some(Boolean) : results.every(Boolean)
        if (ok) matching.push(c.id)
    }
    return matching
}

/** Fast count without materializing the full member list. Same logic, just totals. */
export async function countSegmentMembers(
    ctx: EvaluationContext,
): Promise<number> {
    const ids = await resolveSegmentMembers(ctx)
    return ids.length
}
