/**
 * Contact Lists — Instantly / GHL-style static lists you can target with
 * campaigns. Members can be either CRM contacts OR external emails imported
 * via CSV (which deliberately do NOT show up in the CRM by default).
 *
 * Storage:
 *   contact_lists/{listId}                       { workspaceId, name, ..., contactCount }
 *   contact_lists/{listId}/members/{contactId}   CRM contact:  { workspaceId, contactId, source:"crm", addedAt }
 *   contact_lists/{listId}/members/ext_<hash>    External CSV: { workspaceId, email, name?, source:"csv", addedAt }
 *
 * The `source` field is new — older docs without it default to "crm" with
 * the doc ID as the contactId. External members use a deterministic
 * `ext_<sha256-12hex>` doc ID derived from the lowercased email so duplicate
 * imports collapse onto the same membership.
 *
 * contactCount is a cached counter maintained on add/remove. Accurate-enough
 * for UI; for authoritative counts at send time, call countMembers().
 */

import crypto from "node:crypto"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import type { ContactList, SegmentRule } from "@/types"
import { resolveSegmentMembers } from "./segments"

export const EXTERNAL_PREFIX = "ext_"

export function externalMemberId(email: string): string {
    const normalized = email.trim().toLowerCase()
    const hash = crypto.createHash("sha256").update(normalized).digest("hex")
    return EXTERNAL_PREFIX + hash.slice(0, 24)
}

export function isExternalMemberId(id: string): boolean {
    return id.startsWith(EXTERNAL_PREFIX)
}

export interface CrmListMember {
    kind: "crm"
    memberId: string
    contactId: string
    addedAt: string
}

export interface ExternalListMember {
    kind: "external"
    memberId: string
    email: string
    name?: string
    addedAt: string
}

export type ListMember = CrmListMember | ExternalListMember

function tsToISO(ts: unknown): string {
    if (!ts) return new Date().toISOString()
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
        return (ts as { toDate: () => Date }).toDate().toISOString()
    }
    if (ts instanceof Date) return ts.toISOString()
    return typeof ts === "string" ? ts : new Date().toISOString()
}

function mapList(id: string, data: Record<string, unknown>): ContactList {
    return {
        id,
        workspaceId: (data.workspaceId as string) ?? "",
        name: (data.name as string) ?? "",
        description: (data.description as string) ?? undefined,
        type: ((data.type as string) ?? "static") as "static" | "smart",
        contactCount: (data.contactCount as number) ?? 0,
        rules: (data.rules as SegmentRule[]) ?? undefined,
        combinator: (data.combinator as "and" | "or") ?? undefined,
        createdBy: (data.createdBy as string) ?? null,
        createdAt: tsToISO(data.createdAt),
        updatedAt: tsToISO(data.updatedAt),
    }
}

export async function listLists(workspaceId: string): Promise<ContactList[]> {
    if (!workspaceId) throw new Error("workspaceId required")
    const snap = await adminDb
        .collection("contact_lists")
        .where("workspaceId", "==", workspaceId)
        .orderBy("updatedAt", "desc")
        .limit(500)
        .get()
    return snap.docs.map((d) => mapList(d.id, d.data()))
}

export async function getList(
    workspaceId: string,
    listId: string,
): Promise<ContactList | null> {
    if (!workspaceId) throw new Error("workspaceId required")
    const doc = await adminDb.collection("contact_lists").doc(listId).get()
    if (!doc.exists) return null
    const data = doc.data()!
    if (data.workspaceId !== workspaceId) return null
    return mapList(doc.id, data)
}

export interface CreateListInput {
    workspaceId: string
    name: string
    description?: string
    type?: "static" | "smart"
    rules?: SegmentRule[]
    combinator?: "and" | "or"
    createdBy?: string | null
}

export async function createList(input: CreateListInput): Promise<ContactList> {
    if (!input.workspaceId) throw new Error("workspaceId required")
    if (!input.name?.trim()) throw new Error("name required")
    const now = new Date()
    const data: Record<string, unknown> = {
        workspaceId: input.workspaceId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        type: input.type ?? "static",
        contactCount: 0,
        createdBy: input.createdBy ?? null,
        createdAt: now,
        updatedAt: now,
    }
    if (input.type === "smart") {
        data.rules = input.rules ?? []
        data.combinator = input.combinator ?? "and"
    }
    const ref = await adminDb.collection("contact_lists").add(data)
    const snap = await ref.get()
    return mapList(ref.id, snap.data()!)
}

export async function updateList(
    workspaceId: string,
    listId: string,
    patch: {
        name?: string
        description?: string
        rules?: SegmentRule[]
        combinator?: "and" | "or"
    },
): Promise<ContactList> {
    const ref = adminDb.collection("contact_lists").doc(listId)
    const doc = await ref.get()
    if (!doc.exists) throw new Error("List not found")
    if (doc.data()?.workspaceId !== workspaceId) throw new Error("Forbidden")
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.name !== undefined) updates.name = patch.name.trim()
    if (patch.description !== undefined)
        updates.description = patch.description.trim() || null
    if (patch.rules !== undefined) updates.rules = patch.rules
    if (patch.combinator !== undefined) updates.combinator = patch.combinator
    await ref.update(updates)
    const updated = await ref.get()
    return mapList(ref.id, updated.data()!)
}

/**
 * Lookup or create a hidden auto-list scoped to a campaign's non-openers,
 * and seed it with the given CRM contact IDs + external emails.
 *
 * Used by "Resend to non-openers": stores the recipient set as a real list
 * so the new draft can use audienceType "by_list" without inventing a new
 * audience type. The list is tagged in `description` so the UI can hide
 * these from the "Pick a list" dropdown if desired.
 */
export async function findOrCreateNonOpenerList(
    workspaceId: string,
    campaignId: string,
    campaignName: string,
    seed: { contactIds: string[]; emails: string[]; createdBy?: string | null },
): Promise<ContactList> {
    const tag = `__resend_nonopeners:${campaignId}`
    // Check for an existing list with this auto-tag
    const existing = await adminDb
        .collection("contact_lists")
        .where("workspaceId", "==", workspaceId)
        .where("description", "==", tag)
        .limit(1)
        .get()
    if (!existing.empty) {
        return mapList(existing.docs[0].id, existing.docs[0].data())
    }

    const created = await createList({
        workspaceId,
        name: `Non-openers: ${campaignName}`.slice(0, 120),
        description: tag,
        type: "static",
        createdBy: seed.createdBy ?? null,
    })

    if (seed.contactIds.length > 0) {
        await addContactsToList(workspaceId, created.id, seed.contactIds)
    }
    if (seed.emails.length > 0) {
        const rows = seed.emails.map((email) => ({ email }))
        await addEmailsToList(workspaceId, created.id, rows)
    }

    // Re-fetch so contactCount reflects the seeded members
    const ref = adminDb.collection("contact_lists").doc(created.id)
    const fresh = await ref.get()
    return mapList(created.id, fresh.data()!)
}

export async function deleteList(workspaceId: string, listId: string): Promise<void> {
    const ref = adminDb.collection("contact_lists").doc(listId)
    const doc = await ref.get()
    if (!doc.exists) return
    if (doc.data()?.workspaceId !== workspaceId) throw new Error("Forbidden")
    // Cascade delete members. Batch in chunks of 500 (Firestore limit).
    const members = await ref.collection("members").get()
    const batchSize = 500
    for (let i = 0; i < members.docs.length; i += batchSize) {
        const batch = adminDb.batch()
        for (const m of members.docs.slice(i, i + batchSize)) batch.delete(m.ref)
        await batch.commit()
    }
    await ref.delete()
}

export async function addContactsToList(
    workspaceId: string,
    listId: string,
    contactIds: string[],
): Promise<{ added: number; alreadyPresent: number }> {
    if (contactIds.length === 0) return { added: 0, alreadyPresent: 0 }
    const listRef = adminDb.collection("contact_lists").doc(listId)
    const listDoc = await listRef.get()
    if (!listDoc.exists) throw new Error("List not found")
    if (listDoc.data()?.workspaceId !== workspaceId) throw new Error("Forbidden")

    const membersCol = listRef.collection("members")
    // Chunk add via batches of 450 (leaves room for list counter update below)
    let added = 0
    let alreadyPresent = 0
    const now = new Date()
    const BATCH = 450

    for (let i = 0; i < contactIds.length; i += BATCH) {
        const chunk = contactIds.slice(i, i + BATCH)
        // Check which already exist to avoid miscount
        const existingSnaps = await Promise.all(
            chunk.map((id) => membersCol.doc(id).get()),
        )
        const batch = adminDb.batch()
        chunk.forEach((cid, idx) => {
            if (existingSnaps[idx].exists) {
                alreadyPresent += 1
                return
            }
            batch.set(membersCol.doc(cid), {
                workspaceId,
                contactId: cid,
                source: "crm",
                addedAt: now,
            })
            added += 1
        })
        await batch.commit()
    }

    if (added > 0) {
        await listRef.update({
            contactCount: FieldValue.increment(added),
            updatedAt: new Date(),
        })
    }
    return { added, alreadyPresent }
}

export async function removeContactsFromList(
    workspaceId: string,
    listId: string,
    contactIds: string[],
): Promise<{ removed: number }> {
    if (contactIds.length === 0) return { removed: 0 }
    const listRef = adminDb.collection("contact_lists").doc(listId)
    const listDoc = await listRef.get()
    if (!listDoc.exists) throw new Error("List not found")
    if (listDoc.data()?.workspaceId !== workspaceId) throw new Error("Forbidden")

    const membersCol = listRef.collection("members")
    let removed = 0
    const BATCH = 450

    for (let i = 0; i < contactIds.length; i += BATCH) {
        const chunk = contactIds.slice(i, i + BATCH)
        const existingSnaps = await Promise.all(
            chunk.map((id) => membersCol.doc(id).get()),
        )
        const batch = adminDb.batch()
        chunk.forEach((cid, idx) => {
            if (existingSnaps[idx].exists) {
                batch.delete(membersCol.doc(cid))
                removed += 1
            }
        })
        await batch.commit()
    }

    if (removed > 0) {
        await listRef.update({
            contactCount: FieldValue.increment(-removed),
            updatedAt: new Date(),
        })
    }
    return { removed }
}

export interface AddEmailsResult {
    added: number
    alreadyPresent: number
    invalid: number
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Add a batch of CSV-imported emails to a list as EXTERNAL members. These do
 * NOT create CRM contacts — they live only as list members. Duplicates (by
 * normalized email) dedupe across the same list and across re-imports.
 */
export async function addEmailsToList(
    workspaceId: string,
    listId: string,
    rows: Array<{ email: string; name?: string }>,
): Promise<AddEmailsResult> {
    const listRef = adminDb.collection("contact_lists").doc(listId)
    const listDoc = await listRef.get()
    if (!listDoc.exists) throw new Error("List not found")
    if (listDoc.data()?.workspaceId !== workspaceId) throw new Error("Forbidden")

    const membersCol = listRef.collection("members")

    // Normalize, validate, dedupe-within-batch
    const seen = new Set<string>()
    const valid: Array<{ memberId: string; email: string; name?: string }> = []
    let invalid = 0
    for (const row of rows) {
        const email = row.email?.trim().toLowerCase() ?? ""
        if (!email || !EMAIL_REGEX.test(email)) {
            invalid += 1
            continue
        }
        if (seen.has(email)) continue
        seen.add(email)
        valid.push({
            memberId: externalMemberId(email),
            email,
            name: row.name?.trim() || undefined,
        })
    }

    let added = 0
    let alreadyPresent = 0
    const now = new Date()
    const BATCH = 450

    for (let i = 0; i < valid.length; i += BATCH) {
        const chunk = valid.slice(i, i + BATCH)
        const existingSnaps = await Promise.all(
            chunk.map((r) => membersCol.doc(r.memberId).get()),
        )
        const batch = adminDb.batch()
        chunk.forEach((row, idx) => {
            if (existingSnaps[idx].exists) {
                alreadyPresent += 1
                return
            }
            const data: Record<string, unknown> = {
                workspaceId,
                email: row.email,
                source: "csv",
                addedAt: now,
            }
            if (row.name) data.name = row.name
            batch.set(membersCol.doc(row.memberId), data)
            added += 1
        })
        await batch.commit()
    }

    if (added > 0) {
        await listRef.update({
            contactCount: FieldValue.increment(added),
            updatedAt: new Date(),
        })
    }
    return { added, alreadyPresent, invalid }
}

/**
 * Remove members by their member doc ID. Works for both CRM and external
 * members — the doc ID prefix tells them apart.
 */
export async function removeMembersById(
    workspaceId: string,
    listId: string,
    memberIds: string[],
): Promise<{ removed: number }> {
    if (memberIds.length === 0) return { removed: 0 }
    const listRef = adminDb.collection("contact_lists").doc(listId)
    const listDoc = await listRef.get()
    if (!listDoc.exists) throw new Error("List not found")
    if (listDoc.data()?.workspaceId !== workspaceId) throw new Error("Forbidden")

    const membersCol = listRef.collection("members")
    let removed = 0
    const BATCH = 450
    for (let i = 0; i < memberIds.length; i += BATCH) {
        const chunk = memberIds.slice(i, i + BATCH)
        const existingSnaps = await Promise.all(
            chunk.map((id) => membersCol.doc(id).get()),
        )
        const batch = adminDb.batch()
        chunk.forEach((id, idx) => {
            if (existingSnaps[idx].exists) {
                batch.delete(membersCol.doc(id))
                removed += 1
            }
        })
        await batch.commit()
    }
    if (removed > 0) {
        await listRef.update({
            contactCount: FieldValue.increment(-removed),
            updatedAt: new Date(),
        })
    }
    return { removed }
}

function mapMember(id: string, data: Record<string, unknown>): ListMember {
    const addedAt = tsToISO(data.addedAt)
    if (isExternalMemberId(id) || data.source === "csv") {
        return {
            kind: "external",
            memberId: id,
            email: (data.email as string) ?? "",
            name: (data.name as string) || undefined,
            addedAt,
        }
    }
    return {
        kind: "crm",
        memberId: id,
        contactId: (data.contactId as string) ?? id,
        addedAt,
    }
}

/** Rich member listing — returns both CRM and external members.
 *  For smart segments, evaluates rules live and returns the matching CRM
 *  contacts (no external members in smart segments by definition). */
export async function listMembers(
    workspaceId: string,
    listId: string,
    limit = 5000,
): Promise<ListMember[]> {
    const listRef = adminDb.collection("contact_lists").doc(listId)
    const listDoc = await listRef.get()
    if (!listDoc.exists) return []
    const data = listDoc.data()
    if (data?.workspaceId !== workspaceId) return []

    if (data.type === "smart") {
        const rules = (data.rules as SegmentRule[]) ?? []
        const combinator = (data.combinator as "and" | "or") ?? "and"
        const ids = await resolveSegmentMembers({ workspaceId, rules, combinator })
        const now = new Date().toISOString()
        return ids.slice(0, limit).map((id) => ({
            kind: "crm" as const,
            memberId: id,
            contactId: id,
            addedAt: now,
        }))
    }

    const snap = await listRef.collection("members").limit(limit).get()
    return snap.docs.map((d) => mapMember(d.id, d.data()))
}

/**
 * Legacy: returns just CRM contact IDs. Skips external email members.
 * Kept for callers that only care about contact-linked members.
 */
export async function listMemberIds(
    workspaceId: string,
    listId: string,
    limit = 5000,
): Promise<string[]> {
    const members = await listMembers(workspaceId, listId, limit)
    return members
        .filter((m): m is CrmListMember => m.kind === "crm")
        .map((m) => m.contactId)
}

export interface UnionMembersResult {
    contactIds: string[]
    externalEmails: Array<{ email: string; name?: string }>
}

/**
 * Union of members across multiple lists, deduped. Returns CRM contact IDs
 * AND external CSV-imported emails separately, so the caller can resolve
 * each appropriately.
 */
export async function unionMembers(
    workspaceId: string,
    listIds: string[],
    limitPerList = 5000,
): Promise<UnionMembersResult> {
    const lists = await Promise.all(
        listIds.map((id) => listMembers(workspaceId, id, limitPerList)),
    )
    const contactIds = new Set<string>()
    const emails = new Map<string, { email: string; name?: string }>()
    for (const members of lists) {
        for (const m of members) {
            if (m.kind === "crm") contactIds.add(m.contactId)
            else if (!emails.has(m.email)) emails.set(m.email, { email: m.email, name: m.name })
        }
    }
    return {
        contactIds: [...contactIds],
        externalEmails: [...emails.values()],
    }
}

/**
 * Legacy: union of CRM contact IDs across lists. External emails are
 * dropped — use unionMembers() for full coverage.
 */
export async function unionMemberIds(
    workspaceId: string,
    listIds: string[],
    limitPerList = 5000,
): Promise<string[]> {
    const { contactIds } = await unionMembers(workspaceId, listIds, limitPerList)
    return contactIds
}

export async function countMembers(
    workspaceId: string,
    listId: string,
): Promise<number> {
    const listRef = adminDb.collection("contact_lists").doc(listId)
    const listDoc = await listRef.get()
    if (!listDoc.exists) return 0
    if (listDoc.data()?.workspaceId !== workspaceId) return 0
    // Firestore's count() aggregation is efficient; fall back to list length
    // if the SDK's count aggregation isn't available in this runtime.
    try {
        const agg = await listRef.collection("members").count().get()
        return agg.data().count
    } catch {
        const snap = await listRef.collection("members").limit(10_000).get()
        return snap.size
    }
}
