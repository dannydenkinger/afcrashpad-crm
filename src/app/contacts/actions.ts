"use server"

import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createNotification } from "@/app/notifications/actions";
import { logAudit } from "@/lib/audit";
import { triggerSequence } from "@/lib/email-sequences";
import { softDelete, restoreItem, permanentlyDelete } from "@/lib/soft-delete";
import { captureError } from "@/lib/error-tracking";
import type { TimelineItem, DuplicateContact, DuplicateGroup } from "./types";
import { getCachedStageNames } from "@/lib/cached-queries";

/**
 * Consolidated page-data fetch: returns contacts + statuses + tags + users
 * in a single server action call (saves 3-4 HTTP round trips on page load).
 */
export async function getContactsPageData(options?: { limit?: number; lastDocId?: string }) {
    try {
        const [contactsResult, statusesResult, tagsResult, usersResult] = await Promise.all([
            getContactsPaginated(options),
            (async () => {
                const snap = await adminDb.collection('contact_statuses').orderBy('order', 'asc').get();
                return snap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
            })(),
            (async () => {
                const snap = await adminDb.collection('tags').orderBy('name', 'asc').get();
                return snap.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name || "",
                    color: doc.data().color || "",
                }));
            })(),
            (async () => {
                const snap = await adminDb.collection('users').orderBy('name', 'asc').get();
                return snap.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                    email: doc.data().email,
                }));
            })(),
        ]);

        return {
            success: true,
            contacts: contactsResult.success ? contactsResult.contacts : [],
            lastDocId: contactsResult.success ? contactsResult.lastDocId : null,
            hasMore: contactsResult.success ? contactsResult.hasMore : false,
            contactStatuses: statusesResult,
            tags: tagsResult,
            users: usersResult,
        };
    } catch (error: any) {
        console.error("Failed to fetch contacts page data:", error);
        return {
            success: false,
            contacts: [],
            lastDocId: null,
            hasMore: false,
            contactStatuses: [],
            tags: [],
            users: [],
        };
    }
}

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const firestoreIdSchema = z.string().min(1).max(128);

const createNoteSchema = z.object({
    contactId: firestoreIdSchema,
    content: z.string().min(1).max(10000),
    options: z.object({
        opportunityId: z.string().optional(),
        source: z.string().max(50).optional(),
        mentions: z.array(z.object({
            userId: z.string().min(1).max(128),
            userName: z.string().min(1).max(200),
        })).optional(),
    }).optional(),
});

const getNotesSchema = z.object({ contactId: firestoreIdSchema });

const deleteNoteSchema = z.object({
    contactId: firestoreIdSchema,
    noteId: firestoreIdSchema,
});

const getContactTimelineSchema = z.object({ contactId: firestoreIdSchema });

const createContactSchema = z.object({
    name: z.string().max(200).optional(),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    phone: z.string().max(50).optional().or(z.literal("")).nullable(),
    militaryBase: z.string().max(200).optional().or(z.literal("")).nullable(),
    businessName: z.string().max(200).optional().or(z.literal("")).nullable(),
    status: z.string().max(50).optional(),
    stayStartDate: z.string().optional().or(z.literal("")).nullable(),
    stayEndDate: z.string().optional().or(z.literal("")).nullable(),
    tags: z.array(z.string()).optional(),
});

const updateContactSchema = z.object({
    name: z.string().max(200).optional(),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    phone: z.string().max(50).optional().or(z.literal("")).nullable(),
    militaryBase: z.string().max(200).optional().or(z.literal("")).nullable(),
    businessName: z.string().max(200).optional().or(z.literal("")).nullable(),
    status: z.string().max(50).optional(),
    stayStartDate: z.string().optional().or(z.literal("")).nullable(),
    stayEndDate: z.string().optional().or(z.literal("")).nullable(),
    tags: z.array(z.string()).optional(),
});

const getContactDetailSchema = z.object({ id: firestoreIdSchema });
const deleteContactSchema = z.object({ id: firestoreIdSchema });

const updateFormTrackingSchema = z.object({
    contactId: firestoreIdSchema,
    data: z.record(z.string(), z.unknown()),
});

const bulkDeleteContactsSchema = z.object({
    ids: z.array(firestoreIdSchema).min(1).max(500),
});

const bulkUpdateStatusSchema = z.object({
    ids: z.array(firestoreIdSchema).min(1).max(500),
    status: z.string().min(1).max(50),
});

const bulkAddTagSchema = z.object({
    ids: z.array(firestoreIdSchema).min(1).max(500),
    tag: z.string().min(1).max(100),
});

const bulkCreateContactsSchema = z.object({
    contacts: z.array(z.object({
        name: z.string().max(200).optional(),
        email: z.string().email().optional().or(z.literal("")).nullable(),
        phone: z.string().max(50).optional().or(z.literal("")).nullable(),
        militaryBase: z.string().max(200).optional().or(z.literal("")).nullable(),
        businessName: z.string().max(200).optional().or(z.literal("")).nullable(),
        status: z.string().max(50).optional(),
    })).min(1).max(500),
});

const mergeContactsSchema = z.object({
    primaryId: firestoreIdSchema,
    secondaryId: firestoreIdSchema,
    fieldOverrides: z.record(z.string(), z.string()).optional(),
});

// Shared timestamp serializer
function toISO(v: unknown): string | null {
    if (!v) return null;
    if (typeof v === "string") return v;
    if ((v as any)?.toDate) return (v as any).toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "object" && v !== null && typeof (v as any)._seconds === "number") {
        return new Date((v as any)._seconds * 1000).toISOString();
    }
    return null;
}

export async function getContactsPaginated(options?: { limit?: number; lastDocId?: string }) {
    const pageSize = options?.limit ?? 50;
    const lastDocId = options?.lastDocId;

    try {
        // Fetch pipelines, opportunities, stages, and notes in parallel (avoid N+1)
        let contactsQuery = adminDb.collection('contacts').orderBy('createdAt', 'desc');

        // If resuming from a cursor, start after the last document
        if (lastDocId) {
            const lastDoc = await adminDb.collection('contacts').doc(lastDocId).get();
            if (lastDoc.exists) {
                contactsQuery = contactsQuery.startAfter(lastDoc);
            }
        }

        // Fetch one extra to check if there are more
        contactsQuery = contactsQuery.limit(pageSize + 1);

        // Use cached stage names + parallel Firestore reads
        const [stageNamesMap, snapshot, oppsSnap] = await Promise.all([
            getCachedStageNames(),
            contactsQuery.get(),
            adminDb.collection('opportunities').get(),
        ]);

        // Group opportunities by contactId (in-memory join), excluding soft-deleted
        const oppsByContact: Record<string, any[]> = {};
        for (const oppDoc of oppsSnap.docs) {
            const d = oppDoc.data();
            if (d.deletedAt) continue;
            const contactId = d.contactId;
            if (!contactId) continue;
            if (!oppsByContact[contactId]) oppsByContact[contactId] = [];

            const o: Record<string, unknown> = { id: oppDoc.id, ...d };
            if (d.createdAt) o.createdAt = toISO(d.createdAt);
            if (d.updatedAt) o.updatedAt = toISO(d.updatedAt);
            if (d.stayStartDate) o.stayStartDate = toISO(d.stayStartDate);
            if (d.stayEndDate) o.stayEndDate = toISO(d.stayEndDate);
            if (d.unreadAt) o.unreadAt = toISO(d.unreadAt);
            if (d.lastSeenAt) o.lastSeenAt = toISO(d.lastSeenAt);
            if (d.claimedAt) o.claimedAt = toISO(d.claimedAt);
            if (d.pipelineStageId && stageNamesMap[d.pipelineStageId]) o.stageName = stageNamesMap[d.pipelineStageId];
            if (Array.isArray(d.stageHistory)) {
                o.stageHistory = d.stageHistory.map((entry: any) => ({
                    stageId: entry.stageId,
                    enteredAt: toISO(entry.enteredAt),
                }));
            }
            oppsByContact[contactId].push(o);
        }

        // Check if there are more results
        const allDocs = snapshot.docs.filter(doc => !doc.data().deletedAt);

        // Pre-fetch latest note per visible contact in parallel (avoid fetching ALL notes)
        const latestNoteByContact: Record<string, any> = {};
        const hasMore = allDocs.length > pageSize;
        const pageDocs = hasMore ? allDocs.slice(0, pageSize) : allDocs;
        try {
            const noteResults = await Promise.all(
                pageDocs.map(async (doc) => {
                    const notesSnap = await adminDb.collection('contacts').doc(doc.id).collection('notes')
                        .orderBy('createdAt', 'desc').limit(1).get();
                    if (!notesSnap.empty) {
                        const nDoc = notesSnap.docs[0];
                        const nd = nDoc.data();
                        return { cid: doc.id, note: { id: nDoc.id, content: nd.content, contactId: nd.contactId || doc.id, createdAt: toISO(nd.createdAt), updatedAt: toISO(nd.updatedAt) } };
                    }
                    return { cid: doc.id, note: null };
                })
            );
            for (const { cid, note } of noteResults) {
                if (note) latestNoteByContact[cid] = note;
            }
        } catch (notesError) {
            console.error("Failed to fetch notes for page:", notesError);
        }
        const nextLastDocId = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

        const contacts = pageDocs.map(doc => {
            const data = doc.data();
            if (data.stayStartDate) {
                data.stayStartDate = data.stayStartDate.toDate ? data.stayStartDate.toDate().toISOString() : data.stayStartDate;
            }
            if (data.stayEndDate) {
                data.stayEndDate = data.stayEndDate.toDate ? data.stayEndDate.toDate().toISOString() : data.stayEndDate;
            }
            if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate().toISOString();
            if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate().toISOString();

            const latestNote = latestNoteByContact[doc.id];

            // Sanitize tags to plain objects (strip Firestore Timestamps)
            const tags = Array.isArray(data.tags) ? data.tags.map((t: any) => ({
                tagId: t.tagId || null, name: t.name || null, color: t.color || null,
            })) : [];

            return {
                id: doc.id,
                ...data,
                opportunities: oppsByContact[doc.id] || [],
                notes: latestNote ? [latestNote] : [],
                tags,
            };
        });

        return { success: true, contacts, hasMore, lastDocId: nextLastDocId };
    } catch (error) {
        console.error("Failed to fetch contacts:", error);
        return { success: false, error: "Failed to fetch contacts", contacts: [], hasMore: false, lastDocId: null };
    }
}

export async function getContacts() {
    try {
        // Use cached stage names + parallel Firestore reads
        const [stageNamesMap, snapshot, oppsSnap] = await Promise.all([
            getCachedStageNames(),
            adminDb.collection('contacts').orderBy('createdAt', 'desc').get(),
            adminDb.collection('opportunities').get(),
        ]);

        // Group opportunities by contactId (in-memory join), excluding soft-deleted
        const oppsByContact: Record<string, any[]> = {};
        for (const oppDoc of oppsSnap.docs) {
            const d = oppDoc.data();
            if (d.deletedAt) continue;
            const contactId = d.contactId;
            if (!contactId) continue;
            if (!oppsByContact[contactId]) oppsByContact[contactId] = [];

            const o: Record<string, unknown> = { id: oppDoc.id, ...d };
            if (d.createdAt) o.createdAt = toISO(d.createdAt);
            if (d.updatedAt) o.updatedAt = toISO(d.updatedAt);
            if (d.stayStartDate) o.stayStartDate = toISO(d.stayStartDate);
            if (d.stayEndDate) o.stayEndDate = toISO(d.stayEndDate);
            if (d.unreadAt) o.unreadAt = toISO(d.unreadAt);
            if (d.lastSeenAt) o.lastSeenAt = toISO(d.lastSeenAt);
            if (d.claimedAt) o.claimedAt = toISO(d.claimedAt);
            if (d.pipelineStageId && stageNamesMap[d.pipelineStageId]) o.stageName = stageNamesMap[d.pipelineStageId];
            if (Array.isArray(d.stageHistory)) {
                o.stageHistory = d.stageHistory.map((entry: any) => ({
                    stageId: entry.stageId,
                    enteredAt: toISO(entry.enteredAt),
                }));
            }
            oppsByContact[contactId].push(o);
        }

        // Pre-fetch latest note per contact in parallel (avoid fetching ALL notes)
        const allDocs = snapshot.docs.filter(doc => !doc.data().deletedAt);
        const latestNoteByContact: Record<string, any> = {};
        try {
            const noteResults = await Promise.all(
                allDocs.map(async (doc) => {
                    const notesSnap = await adminDb.collection('contacts').doc(doc.id).collection('notes')
                        .orderBy('createdAt', 'desc').limit(1).get();
                    if (!notesSnap.empty) {
                        const nDoc = notesSnap.docs[0];
                        const nd = nDoc.data();
                        return { cid: doc.id, note: { id: nDoc.id, content: nd.content, contactId: nd.contactId || doc.id, createdAt: toISO(nd.createdAt), updatedAt: toISO(nd.updatedAt) } };
                    }
                    return { cid: doc.id, note: null };
                })
            );
            for (const { cid, note } of noteResults) {
                if (note) latestNoteByContact[cid] = note;
            }
        } catch (notesError) {
            console.error("Failed to fetch notes:", notesError);
        }

        const contacts = allDocs.map(doc => {
            const data = doc.data();

            // Format dates
            if (data.stayStartDate) {
                data.stayStartDate = data.stayStartDate.toDate ? data.stayStartDate.toDate().toISOString() : data.stayStartDate;
            }
            if (data.stayEndDate) {
                data.stayEndDate = data.stayEndDate.toDate ? data.stayEndDate.toDate().toISOString() : data.stayEndDate;
            }
            if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate().toISOString();
            if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate().toISOString();

            const latestNote = latestNoteByContact[doc.id];

            // Sanitize tags to plain objects (strip Firestore Timestamps)
            const tags = Array.isArray(data.tags) ? data.tags.map((t: any) => ({
                tagId: t.tagId || null, name: t.name || null, color: t.color || null,
            })) : [];

            return {
                id: doc.id,
                ...data,
                opportunities: oppsByContact[doc.id] || [],
                notes: latestNote ? [latestNote] : [],
                tags,
            };
        });

        return { success: true, contacts };
    } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)), { action: "getContacts" });
        return { success: false, error: "Failed to fetch contacts" };
    }
}

/** Create a note on the contact. Notes added from an opportunity are also visible on the contact (GHL-style). */
export async function createNote(contactId: string, content: string, options?: { opportunityId?: string; source?: string; mentions?: { userId: string; userName: string }[] }) {
    const parsed = createNoteSchema.safeParse({ contactId, content, options });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    contactId = parsed.data.contactId;
    content = parsed.data.content;
    options = parsed.data.options;

    try {
        const session = await auth();
        const authorName = session?.user?.name ?? session?.user?.email ?? "Unknown";
        const authorId = (session?.user as any)?.id ?? null;

        const data: Record<string, unknown> = {
            content,
            contactId,
            authorName,
            authorId,
            mentions: options?.mentions ?? [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        if (options?.opportunityId) data.opportunityId = options.opportunityId;
        if (options?.source) data.source = options.source;
        await adminDb.collection('contacts').doc(contactId).collection('notes').add(data);

        // Send notification for each mentioned user
        if (options?.mentions?.length) {
            const contactDoc = await adminDb.collection('contacts').doc(contactId).get();
            const contactName = contactDoc.data()?.name ?? "a contact";
            for (const mention of options.mentions) {
                createNotification({
                    title: `${authorName} mentioned you in a note`,
                    message: `You were mentioned in a note on ${contactName}: "${content.slice(0, 100)}${content.length > 100 ? "..." : ""}"`,
                    type: "mention",
                    linkUrl: `/contacts?id=${contactId}`,
                    dedupeKey: `mention-${contactId}-${mention.userId}-${Date.now()}`,
                }).catch(() => {});
            }
        }

        revalidatePath("/contacts");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to create note:", error);
        return { success: false, error: "Failed to create note" };
    }
}

/** Convert any date-like value to ISO string for RSC serialization (plain objects + Timestamps). */
// Alias for backward compatibility within this file
const tsToISO = toISO;

export async function getNotes(contactId: string) {
    const parsed = getNotesSchema.safeParse({ contactId });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    contactId = parsed.data.contactId;

    try {
        const notesSnapshot = await adminDb.collection('contacts').doc(contactId).collection('notes')
            .orderBy('createdAt', 'desc')
            .get();
            
        const notes = notesSnapshot.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                content: d.content,
                contactId: d.contactId,
                authorName: d.authorName ?? null,
                authorId: d.authorId ?? null,
                mentions: d.mentions ?? [],
                createdAt: tsToISO(d.createdAt),
                updatedAt: tsToISO(d.updatedAt),
            };
        });
        
        return { success: true, notes };
    } catch (error) {
        console.error("Failed to fetch notes:", error);
        return { success: false, error: "Failed to fetch notes" };
    }
}

/** Update an existing note's content and mentions. */
export async function updateNote(contactId: string, noteId: string, content: string, mentions?: { userId: string; userName: string }[]) {
    if (!contactId || !noteId || !content?.trim()) return { success: false, error: "Invalid input" };

    try {
        const session = await auth();
        const editorName = session?.user?.name ?? session?.user?.email ?? "Unknown user";
        const editorId = (session?.user as any)?.id ?? null;

        const noteRef = adminDb.collection('contacts').doc(contactId).collection('notes').doc(noteId);
        const noteSnap = await noteRef.get();
        if (!noteSnap.exists) return { success: false, error: "Note not found" };

        await noteRef.update({
            content: content.trim(),
            mentions: mentions ?? [],
            updatedAt: new Date(),
        });

        // Record edit in timeline
        await adminDb.collection('contacts').doc(contactId).collection('timeline').add({
            type: "note_edited",
            noteId,
            contentPreview: content.trim().slice(0, 120) + (content.trim().length > 120 ? "…" : ""),
            editedById: editorId,
            editedByName: editorName,
            createdAt: new Date(),
        });

        revalidatePath("/contacts");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to update note:", error);
        return { success: false, error: "Failed to update note" };
    }
}

/** Delete a note and record a "note_deleted" event in the contact timeline (includes who deleted it). */
export async function deleteNote(contactId: string, noteId: string) {
    const parsed = deleteNoteSchema.safeParse({ contactId, noteId });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    contactId = parsed.data.contactId;
    noteId = parsed.data.noteId;

    try {
        const session = await auth();
        const deletedByName = session?.user?.name ?? session?.user?.email ?? "Unknown user";
        const deletedById = (session?.user as any)?.id ?? null;

        const noteRef = adminDb.collection('contacts').doc(contactId).collection('notes').doc(noteId);
        const noteSnap = await noteRef.get();
        if (!noteSnap.exists) return { success: false, error: "Note not found" };

        const content = (noteSnap.data()?.content as string) || "";
        const contentPreview = content.slice(0, 120) + (content.length > 120 ? "…" : "");

        await noteRef.delete();
        await adminDb.collection('contacts').doc(contactId).collection('timeline').add({
            type: "note_deleted",
            noteId,
            contentPreview: contentPreview || null,
            deletedById,
            deletedByName,
            createdAt: new Date(),
        });

        revalidatePath("/contacts");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete note:", error);
        return { success: false, error: "Failed to delete note" };
    }
}

/** Fetch contact timeline: messages + notes + timeline events (e.g. note_deleted), sorted by date desc. */
export async function getContactTimeline(contactId: string): Promise<{ success: boolean; timeline?: TimelineItem[]; error?: string }> {
    const parsed = getContactTimelineSchema.safeParse({ contactId });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    contactId = parsed.data.contactId;

    try {
        const contactRef = adminDb.collection('contacts').doc(contactId);
        const [notesSnap, messagesSnap, timelineSnap] = await Promise.all([
            contactRef.collection('notes').orderBy('createdAt', 'desc').get(),
            contactRef.collection('messages').orderBy('createdAt', 'desc').get(),
            contactRef.collection('timeline').orderBy('createdAt', 'desc').get(),
        ]);

        const items: TimelineItem[] = [];

        notesSnap.docs.forEach(d => {
            const data = d.data();
            items.push({
                kind: "note",
                id: d.id,
                content: data.content ?? "",
                authorName: data.authorName ?? null,
                authorId: data.authorId ?? null,
                mentions: data.mentions ?? [],
                createdAt: tsToISO(data.createdAt) ?? new Date().toISOString(),
            });
        });
        messagesSnap.docs.forEach(d => {
            const data = d.data();
            items.push({
                kind: "message",
                id: d.id,
                type: data.type ?? "MESSAGE",
                direction: data.direction,
                content: data.content ?? "",
                createdAt: tsToISO(data.createdAt) ?? new Date().toISOString(),
            });
        });
        timelineSnap.docs.forEach(d => {
            const data = d.data();
            if (data.type === "note_deleted") {
                items.push({
                    kind: "note_deleted",
                    id: d.id,
                    noteId: data.noteId ?? "",
                    contentPreview: data.contentPreview ?? null,
                    deletedBy: data.deletedByName ?? data.deletedById ?? null,
                    createdAt: tsToISO(data.createdAt) ?? new Date().toISOString(),
                });
            }
        });

        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return { success: true, timeline: items };
    } catch (error) {
        console.error("Failed to fetch contact timeline:", error);
        return { success: false, error: "Failed to fetch contact timeline" };
    }
}

export async function createContact(data: any) {
    const parsed = createContactSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Invalid input" };
    data = parsed.data;

    try {
        const { tags, ...otherData } = data;
        const newContactRef = adminDb.collection('contacts').doc();

        const contactData: any = {
            name: otherData.name ?? '',
            email: otherData.email ?? null,
            phone: otherData.phone ?? null,
            militaryBase: otherData.militaryBase ?? null,
            businessName: otherData.businessName ?? null,
            status: otherData.status || 'Lead',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        if (otherData.stayStartDate) contactData.stayStartDate = new Date(otherData.stayStartDate).toISOString();
        if (otherData.stayEndDate) contactData.stayEndDate = new Date(otherData.stayEndDate).toISOString();

        if (tags !== undefined) {
            contactData.tags = await Promise.all(tags.map(async (tagId: string) => {
                const tagDoc = await adminDb.collection('tags').doc(tagId).get();
                return { tagId, name: tagDoc.data()?.name, color: tagDoc.data()?.color };
            }));
        }

        await newContactRef.set(contactData);
        revalidatePath("/contacts");

        // Fire a notification for the team
        await createNotification({
            title: "New contact created",
            message: contactData.name || contactData.email || "New contact",
            type: "contact",
            linkUrl: "/contacts"
        });

        const session = await auth();
        if (session?.user) {
            logAudit({
                userId: (session.user as any).id || "",
                userEmail: session.user.email || "",
                userName: session.user.name || "",
                action: "create",
                entity: "contact",
                entityId: newContactRef.id,
                entityName: contactData.name || contactData.email || "",
            }).catch(() => {});
        }

        // Trigger new_contact email sequence
        if (contactData.email) {
            triggerSequence("new_contact", newContactRef.id, contactData.email, contactData.name).catch(() => {});
        }

        return { success: true, id: newContactRef.id };
    } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)), { action: "createContact" });
        return { success: false, error: "Failed to create contact" };
    }
}

export async function updateContact(id: string, data: any) {
    const idParsed = firestoreIdSchema.safeParse(id);
    if (!idParsed.success) return { success: false, error: "Invalid input" };
    const dataParsed = updateContactSchema.safeParse(data);
    if (!dataParsed.success) return { success: false, error: "Invalid input" };
    data = dataParsed.data;

    try {
        const { tags, ...otherData } = data;
        const updateData: any = { updatedAt: new Date() };

        // Only include defined, non-undefined fields (Firestore rejects undefined)
        const allowedKeys = ['name', 'email', 'phone', 'militaryBase', 'businessName', 'status', 'stayStartDate', 'stayEndDate'];
        for (const k of allowedKeys) {
            if (otherData[k] !== undefined) {
                let val = otherData[k];
                if (k === 'stayStartDate' || k === 'stayEndDate') {
                    if (val == null || (typeof val === 'string' && !val.trim())) {
                        val = null;
                    } else if (typeof val === 'string') {
                        const d = new Date(val);
                        val = isNaN(d.getTime()) ? null : d.toISOString();
                    }
                }
                updateData[k] = val;
            }
        }

        if (tags !== undefined && Array.isArray(tags)) {
            updateData.tags = await Promise.all(tags.map(async (tagId: string) => {
                const tagDoc = await adminDb.collection('tags').doc(tagId).get();
                return { tagId, name: tagDoc.data()?.name, color: tagDoc.data()?.color };
            }));
        }

        await adminDb.collection('contacts').doc(id).update(updateData);

        const session = await auth();
        if (session?.user) {
            logAudit({
                userId: (session.user as any).id || "",
                userEmail: session.user.email || "",
                userName: session.user.name || "",
                action: "update",
                entity: "contact",
                entityId: id,
                entityName: updateData.name || "",
            }).catch(() => {});
        }

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        console.error("Failed to update contact:", error);
        return { success: false, error: "Failed to update contact" };
    }
}

/** Lightweight list for contact picker (e.g. pipeline "Add opportunity → Select existing contact"). */
export async function getContactsList() {
    try {
        const snapshot = await adminDb.collection('contacts').orderBy('createdAt', 'desc').limit(500).get();
        const contacts = snapshot.docs.filter(doc => !doc.data().deletedAt).map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                name: d.name ?? "",
                email: d.email ?? "",
                phone: d.phone ?? "",
                militaryBase: d.militaryBase ?? ""
            };
        });
        return { success: true, contacts };
    } catch (error) {
        console.error("Failed to fetch contacts list:", error);
        return { success: false, contacts: [] };
    }
}

export async function getContactDetail(id: string) {
    const parsed = getContactDetailSchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    id = parsed.data.id;

    try {
        const doc = await adminDb.collection('contacts').doc(id).get();
        if (!doc.exists) throw new Error("Contact not found");

        const data = doc.data() || {};
        
        // Fetch subcollections (timeline = events like note_deleted)
        const [notesSnap, tasksSnap, messagesSnap, docsSnap, oppsSnap, timelineSnap] = await Promise.all([
            doc.ref.collection('notes').orderBy('createdAt', 'desc').limit(50).get(),
            doc.ref.collection('tasks').orderBy('dueDate', 'asc').get(),
            doc.ref.collection('messages').orderBy('createdAt', 'desc').limit(100).get(),
            doc.ref.collection('documents').orderBy('createdAt', 'desc').limit(50).get(),
            adminDb.collection('opportunities').where('contactId', '==', id).get(),
            doc.ref.collection('timeline').orderBy('createdAt', 'desc').limit(50).get(),
        ]);

        const contact: any = {
            id: doc.id,
            name: data.name ?? null,
            email: data.email ?? null,
            phone: data.phone ?? null,
            militaryBase: data.militaryBase ?? null,
            businessName: data.businessName ?? null,
            status: data.status ?? null,
            stayStartDate: tsToISO(data.stayStartDate),
            stayEndDate: tsToISO(data.stayEndDate),
            createdAt: tsToISO(data.createdAt),
            updatedAt: tsToISO(data.updatedAt),
            notes: notesSnap.docs.map(d => {
                const nd = d.data();
                return { id: d.id, content: nd.content, contactId: nd.contactId, createdAt: tsToISO(nd.createdAt), updatedAt: tsToISO(nd.updatedAt) };
            }),
            tasks: tasksSnap.docs.map(d => {
                const td = d.data();
                return { id: d.id, title: td.title, description: td.description, dueDate: tsToISO(td.dueDate), priority: td.priority, completed: td.completed, contactId: td.contactId, opportunityId: td.opportunityId, createdAt: tsToISO(td.createdAt), updatedAt: tsToISO(td.updatedAt) };
            }),
            messages: messagesSnap.docs.map(d => {
                const md = d.data();
                return { id: d.id, ...md, createdAt: tsToISO(md.createdAt), updatedAt: tsToISO(md.updatedAt) };
            }),
            documents: docsSnap.docs.map(d => {
                const dd = d.data();
                return { id: d.id, ...dd, createdAt: tsToISO(dd.createdAt), updatedAt: tsToISO(dd.updatedAt) };
            }),
            opportunities: oppsSnap.docs.map(d => {
                const od = d.data();
                return {
                    id: d.id,
                    contactId: od.contactId ?? null,
                    pipelineStageId: od.pipelineStageId ?? null,
                    name: od.name ?? null,
                    priority: od.priority ?? null,
                    opportunityValue: od.opportunityValue ?? null,
                    estimatedProfit: od.estimatedProfit ?? null,
                    source: od.source ?? null,
                    militaryBase: od.militaryBase ?? null,
                    notes: od.notes ?? null,
                    reasonForStay: od.reasonForStay ?? null,
                    specialAccommodationId: od.specialAccommodationId ?? null,
                    specialAccommodationLabels: Array.isArray(od.specialAccommodationLabels) ? od.specialAccommodationLabels : [],
                    unread: od.unread ?? false,
                    unreadAt: tsToISO(od.unreadAt),
                    lastSeenBy: od.lastSeenBy ?? null,
                    lastSeenAt: tsToISO(od.lastSeenAt),
                    stayStartDate: tsToISO(od.stayStartDate),
                    stayEndDate: tsToISO(od.stayEndDate),
                    assigneeId: od.assigneeId ?? null,
                    leadSourceId: od.leadSourceId ?? null,
                    tags: Array.isArray(od.tags) ? od.tags.map((t: any) => ({ tagId: t?.tagId ?? null, name: t?.name ?? null, color: t?.color ?? null })) : [],
                    createdAt: tsToISO(od.createdAt),
                    updatedAt: tsToISO(od.updatedAt),
                };
            }),
            timelineEvents: timelineSnap.docs.map(d => {
                const td = d.data();
                return {
                    id: d.id,
                    type: td.type ?? null,
                    noteId: td.noteId ?? null,
                    contentPreview: td.contentPreview ?? null,
                    deletedBy: td.deletedByName ?? td.deletedById ?? null,
                    createdAt: tsToISO(td.createdAt),
                };
            }),
            tags: data.tags || [],
            formTracking: data.formTracking || null,
            relatedContacts: data.relatedContacts || [],
        };

        return { success: true, contact };
    } catch (error) {
        console.error("Failed to fetch contact detail:", error);
        return { success: false, error: "Failed to fetch contact detail" };
    }
}

export async function updateFormTracking(contactId: string, data: any) {
    const parsed = updateFormTrackingSchema.safeParse({ contactId, data });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    contactId = parsed.data.contactId;

    try {
        await adminDb.collection('contacts').doc(contactId).update({
            formTracking: data,
            updatedAt: new Date()
        });
        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        console.error("Failed to update form tracking:", error);
        return { success: false, error: "Failed to update form tracking" };
    }
}

export async function deleteContact(id: string) {
    const parsed = deleteContactSchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    id = parsed.data.id;

    try {
        const contactRef = adminDb.collection('contacts').doc(id);
        const doc = await contactRef.get();
        if (!doc.exists) return { success: false, error: "Contact not found" };

        const contactName = doc.data()?.name || doc.data()?.email || "";
        const session = await auth();

        const batch = adminDb.batch();

        // Delete subcollections
        const subcollections = ['notes', 'tasks', 'messages', 'documents', 'timeline'];
        for (const col of subcollections) {
            const snap = await contactRef.collection(col).get();
            snap.docs.forEach(d => batch.delete(d.ref));
        }

        // Delete related opportunities
        const oppsSnap = await adminDb.collection('opportunities').where('contactId', '==', id).get();
        oppsSnap.docs.forEach(d => batch.delete(d.ref));

        batch.delete(contactRef);
        await batch.commit();

        if (session?.user) {
            logAudit({
                userId: (session.user as any).id || "",
                userEmail: session.user.email || "",
                userName: session.user.name || "",
                action: "delete",
                entity: "contact",
                entityId: id,
                entityName: contactName,
            }).catch(() => {});
        }

        revalidatePath("/contacts");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete contact:", error);
        return { success: false, error: "Failed to delete contact" };
    }
}

export async function softDeleteContact(id: string) {
    const parsed = deleteContactSchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    id = parsed.data.id;

    try {
        const session = await auth();
        const userId = (session?.user as any)?.id || "";
        const res = await softDelete('contacts', id, userId);
        if (!res.success) return res;

        // Also soft-delete related opportunities
        const oppsSnap = await adminDb.collection('opportunities').where('contactId', '==', id).get();
        for (const doc of oppsSnap.docs) {
            await softDelete('opportunities', doc.id, userId);
        }

        revalidatePath("/contacts");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to soft-delete contact:", error);
        return { success: false, error: "Failed to delete contact" };
    }
}

export async function restoreContact(id: string) {
    const parsed = deleteContactSchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    id = parsed.data.id;

    try {
        const res = await restoreItem('contacts', id);
        if (!res.success) return res;

        // Also restore related opportunities that were soft-deleted
        const oppsSnap = await adminDb.collection('opportunities').where('contactId', '==', id).get();
        for (const doc of oppsSnap.docs) {
            if (doc.data().deletedAt) {
                await restoreItem('opportunities', doc.id);
            }
        }

        revalidatePath("/contacts");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to restore contact:", error);
        return { success: false, error: "Failed to restore contact" };
    }
}

export async function permanentlyDeleteContact(id: string) {
    const parsed = deleteContactSchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    id = parsed.data.id;

    try {
        // Use the existing full deleteContact logic for permanent deletion
        return await deleteContact(id);
    } catch (error) {
        console.error("Failed to permanently delete contact:", error);
        return { success: false, error: "Failed to permanently delete contact" };
    }
}

export async function bulkSoftDeleteContacts(ids: string[]) {
    const parsed = bulkDeleteContactsSchema.safeParse({ ids });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    ids = parsed.data.ids;

    try {
        for (const id of ids) {
            const res = await softDeleteContact(id);
            if (!res.success) return res;
        }
        return { success: true };
    } catch (error) {
        console.error("Failed to bulk soft-delete contacts:", error);
        return { success: false, error: "Failed to delete contacts" };
    }
}

export async function bulkRestoreContacts(ids: string[]) {
    const parsed = bulkDeleteContactsSchema.safeParse({ ids });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    ids = parsed.data.ids;

    try {
        for (const id of ids) {
            const res = await restoreContact(id);
            if (!res.success) return res;
        }
        return { success: true };
    } catch (error) {
        console.error("Failed to bulk restore contacts:", error);
        return { success: false, error: "Failed to restore contacts" };
    }
}

export async function bulkPermanentlyDeleteContacts(ids: string[]) {
    const parsed = bulkDeleteContactsSchema.safeParse({ ids });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    ids = parsed.data.ids;

    try {
        for (const id of ids) {
            const res = await deleteContact(id);
            if (!res.success) return res;
        }
        return { success: true };
    } catch (error) {
        console.error("Failed to bulk permanently delete contacts:", error);
        return { success: false, error: "Failed to permanently delete contacts" };
    }
}

export async function bulkDeleteContacts(ids: string[]) {
    const parsed = bulkDeleteContactsSchema.safeParse({ ids });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    ids = parsed.data.ids;

    try {
        for (const id of ids) {
            const res = await deleteContact(id);
            if (!res.success) return res;
        }
        return { success: true };
    } catch (error) {
        console.error("Failed to bulk delete contacts:", error);
        return { success: false, error: "Failed to delete contacts" };
    }
}

export async function bulkUpdateContactStatus(ids: string[], status: string) {
    const parsed = bulkUpdateStatusSchema.safeParse({ ids, status });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    ids = parsed.data.ids;
    status = parsed.data.status;

    try {
        const session = await auth();
        const batch = adminDb.batch();

        for (const id of ids) {
            const ref = adminDb.collection('contacts').doc(id);
            batch.update(ref, { status, updatedAt: new Date() });
        }

        await batch.commit();

        if (session?.user) {
            logAudit({
                userId: (session.user as any).id || "",
                userEmail: session.user.email || "",
                userName: session.user.name || "",
                action: "update",
                entity: "contact",
                entityId: "bulk_status_update",
                entityName: `Bulk status update to "${status}" for ${ids.length} contacts`,
                metadata: { count: ids.length, status },
            }).catch(() => {});
        }

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        console.error("Failed to bulk update contact status:", error);
        return { success: false, error: "Failed to update contact statuses" };
    }
}

export async function bulkAddTag(ids: string[], tagId: string) {
    const parsed = bulkAddTagSchema.safeParse({ ids, tag: tagId });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    ids = parsed.data.ids;
    tagId = parsed.data.tag;

    try {
        const session = await auth();

        // Fetch the tag details
        const tagDoc = await adminDb.collection('tags').doc(tagId).get();
        if (!tagDoc.exists) return { success: false, error: "Tag not found" };
        const tagData = { tagId, name: tagDoc.data()?.name, color: tagDoc.data()?.color };

        const batch = adminDb.batch();

        // For each contact, add the tag if not already present
        for (const id of ids) {
            const contactRef = adminDb.collection('contacts').doc(id);
            const contactSnap = await contactRef.get();
            if (!contactSnap.exists) continue;

            const existingTags: any[] = contactSnap.data()?.tags || [];
            const alreadyHasTag = existingTags.some((t: any) => t.tagId === tagId);
            if (!alreadyHasTag) {
                batch.update(contactRef, {
                    tags: [...existingTags, tagData],
                    updatedAt: new Date(),
                });
            }
        }

        await batch.commit();

        if (session?.user) {
            logAudit({
                userId: (session.user as any).id || "",
                userEmail: session.user.email || "",
                userName: session.user.name || "",
                action: "update",
                entity: "contact",
                entityId: "bulk_add_tag",
                entityName: `Bulk add tag "${tagData.name}" to ${ids.length} contacts`,
                metadata: { count: ids.length, tagId, tagName: tagData.name },
            }).catch(() => {});
        }

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        console.error("Failed to bulk add tag:", error);
        return { success: false, error: "Failed to add tag to contacts" };
    }
}

export async function bulkCreateContacts(contacts: any[]) {
    const parsed = bulkCreateContactsSchema.safeParse({ contacts });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    contacts = parsed.data.contacts;

    try {
        const batch = adminDb.batch();
        
        for (const contact of contacts) {
            const ref = adminDb.collection('contacts').doc();
            batch.set(ref, {
                name: contact.name || 'Unknown',
                email: contact.email || null,
                phone: contact.phone || null,
                militaryBase: contact.militaryBase || null,
                businessName: contact.businessName || null,
                status: contact.status || 'Lead',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        await batch.commit();
        revalidatePath("/contacts");

        await createNotification({
            title: "Contacts Imported",
            message: `${contacts.length} contact${contacts.length !== 1 ? "s" : ""} imported successfully.`,
            type: "contact",
            linkUrl: "/contacts"
        });

        const session = await auth();
        if (session?.user) {
            logAudit({
                userId: (session.user as any).id || "",
                userEmail: session.user.email || "",
                userName: session.user.name || "",
                action: "create",
                entity: "contact",
                entityId: "bulk_import",
                entityName: `Bulk import of ${contacts.length} contacts`,
                metadata: { count: contacts.length },
            }).catch(() => {});
        }

        return { success: true, count: contacts.length };
    } catch (error) {
        console.error("Failed to bulk create contacts:", error);
        return { success: false, error: "Failed to import contacts" };
    }
}

/**
 * Find potential duplicate contacts by email, phone, or similar name.
 * Returns groups of potential duplicates with full contact details for each.
 */
export async function findDuplicateContacts(): Promise<{ success: boolean; duplicates?: DuplicateGroup[]; error?: string }> {
    try {
        const snapshot = await adminDb.collection('contacts').get();
        const contacts: DuplicateContact[] = snapshot.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                name: d.name || "",
                email: (d.email || "").toLowerCase().trim(),
                phone: d.phone || "",
                militaryBase: d.militaryBase || "",
                businessName: d.businessName || "",
                status: d.status || "",
                tags: d.tags || [],
                createdAt: toISO(d.createdAt),
            };
        });

        const groups: Record<string, string[]> = {};

        // Group by email
        for (const c of contacts) {
            if (c.email) {
                const key = `email:${c.email}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(c.id);
            }
        }

        // Group by phone (normalized digits only, min 7 digits)
        for (const c of contacts) {
            const normalizedPhone = c.phone.replace(/\D/g, "");
            if (normalizedPhone && normalizedPhone.length >= 7) {
                const key = `phone:${normalizedPhone}`;
                if (!groups[key]) groups[key] = [];
                if (!groups[key].includes(c.id)) groups[key].push(c.id);
            }
        }

        // Group by similar name (case-insensitive exact match)
        const nameMap: Record<string, string[]> = {};
        for (const c of contacts) {
            if (!c.name || c.name.trim().length < 2) continue;
            const normalized = c.name.toLowerCase().trim().replace(/\s+/g, " ");
            if (!nameMap[normalized]) nameMap[normalized] = [];
            nameMap[normalized].push(c.id);
        }
        for (const [normName, ids] of Object.entries(nameMap)) {
            if (ids.length >= 2) {
                const key = `name:${normName}`;
                if (!groups[key]) groups[key] = [];
                for (const id of ids) {
                    if (!groups[key].includes(id)) groups[key].push(id);
                }
            }
        }

        // Also check first+last name swaps (e.g. "John Smith" vs "Smith, John" or "Smith John")
        const contactsByName = contacts.filter(c => c.name && c.name.trim().length >= 2);
        for (let i = 0; i < contactsByName.length; i++) {
            for (let j = i + 1; j < contactsByName.length; j++) {
                const a = contactsByName[i];
                const b = contactsByName[j];
                const aParts = a.name.toLowerCase().trim().replace(/,/g, "").split(/\s+/).filter(Boolean).sort();
                const bParts = b.name.toLowerCase().trim().replace(/,/g, "").split(/\s+/).filter(Boolean).sort();
                if (aParts.length >= 2 && bParts.length >= 2 && aParts.join(" ") === bParts.join(" ")) {
                    const normKey = `name:${aParts.join(" ")}`;
                    if (!groups[normKey]) groups[normKey] = [];
                    if (!groups[normKey].includes(a.id)) groups[normKey].push(a.id);
                    if (!groups[normKey].includes(b.id)) groups[normKey].push(b.id);
                }
            }
        }

        // Build contact lookup for returning full details
        const contactMap: Record<string, DuplicateContact> = {};
        for (const c of contacts) contactMap[c.id] = c;

        // Only return groups with 2+ contacts, dedup overlapping groups
        const duplicateSets: DuplicateGroup[] = [];
        const seen = new Set<string>();

        for (const [key, ids] of Object.entries(groups)) {
            if (ids.length < 2) continue;
            const pairKey = [...ids].sort().join(",");
            if (seen.has(pairKey)) continue;
            seen.add(pairKey);

            const [type, ...rest] = key.split(":");
            const value = rest.join(":");
            duplicateSets.push({
                matchType: type,
                matchValue: value,
                contactIds: ids,
                contacts: ids.map(id => contactMap[id]).filter(Boolean),
            });
        }

        return { success: true, duplicates: duplicateSets };
    } catch (error) {
        console.error("Failed to find duplicates:", error);
        return { success: false, error: "Failed to find duplicates" };
    }
}

/**
 * Merge multiple duplicate contacts into a primary contact.
 * Copies non-empty fields from duplicates to primary (if primary field is empty),
 * merges tags (union), moves subcollections and opportunities, then deletes duplicates.
 */
export async function mergeMultipleContacts(primaryId: string, duplicateIds: string[]) {
    const idParsed = firestoreIdSchema.safeParse(primaryId);
    if (!idParsed.success) return { success: false, error: "Invalid primary ID" };
    primaryId = idParsed.data;

    if (!Array.isArray(duplicateIds) || duplicateIds.length === 0) {
        return { success: false, error: "No duplicate IDs provided" };
    }
    for (const did of duplicateIds) {
        const p = firestoreIdSchema.safeParse(did);
        if (!p.success) return { success: false, error: "Invalid duplicate ID" };
    }
    // Filter out primaryId if accidentally included
    duplicateIds = duplicateIds.filter(id => id !== primaryId);
    if (duplicateIds.length === 0) return { success: false, error: "No duplicates to merge" };

    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Not authenticated" };

        const primaryRef = adminDb.collection('contacts').doc(primaryId);
        const primarySnap = await primaryRef.get();
        if (!primarySnap.exists) return { success: false, error: "Primary contact not found" };

        const primary = primarySnap.data()!;
        const mergeFields = ['name', 'email', 'phone', 'militaryBase', 'businessName', 'status', 'stayStartDate', 'stayEndDate'];
        const merged: Record<string, unknown> = { updatedAt: new Date() };

        // Start with primary values
        for (const field of mergeFields) {
            merged[field] = primary[field] || null;
        }

        let mergedTags = Array.isArray(primary.tags) ? [...primary.tags] : [];
        const tagIds = new Set(mergedTags.map((t: any) => t.tagId));

        let ft = primary.formTracking || {};

        const mergedNames: string[] = [];
        const subcollections = ['notes', 'tasks', 'messages', 'documents', 'timeline'];

        for (const dupId of duplicateIds) {
            const dupRef = adminDb.collection('contacts').doc(dupId);
            const dupSnap = await dupRef.get();
            if (!dupSnap.exists) continue;

            const dup = dupSnap.data()!;
            mergedNames.push(dup.name || dup.email || dupId);

            // Fill empty primary fields from duplicate
            for (const field of mergeFields) {
                if (!merged[field] && dup[field]) {
                    merged[field] = dup[field];
                }
            }

            // Merge tags (union)
            const dupTags = Array.isArray(dup.tags) ? dup.tags : [];
            for (const t of dupTags) {
                if (!tagIds.has(t.tagId)) {
                    mergedTags.push(t);
                    tagIds.add(t.tagId);
                }
            }

            // Merge formTracking (OR logic)
            const ft2 = dup.formTracking || {};
            ft = {
                homeownerLeaseSigned: ft.homeownerLeaseSigned || ft2.homeownerLeaseSigned || false,
                termsConditionsSigned: ft.termsConditionsSigned || ft2.termsConditionsSigned || false,
                paymentAuthSigned: ft.paymentAuthSigned || ft2.paymentAuthSigned || false,
            };

            // Move subcollections from duplicate to primary
            for (const col of subcollections) {
                const snap = await dupRef.collection(col).get();
                for (const doc of snap.docs) {
                    const data = doc.data();
                    data.contactId = primaryId;
                    await primaryRef.collection(col).add(data);
                }
            }

            // Reassign opportunities from duplicate to primary
            const oppsSnap = await adminDb.collection('opportunities').where('contactId', '==', dupId).get();
            for (const doc of oppsSnap.docs) {
                await doc.ref.update({ contactId: primaryId, updatedAt: new Date() });
            }

            // Record merge in timeline
            await primaryRef.collection('timeline').add({
                type: 'contact_merged',
                mergedContactId: dupId,
                mergedContactName: dup.name || dup.email || 'Unknown',
                createdAt: new Date(),
            });

            // Delete duplicate contact and its subcollections
            const batch = adminDb.batch();
            for (const col of subcollections) {
                const snap = await dupRef.collection(col).get();
                snap.docs.forEach(d => batch.delete(d.ref));
            }
            batch.delete(dupRef);
            await batch.commit();
        }

        merged.tags = mergedTags;
        merged.formTracking = ft;

        // Update primary contact with merged data
        await primaryRef.update(merged);

        // Audit log
        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "update",
            entity: "contact",
            entityId: primaryId,
            entityName: (merged.name as string) || "",
            changes: {
                merge: { from: `Merged with ${mergedNames.join(", ")}`, to: "Completed" }
            },
        }).catch(() => {});

        revalidatePath("/contacts");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to merge contacts:", error);
        return { success: false, error: "Failed to merge contacts" };
    }
}

/**
 * Merge secondaryId into primaryId. Moves all subcollections and opportunity references,
 * merges fields (primary wins unless empty), then deletes the secondary contact.
 */
// ── Related Contacts ─────────────────────────────────────────────────────────

const addRelatedContactSchema = z.object({
    contactId: firestoreIdSchema,
    relatedId: firestoreIdSchema,
    relationship: z.enum(["Spouse", "Referrer", "Roommate", "Coworker", "Other"]),
});

const removeRelatedContactSchema = z.object({
    contactId: firestoreIdSchema,
    relatedId: firestoreIdSchema,
});

export async function addRelatedContact(contactId: string, relatedId: string, relationship: string) {
    const parsed = addRelatedContactSchema.safeParse({ contactId, relatedId, relationship });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    contactId = parsed.data.contactId;
    relatedId = parsed.data.relatedId;
    relationship = parsed.data.relationship;

    if (contactId === relatedId) return { success: false, error: "Cannot relate a contact to itself" };

    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Not authenticated" };

        // Get related contact's name for display
        const relatedDoc = await adminDb.collection('contacts').doc(relatedId).get();
        if (!relatedDoc.exists) return { success: false, error: "Related contact not found" };
        const relatedName = relatedDoc.data()?.name || relatedDoc.data()?.email || "Unknown";

        const contactDoc = await adminDb.collection('contacts').doc(contactId).get();
        if (!contactDoc.exists) return { success: false, error: "Contact not found" };
        const contactName = contactDoc.data()?.name || contactDoc.data()?.email || "Unknown";

        // Add relation to both contacts (bidirectional)
        const contactRef = adminDb.collection('contacts').doc(contactId);
        const relatedRef = adminDb.collection('contacts').doc(relatedId);

        const existingRelated: any[] = contactDoc.data()?.relatedContacts || [];
        const alreadyLinked = existingRelated.some((r: any) => r.contactId === relatedId);
        if (alreadyLinked) return { success: false, error: "These contacts are already linked" };

        // Add to primary contact
        await contactRef.update({
            relatedContacts: [...existingRelated, { contactId: relatedId, name: relatedName, relationship }],
            updatedAt: new Date(),
        });

        // Add reciprocal relation to the related contact
        const reverseRelationship = relationship; // Same relationship type for both directions
        const relatedExisting: any[] = relatedDoc.data()?.relatedContacts || [];
        await relatedRef.update({
            relatedContacts: [...relatedExisting, { contactId, name: contactName, relationship: reverseRelationship }],
            updatedAt: new Date(),
        });

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        console.error("Failed to add related contact:", error);
        return { success: false, error: "Failed to add related contact" };
    }
}

export async function removeRelatedContact(contactId: string, relatedId: string) {
    const parsed = removeRelatedContactSchema.safeParse({ contactId, relatedId });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    contactId = parsed.data.contactId;
    relatedId = parsed.data.relatedId;

    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Not authenticated" };

        // Remove from both contacts (bidirectional)
        const contactRef = adminDb.collection('contacts').doc(contactId);
        const relatedRef = adminDb.collection('contacts').doc(relatedId);

        const contactDoc = await contactRef.get();
        const relatedDoc = await relatedRef.get();

        if (contactDoc.exists) {
            const existing: any[] = contactDoc.data()?.relatedContacts || [];
            await contactRef.update({
                relatedContacts: existing.filter((r: any) => r.contactId !== relatedId),
                updatedAt: new Date(),
            });
        }

        if (relatedDoc.exists) {
            const existing: any[] = relatedDoc.data()?.relatedContacts || [];
            await relatedRef.update({
                relatedContacts: existing.filter((r: any) => r.contactId !== contactId),
                updatedAt: new Date(),
            });
        }

        revalidatePath("/contacts");
        return { success: true };
    } catch (error) {
        console.error("Failed to remove related contact:", error);
        return { success: false, error: "Failed to remove related contact" };
    }
}

// ── Bulk Email ──────────────────────────────────────────────────────────────

const sendBulkEmailSchema = z.object({
    contactIds: z.array(firestoreIdSchema).min(1).max(500),
    subject: z.string().min(1).max(500),
    body: z.string().min(1).max(50000),
});

export async function sendBulkEmail(contactIds: string[], subject: string, body: string) {
    const parsed = sendBulkEmailSchema.safeParse({ contactIds, subject, body });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    contactIds = parsed.data.contactIds;
    subject = parsed.data.subject;
    body = parsed.data.body;

    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Not authenticated" };

        // Dynamically import sendTrackedEmail to avoid circular deps
        const { sendTrackedEmail } = await import("@/lib/email");

        let sent = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const contactId of contactIds) {
            const contactDoc = await adminDb.collection('contacts').doc(contactId).get();
            if (!contactDoc.exists) { skipped++; continue; }

            const contact = contactDoc.data()!;
            const email = contact.email;
            if (!email) { skipped++; continue; }

            // Replace merge fields in body
            const personalizedBody = body
                .replace(/\{\{name\}\}/gi, contact.name || "")
                .replace(/\{\{email\}\}/gi, contact.email || "")
                .replace(/\{\{phone\}\}/gi, contact.phone || "")
                .replace(/\{\{businessName\}\}/gi, contact.businessName || "")
                .replace(/\{\{militaryBase\}\}/gi, contact.militaryBase || "")
                .replace(/\{\{status\}\}/gi, contact.status || "");

            const personalizedSubject = subject
                .replace(/\{\{name\}\}/gi, contact.name || "")
                .replace(/\{\{email\}\}/gi, contact.email || "");

            try {
                await sendTrackedEmail({
                    to: email,
                    subject: personalizedSubject,
                    html: personalizedBody,
                    contactId,
                });

                // Log to contact's message history
                await adminDb.collection('contacts').doc(contactId).collection('messages').add({
                    type: "EMAIL",
                    direction: "OUTBOUND",
                    content: personalizedBody,
                    subject: personalizedSubject,
                    createdAt: new Date(),
                    sentBy: session.user.name || session.user.email || "System",
                });

                sent++;
            } catch (err) {
                errors.push(`${contact.name || email}: ${err instanceof Error ? err.message : "Send failed"}`);
            }
        }

        // Audit log
        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "email",
            entityId: "bulk_email",
            entityName: `Bulk email: "${subject}" to ${sent} contacts`,
            metadata: { sent, skipped, errors: errors.length },
        }).catch(() => {});

        return {
            success: true,
            sent,
            skipped,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        console.error("Failed to send bulk email:", error);
        return { success: false, error: "Failed to send bulk email" };
    }
}

// ── Import with Field Mapping ──────────────────────────────────────────────

const importMappedContactsSchema = z.object({
    contacts: z.array(z.record(z.string(), z.any())).min(1).max(2000),
    mapping: z.record(z.string(), z.string()),
});

export async function importMappedContacts(rows: Record<string, any>[], mapping: Record<string, string>) {
    const parsed = importMappedContactsSchema.safeParse({ contacts: rows, mapping });
    if (!parsed.success) return { success: false, error: "Invalid input", imported: 0, skipped: 0 };

    const validRows = parsed.data.contacts;
    const fieldMapping = parsed.data.mapping;

    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Not authenticated", imported: 0, skipped: 0 };

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        // Process in batches of 500 (Firestore limit)
        const batchSize = 400;
        for (let i = 0; i < validRows.length; i += batchSize) {
            const chunk = validRows.slice(i, i + batchSize);
            const batch = adminDb.batch();

            for (const row of chunk) {
                // Map CSV columns to CRM fields using the user's mapping
                const contact: Record<string, any> = {};
                for (const [csvCol, crmField] of Object.entries(fieldMapping)) {
                    if (crmField && crmField !== "skip" && row[csvCol] !== undefined && row[csvCol] !== null) {
                        contact[crmField] = String(row[csvCol]).trim();
                    }
                }

                // Require at least a name or email
                if (!contact.name && !contact.email) {
                    skipped++;
                    continue;
                }

                // Validate email format if provided
                if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
                    skipped++;
                    errors.push(`Row ${i + chunk.indexOf(row) + 1}: Invalid email "${contact.email}"`);
                    continue;
                }

                const ref = adminDb.collection('contacts').doc();
                batch.set(ref, {
                    name: contact.name || "",
                    email: contact.email || null,
                    phone: contact.phone || null,
                    militaryBase: contact.militaryBase || null,
                    businessName: contact.businessName || null,
                    status: contact.status || "Lead",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                imported++;
            }

            await batch.commit();
        }

        revalidatePath("/contacts");

        if (imported > 0) {
            await createNotification({
                title: "Contacts Imported",
                message: `${imported} contact${imported !== 1 ? "s" : ""} imported${skipped > 0 ? ` (${skipped} skipped)` : ""}.`,
                type: "contact",
                linkUrl: "/contacts",
            });
        }

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "contact",
            entityId: "mapped_import",
            entityName: `Mapped import: ${imported} contacts`,
            metadata: { imported, skipped },
        }).catch(() => {});

        return { success: true, imported, skipped, errors: errors.length > 0 ? errors : undefined };
    } catch (error) {
        console.error("Failed to import mapped contacts:", error);
        return { success: false, error: "Failed to import contacts", imported: 0, skipped: 0 };
    }
}

export async function mergeContacts(primaryId: string, secondaryId: string, fieldOverrides?: Record<string, string>) {
    const parsed = mergeContactsSchema.safeParse({ primaryId, secondaryId, fieldOverrides });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    primaryId = parsed.data.primaryId;
    secondaryId = parsed.data.secondaryId;
    fieldOverrides = parsed.data.fieldOverrides;

    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "Not authenticated" };

        const primaryRef = adminDb.collection('contacts').doc(primaryId);
        const secondaryRef = adminDb.collection('contacts').doc(secondaryId);

        const [primarySnap, secondarySnap] = await Promise.all([primaryRef.get(), secondaryRef.get()]);
        if (!primarySnap.exists) return { success: false, error: "Primary contact not found" };
        if (!secondarySnap.exists) return { success: false, error: "Secondary contact not found" };

        const primary = primarySnap.data()!;
        const secondary = secondarySnap.data()!;

        // Merge fields: use override selections, else primary wins, else secondary
        const mergeFields = ['name', 'email', 'phone', 'militaryBase', 'businessName', 'status', 'stayStartDate', 'stayEndDate'];
        const merged: Record<string, unknown> = { updatedAt: new Date() };

        for (const field of mergeFields) {
            if (fieldOverrides && fieldOverrides[field]) {
                merged[field] = fieldOverrides[field] === 'secondary' ? (secondary[field] || primary[field]) : (primary[field] || secondary[field]);
            } else {
                merged[field] = primary[field] || secondary[field] || null;
            }
        }

        // Merge tags (union)
        const primaryTags = Array.isArray(primary.tags) ? primary.tags : [];
        const secondaryTags = Array.isArray(secondary.tags) ? secondary.tags : [];
        const tagIds = new Set(primaryTags.map((t: any) => t.tagId));
        const mergedTags = [...primaryTags];
        for (const t of secondaryTags) {
            if (!tagIds.has(t.tagId)) mergedTags.push(t);
        }
        merged.tags = mergedTags;

        // Merge formTracking (OR logic)
        const ft1 = primary.formTracking || {};
        const ft2 = secondary.formTracking || {};
        merged.formTracking = {
            homeownerLeaseSigned: ft1.homeownerLeaseSigned || ft2.homeownerLeaseSigned || false,
            termsConditionsSigned: ft1.termsConditionsSigned || ft2.termsConditionsSigned || false,
            paymentAuthSigned: ft1.paymentAuthSigned || ft2.paymentAuthSigned || false,
        };

        // Update primary contact
        await primaryRef.update(merged);

        // Move subcollections from secondary to primary
        const subcollections = ['notes', 'tasks', 'messages', 'documents', 'timeline'];
        for (const col of subcollections) {
            const snap = await secondaryRef.collection(col).get();
            for (const doc of snap.docs) {
                const data = doc.data();
                data.contactId = primaryId;
                await primaryRef.collection(col).add(data);
            }
        }

        // Reassign opportunities from secondary to primary
        const oppsSnap = await adminDb.collection('opportunities').where('contactId', '==', secondaryId).get();
        for (const doc of oppsSnap.docs) {
            await doc.ref.update({ contactId: primaryId, updatedAt: new Date() });
        }

        // Record merge in timeline
        await primaryRef.collection('timeline').add({
            type: 'contact_merged',
            mergedContactId: secondaryId,
            mergedContactName: secondary.name || secondary.email || 'Unknown',
            createdAt: new Date(),
        });

        // Delete secondary contact and its subcollections
        const batch = adminDb.batch();
        for (const col of subcollections) {
            const snap = await secondaryRef.collection(col).get();
            snap.docs.forEach(d => batch.delete(d.ref));
        }
        batch.delete(secondaryRef);
        await batch.commit();

        // Audit log
        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "update",
            entity: "contact",
            entityId: primaryId,
            entityName: (merged.name as string) || "",
            changes: {
                merge: { from: `Merged with ${secondary.name || secondaryId}`, to: "Completed" }
            },
        }).catch(() => {});

        revalidatePath("/contacts");
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to merge contacts:", error);
        return { success: false, error: "Failed to merge contacts" };
    }
}
