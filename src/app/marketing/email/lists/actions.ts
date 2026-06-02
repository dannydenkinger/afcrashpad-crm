"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import {
    addContactsToList,
    addEmailsToList,
    createList,
    deleteList,
    listMemberIds,
    removeContactsFromList,
    removeMembersById,
    updateList,
} from "@/lib/lists/contact-lists"
import { fireTrigger } from "@/lib/automations/triggers"
import { getWorkspacePlan } from "@/lib/billing/plans-server"
import { PLANS } from "@/lib/billing/plans"

async function resolveContext() {
    const session = await requireAuth()
    const user = session.user as { id: string; workspaceId: string }
    return { workspaceId: user.workspaceId, userId: user.id }
}

// Loose passthrough for rules — the lib + UI know the discriminated union;
// the action just trusts the client and the lib re-validates on read.
const ruleSchema = z.object({
    field: z.enum(["tag", "list", "status", "email", "engagement", "created"]),
    op: z.string(),
    value: z.string().optional(),
    daysWindow: z.number().int().positive().optional(),
}).passthrough()

const saveListSchema = z.object({
    id: z.string().optional(),
    /** Required on create, optional on update. The lib enforces non-empty on create. */
    name: z.string().max(120).optional(),
    description: z.string().max(500).optional(),
    type: z.enum(["static", "smart"]).optional(),
    rules: z.array(ruleSchema).max(20).optional(),
    combinator: z.enum(["and", "or"]).optional(),
})

export async function saveListAction(input: z.infer<typeof saveListSchema>) {
    const { workspaceId, userId } = await resolveContext()
    const parsed = saveListSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    try {
        if (parsed.data.id) {
            const updated = await updateList(workspaceId, parsed.data.id, {
                name: parsed.data.name,
                description: parsed.data.description,
                rules: parsed.data.rules as Parameters<typeof updateList>[2]["rules"],
                combinator: parsed.data.combinator,
            })
            revalidatePath("/marketing/email/lists")
            revalidatePath(`/marketing/email/lists/${updated.id}`)
            return { success: true, list: updated }
        }
        if (!parsed.data.name?.trim()) {
            return { success: false, error: "Name is required" }
        }
        const created = await createList({
            workspaceId,
            name: parsed.data.name,
            description: parsed.data.description,
            type: parsed.data.type,
            rules: parsed.data.rules as Parameters<typeof createList>[0]["rules"],
            combinator: parsed.data.combinator,
            createdBy: userId,
        })
        revalidatePath("/marketing/email/lists")
        return { success: true, list: created }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save list"
        return { success: false, error: message }
    }
}

export async function deleteListAction(listId: string) {
    const { workspaceId } = await resolveContext()
    try {
        await deleteList(workspaceId, listId)
        revalidatePath("/marketing/email/lists")
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete list"
        return { success: false, error: message }
    }
}

const memberOpSchema = z.object({
    listId: z.string().min(1),
    contactIds: z.array(z.string().min(1)).min(1).max(500),
})

export async function addContactsAction(input: z.infer<typeof memberOpSchema>) {
    const { workspaceId } = await resolveContext()
    const parsed = memberOpSchema.safeParse(input)
    if (!parsed.success) {
        return {
            success: false,
            error: parsed.error.issues[0]?.message ?? "Invalid input",
            added: 0,
            alreadyPresent: 0,
        }
    }
    try {
        const result = await addContactsToList(
            workspaceId,
            parsed.data.listId,
            parsed.data.contactIds,
        )
        // Fire trigger for each newly-added contact (skip already-present)
        for (const contactId of parsed.data.contactIds) {
            fireTrigger({
                workspaceId,
                type: "contact_added_to_list",
                contactId,
                match: { listId: parsed.data.listId },
            }).catch(() => {})
        }
        revalidatePath(`/marketing/email/lists/${parsed.data.listId}`)
        revalidatePath("/marketing/email/lists")
        return { success: true, error: null, ...result }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add contacts"
        return { success: false, error: message, added: 0, alreadyPresent: 0 }
    }
}

export async function removeContactsAction(input: z.infer<typeof memberOpSchema>) {
    const { workspaceId } = await resolveContext()
    const parsed = memberOpSchema.safeParse(input)
    if (!parsed.success) {
        return {
            success: false,
            error: "Invalid input",
            removed: 0,
        }
    }
    try {
        const result = await removeContactsFromList(
            workspaceId,
            parsed.data.listId,
            parsed.data.contactIds,
        )
        revalidatePath(`/marketing/email/lists/${parsed.data.listId}`)
        revalidatePath("/marketing/email/lists")
        return { success: true, error: null, ...result }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to remove contacts"
        return { success: false, error: message, removed: 0 }
    }
}

const searchSchema = z.object({
    query: z.string().max(200),
    listId: z.string().optional(),
    limit: z.number().int().positive().max(50).optional(),
})

/**
 * Search contacts, optionally filtering out those already in a given list
 * (so the picker doesn't offer duplicates).
 */
export async function searchContactsForListAction(
    input: z.infer<typeof searchSchema>,
) {
    const { workspaceId } = await resolveContext()
    const parsed = searchSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid query", contacts: [] }

    const q = parsed.data.query.trim().toLowerCase()
    const limit = parsed.data.limit ?? 20

    try {
        // Pull a page of contacts (Firestore can't do real full-text search)
        const snap = await adminDb
            .collection("contacts")
            .where("workspaceId", "==", workspaceId)
            .orderBy("createdAt", "desc")
            .limit(1000)
            .get()

        const all = snap.docs.map((d) => {
            const data = d.data()
            return {
                id: d.id,
                name: (data.name as string) || "",
                email: (data.email as string) || "",
            }
        })

        let filtered = q
            ? all.filter(
                  (c) =>
                      c.name.toLowerCase().includes(q) ||
                      c.email.toLowerCase().includes(q),
              )
            : all

        // Exclude existing list members if a listId was provided
        if (parsed.data.listId) {
            const memberIds = new Set(
                await listMemberIds(workspaceId, parsed.data.listId, 10_000),
            )
            filtered = filtered.filter((c) => !memberIds.has(c.id))
        }

        const sorted = [...filtered].sort((a, b) => {
            const an = (a.name || a.email).toLowerCase()
            const bn = (b.name || b.email).toLowerCase()
            return an.localeCompare(bn)
        })

        return { success: true, contacts: sorted.slice(0, limit) }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed"
        return { success: false, error: message, contacts: [] }
    }
}

const importEmailsSchema = z.object({
    listId: z.string().min(1),
    rows: z
        .array(
            z.object({
                email: z.string().min(3),
                name: z.string().max(200).optional(),
            }),
        )
        .min(1)
        .max(20_000),
    alsoCreateContacts: z.boolean().optional(),
})

/**
 * Import emails from a CSV into a list. By default these are EXTERNAL
 * members — they live only on the list, not in the CRM contacts collection.
 * Pass alsoCreateContacts=true to additionally upsert each email as a CRM
 * contact and link the membership to that contact.
 */
export async function importEmailsToListAction(
    input: z.infer<typeof importEmailsSchema>,
) {
    const { workspaceId, userId } = await resolveContext()
    const parsed = importEmailsSchema.safeParse(input)
    if (!parsed.success) {
        return {
            success: false,
            error: parsed.error.issues[0]?.message ?? "Invalid input",
            added: 0,
            alreadyPresent: 0,
            invalid: 0,
            contactsCreated: 0,
        }
    }

    try {
        const rows = parsed.data.rows

        if (!parsed.data.alsoCreateContacts) {
            // Pure external import — fastest path, no CRM writes.
            const result = await addEmailsToList(
                workspaceId,
                parsed.data.listId,
                rows,
            )
            revalidatePath(`/marketing/email/lists/${parsed.data.listId}`)
            revalidatePath("/marketing/email/lists")
            return {
                success: true,
                error: null,
                ...result,
                contactsCreated: 0,
            }
        }

        // alsoCreateContacts: dedupe by email against existing CRM contacts,
        // create new contacts for emails not yet in the CRM, then add the
        // resulting contact IDs as CRM members of the list.
        const normalized = new Map<string, { email: string; name?: string }>()
        for (const r of rows) {
            const email = r.email.trim().toLowerCase()
            if (!email) continue
            if (!normalized.has(email)) {
                normalized.set(email, { email, name: r.name?.trim() || undefined })
            }
        }
        const uniqueEmails = [...normalized.keys()]

        const emailToContactId = new Map<string, string>()
        const softDeletedRefs: FirebaseFirestore.DocumentReference[] = []
        for (let i = 0; i < uniqueEmails.length; i += 30) {
            const chunk = uniqueEmails.slice(i, i + 30)
            const snap = await adminDb
                .collection("contacts")
                .where("workspaceId", "==", workspaceId)
                .where("email", "in", chunk)
                .get()
            for (const d of snap.docs) {
                const e = ((d.data().email as string) ?? "").toLowerCase()
                if (!e) continue
                emailToContactId.set(e, d.id)
                if (d.data().deletedAt) softDeletedRefs.push(d.ref)
            }
        }

        const toCreate = uniqueEmails.filter((e) => !emailToContactId.has(e))

        const plan = await getWorkspacePlan(workspaceId)
        const cap = PLANS[plan.tier].limits.contactsCap
        if (cap != null) {
            const liveSnap = await adminDb
                .collection("contacts")
                .where("workspaceId", "==", workspaceId)
                .get()
            const liveCount = liveSnap.docs.filter((d) => !d.data().deletedAt).length
            if (liveCount + toCreate.length + softDeletedRefs.length > cap) {
                return {
                    success: false,
                    error: `Importing would exceed your plan's contact limit (${cap.toLocaleString()}). You currently have ${liveCount.toLocaleString()} contacts.`,
                    added: 0,
                    alreadyPresent: 0,
                    invalid: 0,
                    contactsCreated: 0,
                }
            }
        }

        const now = new Date()
        let contactsCreated = 0
        const CREATE_BATCH = 450
        for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
            const chunk = toCreate.slice(i, i + CREATE_BATCH)
            const batch = adminDb.batch()
            for (const email of chunk) {
                const row = normalized.get(email)!
                const ref = adminDb.collection("contacts").doc()
                batch.set(ref, {
                    workspaceId,
                    name: row.name ?? "",
                    email: row.email,
                    phone: null,
                    status: "Lead",
                    source: "csv-import",
                    createdBy: userId,
                    createdAt: now,
                    updatedAt: now,
                })
                emailToContactId.set(email, ref.id)
                contactsCreated += 1
            }
            await batch.commit()
        }

        for (let i = 0; i < softDeletedRefs.length; i += CREATE_BATCH) {
            const chunk = softDeletedRefs.slice(i, i + CREATE_BATCH)
            const batch = adminDb.batch()
            for (const ref of chunk) {
                batch.update(ref, { deletedAt: null, updatedAt: now })
            }
            await batch.commit()
        }

        // Add the contact IDs as CRM members of the list
        const allContactIds = uniqueEmails
            .map((e) => emailToContactId.get(e))
            .filter((id): id is string => !!id)
        const memberResult = await addContactsToList(
            workspaceId,
            parsed.data.listId,
            allContactIds,
        )

        revalidatePath(`/marketing/email/lists/${parsed.data.listId}`)
        revalidatePath("/marketing/email/lists")
        revalidatePath("/contacts")

        return {
            success: true,
            error: null,
            added: memberResult.added,
            alreadyPresent: memberResult.alreadyPresent,
            invalid: rows.length - uniqueEmails.length,
            contactsCreated,
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed"
        return {
            success: false,
            error: message,
            added: 0,
            alreadyPresent: 0,
            invalid: 0,
            contactsCreated: 0,
        }
    }
}

const removeMembersSchema = z.object({
    listId: z.string().min(1),
    memberIds: z.array(z.string().min(1)).min(1).max(500),
})

/**
 * Remove members by their member doc ID. Works for both CRM-linked and
 * CSV-imported (external email) members.
 */
export async function removeMembersAction(
    input: z.infer<typeof removeMembersSchema>,
) {
    const { workspaceId } = await resolveContext()
    const parsed = removeMembersSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: "Invalid input", removed: 0 }
    }
    try {
        const result = await removeMembersById(
            workspaceId,
            parsed.data.listId,
            parsed.data.memberIds,
        )
        revalidatePath(`/marketing/email/lists/${parsed.data.listId}`)
        revalidatePath("/marketing/email/lists")
        return { success: true, error: null, ...result }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to remove"
        return { success: false, error: message, removed: 0 }
    }
}
