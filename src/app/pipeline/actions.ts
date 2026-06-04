"use server"

import { z } from "zod";
import { tenantDb } from "@/lib/tenant-db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { createNotification } from "@/app/notifications/actions";
import { checkStayReminders } from "@/lib/reminders";
import { logAudit, diffChanges } from "@/lib/audit";
import { recordCommission } from "@/app/dashboard/commissions/actions";
import { advanceReferralForStage, checkReferralConversion } from "@/app/dashboard/referrals/actions";
import { executeStageAutomations } from "@/lib/stage-automations";
import { triggerWorkflows } from "@/lib/workflow-engine";
import { fireTrigger } from "@/lib/automations/triggers";
import { softDelete, restoreItem, permanentlyDelete } from "@/lib/soft-delete";
import { captureError } from "@/lib/error-tracking";
import { getCurrentUserRole } from "@/app/settings/users/actions";
import { getCachedPipelines, getCachedUsers, invalidatePipelinesCache } from "@/lib/cached-queries";
import { trackFirstForWorkspace } from "@/lib/posthog/firsts";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const firestoreIdSchema = z.string().min(1).max(128);

const markOpportunitySeenSchema = z.object({
    id: firestoreIdSchema,
});

const moveToLeaseSignedSchema = z.object({ opportunityId: firestoreIdSchema });

const bulkCreateOpportunitiesSchema = z.object({
    opportunities: z.array(z.object({
        name: z.string().max(200).optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().max(50).optional().or(z.literal("")),
        stage: z.string().max(100).optional(),
        dealName: z.string().max(200).optional(),
        value: z.union([z.string(), z.number()]).optional(),
        margin: z.union([z.string(), z.number()]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    })).min(1).max(500),
    pipelineId: firestoreIdSchema,
});

const createPipelineSchema = z.object({
    name: z.string().min(1).max(200),
});

const createPipelineStageSchema = z.object({
    pipelineId: firestoreIdSchema,
    name: z.string().min(1).max(200),
    order: z.number().int().min(0),
});

const updatePipelineStageSchema = z.object({
    id: firestoreIdSchema,
    name: z.string().min(1).max(200),
    order: z.number().int().min(0),
});

const deletePipelineStageSchema = z.object({ id: firestoreIdSchema });
const deletePipelineSchema = z.object({ id: firestoreIdSchema });

const createNewDealSchema = z.object({
    name: z.string().max(200).optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(50).optional().or(z.literal("")),
    base: z.string().max(200).optional().or(z.literal("")),
    specialAccommodationId: z.string().optional().nullable(),
    stage: z.string().max(100).optional(),
    value: z.union([z.string(), z.number()]).optional(),
    margin: z.union([z.string(), z.number()]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    startDate: z.string().optional().or(z.literal("")),
    endDate: z.string().optional().or(z.literal("")),
    notes: z.string().max(5000).optional().or(z.literal("")),
    contactId: z.string().optional(),
    assigneeId: z.string().optional().nullable(),
});

const updateOpportunitySchema = z.object({
    pipelineStageId: z.string().optional(),
    name: z.string().max(200).optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(50).optional().or(z.literal("")),
    value: z.number().optional(),
    margin: z.number().optional(),
    priority: z.string().max(50).optional(),
    startDate: z.string().optional().or(z.literal("")),
    endDate: z.string().optional().or(z.literal("")),
    base: z.string().max(200).optional().or(z.literal("")),
    specialAccommodationId: z.string().optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    contactId: z.string().optional(),
    assigneeId: z.string().optional().nullable(),
    leadSourceId: z.string().optional().nullable(),
    tagIds: z.array(z.string()).optional(),
    blockers: z.array(z.string().max(500)).max(20).optional(),
    revenueStatus: z.enum(["booked", "collected", "partial"]).optional(),
    collectedAmount: z.number().min(0).optional(),
    collectedDate: z.string().optional().or(z.literal("")),
    paymentStatus: z.enum(["unpaid", "partial", "paid"]).optional(),
    status: z.enum(["open", "closed_won", "closed_lost", "archive"]).optional(),
});

const updateBlockersSchema = z.object({
    id: firestoreIdSchema,
    blockers: z.array(z.string().max(500)).max(20),
});

const claimOpportunitySchema = z.object({ id: firestoreIdSchema });
const deleteOpportunitySchema = z.object({ id: firestoreIdSchema });

const updateRequiredDocsSchema = z.object({
    opportunityId: firestoreIdSchema,
    // Required-doc keys are workspace-defined (configured under Settings →
    // Workspace → Required documents), so the field name is an arbitrary
    // alphanumeric/dash slug rather than one of three fixed values.
    field: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
    value: z.boolean(),
});


// ── Payment / Revenue Recognition Schemas ────────────────────────────────────

const addPaymentSchema = z.object({
    dealId: firestoreIdSchema,
    amount: z.number().positive("Amount must be positive"),
    date: z.string().min(1, "Date is required"),
    method: z.enum(["check", "ach", "credit_card", "wire", "cash", "other"]),
    notes: z.string().max(1000).optional().or(z.literal("")),
});

const getPaymentsSchema = z.object({ dealId: firestoreIdSchema });

const updateExpensesSchema = z.object({
    dealId: firestoreIdSchema,
    expenses: z.object({
        monthlyRent: z.number().min(0),
        cleaningFee: z.number().min(0),
        petFee: z.number().min(0),
        nonrefundableDeposit: z.number().min(0),
    }),
});

const updatePaymentStatusSchema = z.object({
    dealId: firestoreIdSchema,
    status: z.enum(["unpaid", "partial", "paid"]),
});

const updateRevenueStatusSchema = z.object({
    dealId: firestoreIdSchema,
    revenueStatus: z.enum(["booked", "collected", "partial"]),
    collectedAmount: z.number().min(0).optional(),
    collectedDate: z.string().optional().or(z.literal("")),
});

export async function getPipelines() {
    // Normalize Firestore Timestamp/Date to ISO string (plain-object safe for RSC serialization)
    const toISO = (val: any): string | null => {
        if (val == null) return null;
        if (typeof val === "string" && val.includes("T")) return val;
        if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
        if (val instanceof Date) return val.toISOString();
        if (val && typeof val.toDate === "function") return val.toDate().toISOString();
        // Firestore Timestamp sometimes appears as plain object { _seconds, _nanoseconds }
        if (typeof val === "object" && typeof val._seconds === "number") {
            return new Date(val._seconds * 1000 + (val._nanoseconds || 0) / 1e6).toISOString();
        }
        const s = String(val);
        if (s.includes("T")) return s;
        return s.slice(0, 10) || null;
    };

    // Converts any date-like value to YYYY-MM-DD for HTML date inputs
    const toDateInput = (val: any): string => {
        const iso = toISO(val);
        if (!iso) return "";
        return iso.split("T")[0];
    };

    try {
        const session = await requireAuth();
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);

        // Use cached pipelines/stages/users to avoid redundant Firestore reads
        const [cachedPipelinesData, oppsSnapshot, contactsSnap, cachedUsersData] = await Promise.all([
            getCachedPipelines(workspaceId),
            db.collection('opportunities').orderBy('createdAt', 'desc').get(),
            db.collection('contacts').get(),
            getCachedUsers(workspaceId),
        ]);

        const pipelinesMap: Record<string, any> = {};
        for (const p of cachedPipelinesData) {
            pipelinesMap[p.id] = {
                id: p.id,
                name: p.name,
                stages: p.stages.map(s => ({ id: s.id, name: s.name, order: s.order })),
                deals: [],
            };
        }

        // Build stageId → (pipelineId, stageName) index for O(1) lookup
        const stageIndex: Record<string, { pipelineId: string; stageName: string }> = {};
        for (const pid in pipelinesMap) {
            for (const stage of pipelinesMap[pid].stages) {
                stageIndex[stage.id] = { pipelineId: pid, stageName: stage.name };
            }
        }

        // Build contacts and users maps
        const contactsMap: Record<string, any> = {};
        contactsSnap.docs.forEach(doc => {
            contactsMap[doc.id] = { id: doc.id, ...doc.data() };
        });
        const usersMap: Record<string, any> = {};
        for (const u of cachedUsersData) {
            usersMap[u.id] = u;
        }

        // Pre-fetch latest note per contact in parallel (only for contacts with deals)
        const contactNotesMap: Record<string, string> = {};
        try {
            const contactIdsWithDeals = new Set(oppsSnapshot.docs.map(d => d.data().contactId).filter(Boolean));
            const noteResults = await Promise.all(
                Array.from(contactIdsWithDeals).map(async (cid) => {
                    const snap = await db.subcollection('contacts', cid, 'notes')
                        .orderBy('createdAt', 'desc').limit(1).get();
                    return { cid, content: snap.empty ? null : (snap.docs[0].data().content || "") };
                })
            );
            for (const { cid, content } of noteResults) {
                if (content !== null) contactNotesMap[cid] = content;
            }
        } catch {
            // Fallback: notes map stays empty, opp.notes will be null
        }

        const allOpps = oppsSnapshot.docs.filter(doc => !doc.data().deletedAt).map(doc => {
            const data = doc.data();
            const contact = data.contactId ? contactsMap[data.contactId] : null;
            const assignee = data.assigneeId ? usersMap[data.assigneeId] : null;
            const stageInfo = data.pipelineStageId ? stageIndex[data.pipelineStageId] : null;

            const startDate = toDateInput(data.stayStartDate || contact?.stayStartDate);
            const endDate = toDateInput(data.stayEndDate || contact?.stayEndDate);
            const notes = data.notes || (data.contactId ? contactNotesMap[data.contactId] : null) || null;

            return {
                id: doc.id,
                pipelineId: stageInfo?.pipelineId || null,
                pipelineStageId: data.pipelineStageId || null,
                contactId: data.contactId || null,
                name: contact?.name || data.name || "Unknown",
                email: contact?.email || data.email || null,
                phone: contact?.phone || data.phone || null,
                base: data.militaryBase || null,
                specialAccommodationId: data.specialAccommodationId || null,
                stage: stageInfo?.stageName || (data.status && data.status !== "open" ? "—" : "Unknown"),
                value: Number(data.opportunityValue) || 0,
                margin: Number(data.estimatedProfit) || 0,
                priority: data.priority || "MEDIUM",
                startDate: startDate || null,
                endDate: endDate || null,
                assigneeId: data.assigneeId || null,
                assignee: assignee && assignee.name ? assignee.name.split(" ").map((w: string) => w[0]).join("").toUpperCase() : "—",
                assigneeName: assignee?.name || "Unassigned",
                leadSourceId: data.leadSourceId || null,
                tags: Array.isArray(data.tags) ? data.tags.map((t: any) => ({ tagId: t.tagId || null, name: t.name || null, color: t.color || null })) : [],
                source: data.source || null,
                unread: data.unread ?? false,
                unreadAt: toISO(data.unreadAt),
                lastSeenAt: toISO(data.lastSeenAt),
                lastSeenBy: data.lastSeenBy || null,
                notes: notes || null,
                reasonForStay: data.reasonForStay || null,
                requiredDocs: {
                    lease: data.requiredDocs?.lease ?? false,
                    tc: data.requiredDocs?.tc ?? false,
                    payment: data.requiredDocs?.payment ?? false,
                },
                blockers: Array.isArray(data.blockers) ? data.blockers : [],
                stageEnteredAt: (() => {
                    // Derive from stageHistory: last entry's enteredAt
                    const history = Array.isArray(data.stageHistory) ? data.stageHistory : [];
                    if (history.length > 0) {
                        const last = history[history.length - 1];
                        return toISO(last.enteredAt) || toISO(data.updatedAt);
                    }
                    return toISO(data.updatedAt) || toISO(data.createdAt);
                })(),
                claimedBy: data.claimedBy || null,
                claimedByName: data.claimedByName || null,
                claimedAt: toISO(data.claimedAt),
                revenueStatus: data.revenueStatus || "booked",
                collectedAmount: Number(data.collectedAmount) || 0,
                collectedDate: toDateInput(data.collectedDate) || null,
                paymentStatus: data.paymentStatus || "unpaid",
                status: data.status || "open",
                createdAt: toISO(data.createdAt),
                updatedAt: toISO(data.updatedAt)
            };
        });
        
        const firstPipelineId = Object.keys(pipelinesMap)[0] || null;
        for (const opp of allOpps) {
            if (opp.pipelineId && pipelinesMap[opp.pipelineId]) {
                pipelinesMap[opp.pipelineId].deals.push(opp);
            } else if (opp.status !== "open" && firstPipelineId) {
                // Non-open deals with deleted stages still belong to the pipeline
                pipelinesMap[firstPipelineId].deals.push(opp);
            }
        }

        return { success: true, pipelines: pipelinesMap };
    } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)), { action: "getPipelines" });
        return { success: false, error: "Failed to fetch pipeline data" };
    }
}

export async function markOpportunitySeen(id: string) {
    const parsed = markOpportunitySeenSchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        const seenBy = session.user.email || session.user.name || "unknown";

        await db.doc('opportunities', id).update({
            unread: false,
            lastSeenAt: new Date(),
            lastSeenBy: seenBy,
            updatedAt: new Date()
        });

        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to mark opportunity seen:", error);
        return { success: false, error: "Failed to mark seen" };
    }
}

export async function bulkCreateOpportunities(opportunities: any[], pipelineId: string) {
    const parsed = bulkCreateOpportunitiesSchema.safeParse({ opportunities, pipelineId });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);

        const pipelineRef = db.doc('pipelines', parsed.data.pipelineId);
        const stagesSnapshot = await db.subcollection('pipelines', parsed.data.pipelineId, 'stages').get();
        
        const stageMap = new Map();
        let defaultStageId: string | null = null;
        
        stagesSnapshot.forEach(doc => {
            const data = doc.data();
            stageMap.set(data.name.toLowerCase(), doc.id);
            if (data.name === "New Lead" || !defaultStageId) {
                defaultStageId = doc.id;
            }
        });

        if (!defaultStageId) {
            return { success: false, error: "No stages found for this pipeline." };
        }

        const batch = db.batch();

        for (const opp of opportunities) {
            let contactId = null;
            
            if (opp.email) {
                const contactQuery = await db.collection('contacts').where('email', '==', opp.email).limit(1).get();
                if (!contactQuery.empty) {
                    contactId = contactQuery.docs[0].id;
                }
            }

            if (!contactId) {
                const contactRef = db.collectionRef('contacts').doc();
                contactId = contactRef.id;
                batch.set(contactRef, {
                    name: opp.name || "Unknown",
                    email: opp.email || null,
                    phone: opp.phone || null,
                    status: "Lead",
                    workspaceId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            const stageId = stageMap.get(opp.stage?.toLowerCase()) || defaultStageId;
            const oppRef = db.collectionRef('opportunities').doc();
            
            batch.set(oppRef, {
                contactId: contactId,
                pipelineStageId: stageId,
                name: opp.dealName || `${opp.name}'s Deal`,
                opportunityValue: parseFloat(opp.value) || 0,
                estimatedProfit: parseFloat(opp.margin) || 0,
                priority: opp.priority || "MEDIUM",
                workspaceId,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        await batch.commit();

        logAudit(workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "opportunity",
            entityId: "bulk_import",
            entityName: `Bulk import of ${opportunities.length} opportunities`,
            metadata: { count: opportunities.length, pipelineId: parsed.data.pipelineId },
        }).catch(() => {});

        revalidatePath("/pipeline");
        return { success: true, count: opportunities.length };
    } catch (error) {
        console.error("Failed to bulk create opportunities:", error);
        return { success: false, error: "Failed to import opportunities" };
    }
}

export async function createPipeline(name: string) {
    const parsed = createPipelineSchema.safeParse({ name });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        if ((session.user as any).role === "AGENT") {
            return { success: false, error: "Unauthorized" };
        }
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);

        const pipelineRef = db.collectionRef('pipelines').doc();
        await pipelineRef.set({
            name,
            workspaceId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        logAudit(workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "pipeline",
            entityId: pipelineRef.id,
            entityName: name,
        }).catch(() => {});

        invalidatePipelinesCache(workspaceId);
        revalidatePath("/pipeline");
        return { success: true, pipeline: { id: pipelineRef.id, name } };
    } catch (error) {
        console.error("Failed to create pipeline:", error);
        return { success: false, error: "Failed to create pipeline" };
    }
}

export async function createPipelineStage(pipelineId: string, name: string, order: number) {
    const parsed = createPipelineStageSchema.safeParse({ pipelineId, name, order });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        if ((session.user as any).role === "AGENT") {
            return { success: false, error: "Unauthorized" };
        }
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);

        const stageRef = db.subcollection('pipelines', parsed.data.pipelineId, 'stages').doc();
        await stageRef.set({
            name,
            order,
            workspaceId
        });

        logAudit(workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "pipeline_stage",
            entityId: stageRef.id,
            entityName: name,
            metadata: { pipelineId: parsed.data.pipelineId },
        }).catch(() => {});

        invalidatePipelinesCache(workspaceId);
        revalidatePath("/pipeline");
        return { success: true, stage: { id: stageRef.id, name, order } };
    } catch (error) {
        console.error("Failed to create pipeline stage:", error);
        return { success: false, error: "Failed to create stage" };
    }
}

export async function updatePipelineStage(id: string, name: string, order: number) {
    const parsed = updatePipelineStageSchema.safeParse({ id, name, order });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        if ((session.user as any).role === "AGENT") {
            return { success: false, error: "Unauthorized" };
        }
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);

        // We need to find which pipeline contains this stage
        const pipelines = await db.collection('pipelines').get();
        for (const pipelineDoc of pipelines.docs) {
            const stageDoc = await pipelineDoc.ref.collection('stages').doc(id).get();
            if (stageDoc.exists) {
                await stageDoc.ref.update({ name, order });
                break;
            }
        }

        logAudit(workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "update",
            entity: "pipeline_stage",
            entityId: id,
            entityName: name,
        }).catch(() => {});

        invalidatePipelinesCache(workspaceId);
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to update pipeline stage:", error);
        return { success: false, error: "Failed to update stage" };
    }
}

export async function deletePipelineStage(id: string) {
    const parsed = deletePipelineStageSchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        if ((session.user as any).role === "AGENT") {
            return { success: false, error: "Unauthorized" };
        }
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);

        const pipelines = await db.collection('pipelines').get();
        for (const pipelineDoc of pipelines.docs) {
            const stageDoc = await pipelineDoc.ref.collection('stages').doc(parsed.data.id).get();
            if (stageDoc.exists) {
                const stageName = stageDoc.data()?.name || "";
                await stageDoc.ref.delete();

                logAudit(workspaceId, {
                    userId: (session.user as any).id || "",
                    userEmail: session.user.email || "",
                    userName: session.user.name || "",
                    action: "delete",
                    entity: "pipeline_stage",
                    entityId: parsed.data.id,
                    entityName: stageName,
                    metadata: { pipelineId: pipelineDoc.id },
                }).catch(() => {});

                break;
            }
        }

        invalidatePipelinesCache(workspaceId);
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete pipeline stage:", error);
        return { success: false, error: "Failed to delete stage" };
    }
}

export async function deletePipeline(id: string) {
    const parsed = deletePipelineSchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        if ((session.user as any).role === "AGENT") {
            return { success: false, error: "Unauthorized" };
        }
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);

        const pipelineRef = db.doc('pipelines', parsed.data.id);
        const pipelineSnap = await pipelineRef.get();
        const pipelineName = pipelineSnap.data()?.name || "";

        // Delete subcollections manually in Firestore
        const stagesSnapshot = await db.subcollection('pipelines', parsed.data.id, 'stages').get();
        const batch = db.batch();
        stagesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        batch.delete(pipelineRef);
        await batch.commit();

        logAudit(workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "delete",
            entity: "pipeline",
            entityId: parsed.data.id,
            entityName: pipelineName,
        }).catch(() => {});

        invalidatePipelinesCache(workspaceId);
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete pipeline:", error);
        return { success: false, error: "Failed to delete pipeline" };
    }
}

export async function createNewDeal(data: any, pipelineId?: string) {
    const parsed = createNewDealSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Invalid input" };
    if (pipelineId !== undefined) {
        const pidParsed = firestoreIdSchema.safeParse(pipelineId);
        if (!pidParsed.success) return { success: false, error: "Invalid pipeline ID" };
    }
    data = parsed.data;

    try {
        const session = await requireAuth();
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);

        let contactId = null;
        if (data.email) {
            const contactQuery = await db.collection('contacts').where('email', '==', data.email).limit(1).get();
            if (!contactQuery.empty) {
                contactId = contactQuery.docs[0].id;
            }
        } else if (data.contactId) {
            contactId = data.contactId;
        }

        if (!contactId) {
            const contactRef = db.collectionRef('contacts').doc();
            contactId = contactRef.id;
            
            let formattedStartDate = null;
            let formattedEndDate = null;
            if (data.startDate) formattedStartDate = new Date(data.startDate).toISOString();
            if (data.endDate) formattedEndDate = new Date(data.endDate).toISOString();

            await contactRef.set({
                name: data.name || "New Lead",
                email: data.email || null,
                phone: data.phone || null,
                stayStartDate: formattedStartDate,
                stayEndDate: formattedEndDate,
                status: "Lead",
                workspaceId,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        } else {
            // Update existing contact dates if provided
            const contactUpdate: any = { updatedAt: new Date() };
            if (data.name && data.name !== "New Lead") contactUpdate.name = data.name;
            if (data.phone) contactUpdate.phone = data.phone;
            if (data.startDate) contactUpdate.stayStartDate = new Date(data.startDate).toISOString();
            if (data.endDate) contactUpdate.stayEndDate = new Date(data.endDate).toISOString();
            await db.doc('contacts', contactId).update(contactUpdate);
        }

        // Find stage ID
        let targetPipelineId = pipelineId;
        if (!targetPipelineId) {
            const pipelinesSnap = await db.collection('pipelines').orderBy('createdAt', 'asc').limit(1).get();
            if (!pipelinesSnap.empty) {
                targetPipelineId = pipelinesSnap.docs[0].id;
            }
        }

        if (!targetPipelineId) return { success: false, error: "No pipeline found" };

        const pipelineRef = db.doc('pipelines', targetPipelineId);
        const stagesSnapshot = await db.subcollection('pipelines', targetPipelineId, 'stages').get();
        let stageId: string | null = null;
        stagesSnapshot.forEach(doc => {
            if (doc.data().name === data.stage || (!stageId && doc.data().name.includes('Lead'))) {
                stageId = doc.id;
            }
        });
        if (!stageId && !stagesSnapshot.empty) {
            stageId = stagesSnapshot.docs[0].id;
        }

        const oppRef = db.collectionRef('opportunities').doc();
        await oppRef.set({
            contactId: contactId,
            pipelineStageId: stageId,
            status: "open",
            name: `${data.name || "New Lead"} - Deal`,
            opportunityValue: Number(data.value) || 0,
            estimatedProfit: Number(data.margin) || 0,
            priority: data.priority || "MEDIUM",
            assigneeId: data.assigneeId || null,
            militaryBase: data.base || null,
            specialAccommodationId: data.specialAccommodationId || null,
            stayStartDate: data.startDate ? new Date(data.startDate).toISOString() : null,
            stayEndDate: data.endDate ? new Date(data.endDate).toISOString() : null,
            notes: data.notes || null,
            unread: true,
            unreadAt: new Date(),
            lastSeenAt: null,
            lastSeenBy: null,
            workspaceId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Notify team about the new opportunity
        await createNotification({
            title: "New opportunity created",
            message: `${data.name || "New Lead"}`,
            type: "opportunity",
            linkUrl: `/pipeline?deal=${oppRef.id}`
        });

        // Trigger workflow automations for new deal (legacy)
        triggerWorkflows(workspaceId, {
            type: "deal_created",
            data: {
                opportunityId: oppRef.id,
                contactId,
                contactName: data.name || "New Lead",
                contactEmail: data.email || "",
                dealName: `${data.name || "New Lead"} - Deal`,
                opportunityValue: Number(data.value) || 0,
                userId: (session.user as any).id || "",
            },
        }).catch(() => {});

        // Fire unified-engine "opportunity_created" trigger
        fireTrigger({
            workspaceId,
            type: "opportunity_created",
            contactId: contactId || "",
            contactEmail: data.email || undefined,
            payload: {
                opportunityId: oppRef.id,
                opportunityValue: Number(data.value) || 0,
                pipelineId: targetPipelineId,
            },
        }).catch(() => {});

        // Outbound webhook for external integrations
        const { dispatchWebhook: dispatchDealCreated } = await import("@/lib/webhooks/dispatcher");
        dispatchDealCreated(workspaceId, "deal.created", {
            id: oppRef.id,
            name: `${data.name || "New Lead"} - Deal`,
            value: Number(data.value) || 0,
            stageId,
            contactId,
            pipelineId: targetPipelineId,
        });

        if (data.notes) {
            await db.addToSubcollection('contacts', contactId, 'notes', {
                content: data.notes,
                contactId: contactId,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        logAudit(workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "opportunity",
            entityId: oppRef.id,
            entityName: data.name || "New Deal",
        }).catch(() => {});

        trackFirstForWorkspace({
            workspaceId,
            userId: (session.user as any).id || "",
            key: "dealCreatedAt",
            event: { name: "first_deal_created" },
        }).catch(() => {});

        revalidatePath("/pipeline");
        return { success: true, dealId: oppRef.id };
    } catch (error) {
        console.error("Failed to create new deal:", error);
        return { success: false, error: "Failed to create new deal" };
    }
}

export async function updateOpportunity(id: string, data: {
    pipelineStageId?: string;
    name?: string;
    email?: string;
    phone?: string;
    value?: number;
    margin?: number;
    priority?: string;
    startDate?: string;
    endDate?: string;
    base?: string;
    notes?: string | null;
    contactId?: string;
    assigneeId?: string | null;
    leadSourceId?: string | null;
    tagIds?: string[];
    blockers?: string[];
    revenueStatus?: "booked" | "collected" | "partial";
    collectedAmount?: number;
    collectedDate?: string;
    paymentStatus?: "unpaid" | "partial" | "paid";
    status?: "open" | "closed_won" | "closed_lost" | "archive";
    specialAccommodationId?: string | null;
}) {
    const idParsed = firestoreIdSchema.safeParse(id);
    if (!idParsed.success) return { success: false, error: "Invalid opportunity id" };
    const dataParsed = updateOpportunitySchema.safeParse(data);
    if (!dataParsed.success) return { success: false, error: "Invalid input" };
    data = dataParsed.data;

    try {
        const oppId = id && String(id).trim();
        if (!oppId) {
            return { success: false, error: "Invalid opportunity id" };
        }
        const session = await requireAuth();
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);
        const currentUserId = (session.user as any).id;

        // Only admins/owners can assign deals to other users
        if (data.assigneeId !== undefined && data.assigneeId !== null && data.assigneeId !== currentUserId) {
            const role = await getCurrentUserRole();
            if (role !== "ADMIN" && role !== "OWNER") {
                return { success: false, error: "Only admins and owners can assign deals to other users" };
            }
        }

        const updateData: Record<string, unknown> = { updatedAt: new Date() };

        if (data.pipelineStageId !== undefined) {
            updateData.pipelineStageId = data.pipelineStageId;
        }
        if (data.name !== undefined) updateData.name = data.name;
        if (data.value !== undefined) updateData.opportunityValue = Number(data.value) || 0;
        if (data.margin !== undefined) updateData.estimatedProfit = Number(data.margin) || 0;
        if (data.priority !== undefined) updateData.priority = data.priority;
        if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
        if (data.leadSourceId !== undefined) updateData.leadSourceId = data.leadSourceId;
        if (data.base !== undefined) updateData.militaryBase = data.base || null;
        if (data.specialAccommodationId !== undefined) updateData.specialAccommodationId = data.specialAccommodationId || null;
        if (data.startDate !== undefined) updateData.stayStartDate = data.startDate && String(data.startDate).trim() ? new Date(data.startDate).toISOString() : null;
        if (data.endDate !== undefined) updateData.stayEndDate = data.endDate && String(data.endDate).trim() ? new Date(data.endDate).toISOString() : null;
        if (data.notes !== undefined) updateData.notes = data.notes != null ? String(data.notes) : null;

        if (data.blockers !== undefined) updateData.blockers = data.blockers;
        if (data.revenueStatus !== undefined) updateData.revenueStatus = data.revenueStatus;
        if (data.collectedAmount !== undefined) updateData.collectedAmount = data.collectedAmount;
        if (data.collectedDate !== undefined) updateData.collectedDate = data.collectedDate && String(data.collectedDate).trim() ? new Date(data.collectedDate).toISOString() : null;
        if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus;

        // Deal status changes
        if (data.status !== undefined) {
            updateData.status = data.status;
        }

        if (data.tagIds !== undefined) {
            updateData.tags = await Promise.all(data.tagIds.map(async (tagId) => {
                const tagDoc = await db.doc('tags', tagId).get();
                return { 
                    tagId, 
                    name: tagDoc.data()?.name || null, 
                    color: tagDoc.data()?.color || null 
                };
            }));
        }

        const docRef = db.doc('opportunities', oppId);
        const snap = await docRef.get();
        if (!snap.exists) {
            return { success: false, error: "Opportunity not found" };
        }
        const beforeData = snap.data() || {};

        // Handle deal status transitions
        if (data.status !== undefined && data.status !== (beforeData.status || "open")) {
            const oldStatus = beforeData.status || "open";
            // Moving from open to closed/archive: save current stage for reopening
            if (oldStatus === "open" && data.status !== "open") {
                updateData.lastActiveStageId = beforeData.pipelineStageId || null;
            }
            // Moving from closed/archive back to open: restore last active stage
            if (oldStatus !== "open" && data.status === "open" && beforeData.lastActiveStageId) {
                updateData.pipelineStageId = beforeData.lastActiveStageId;
            }
        }

        // Track stage history for conversion metrics
        if (data.pipelineStageId !== undefined && data.pipelineStageId !== beforeData.pipelineStageId) {
            const history = Array.isArray(beforeData.stageHistory) ? [...beforeData.stageHistory] : [];
            history.push({ stageId: data.pipelineStageId, enteredAt: new Date() });
            updateData.stageHistory = history;
        }

        await docRef.update(updateData);

        // ── Outbound webhooks for external integrations ──
        // Stage move
        if (data.pipelineStageId !== undefined && data.pipelineStageId !== beforeData.pipelineStageId) {
            const { dispatchWebhook } = await import("@/lib/webhooks/dispatcher");
            dispatchWebhook(workspaceId, "deal.stage_changed", {
                id: oppId,
                fromStageId: beforeData.pipelineStageId || null,
                toStageId: data.pipelineStageId,
                value: Number(beforeData.opportunityValue) || 0,
                contactId: beforeData.contactId || null,
            });
        }
        // Status change → won / lost
        if (data.status !== undefined && data.status !== (beforeData.status || "open")) {
            if (data.status === "closed_won") {
                const { dispatchWebhook } = await import("@/lib/webhooks/dispatcher");
                dispatchWebhook(workspaceId, "deal.closed_won", {
                    id: oppId,
                    value: Number(beforeData.opportunityValue) || 0,
                    contactId: beforeData.contactId || null,
                });
            } else if (data.status === "closed_lost") {
                const { dispatchWebhook } = await import("@/lib/webhooks/dispatcher");
                dispatchWebhook(workspaceId, "deal.closed_lost", {
                    id: oppId,
                    value: Number(beforeData.opportunityValue) || 0,
                    contactId: beforeData.contactId || null,
                });
            }
        }

        // Auto-record commission + check referral conversion on stage change
        if (data.pipelineStageId !== undefined && data.pipelineStageId !== beforeData.pipelineStageId) {
            try {
                const bookedNames = new Set(["Closed Won", "Won", "Booked", "Signed", "Lease Signed"]);
                const pipelines = await db.collection('pipelines').get();
                for (const pDoc of pipelines.docs) {
                    const stageDoc = await pDoc.ref.collection('stages').doc(data.pipelineStageId).get();
                    if (stageDoc.exists) {
                        const stageName = stageDoc.data()?.name;
                        // Auto-record commission for booked stages
                        if (bookedNames.has(stageName)) {
                            const agentId = beforeData.claimedBy || beforeData.assigneeId;
                            if (agentId) {
                                recordCommission(oppId, agentId).catch(() => {});
                            }
                        }
                        // Advance referral status for every stage change
                        const contactId = beforeData.contactId || data.contactId;
                        const dealValue = Number(updateData.opportunityValue ?? beforeData.opportunityValue) || 0;
                        if (contactId) {
                            advanceReferralForStage(oppId, contactId, stageName, dealValue).catch(() => {});
                        }
                        break;
                    }
                }
            } catch { /* ignore commission/referral errors */ }

            // Execute stage automation rules
            try {
                const automationUserId = currentUserId || beforeData.claimedBy || beforeData.assigneeId || "";
                executeStageAutomations(workspaceId, oppId, data.pipelineStageId, automationUserId).catch(() => {});
            } catch { /* ignore stage automation errors */ }

            // Trigger workflow automations for stage change (legacy)
            triggerWorkflows(workspaceId, {
                type: "stage_changed",
                data: {
                    opportunityId: oppId,
                    contactId: beforeData.contactId || data.contactId || "",
                    contactName: beforeData.name || "",
                    contactEmail: beforeData.email || "",
                    dealName: beforeData.name || "",
                    opportunityValue: Number(updateData.opportunityValue ?? beforeData.opportunityValue) || 0,
                    previousStageId: beforeData.pipelineStageId || "",
                    newStageId: data.pipelineStageId,
                    userId: currentUserId || "",
                },
            }).catch(() => {});

            // Fire unified-engine "pipeline_stage_entered" trigger for the new stage
            fireTrigger({
                workspaceId,
                type: "pipeline_stage_entered",
                contactId: beforeData.contactId || data.contactId || "",
                contactEmail: beforeData.email || undefined,
                match: { stageId: data.pipelineStageId },
                payload: {
                    opportunityId: oppId,
                    previousStageId: beforeData.pipelineStageId || "",
                    newStageId: data.pipelineStageId,
                },
            }).catch(() => {});
        }

        // Fire "opportunity_won" when status flips to closed_won
        if (
            data.status === "closed_won" &&
            beforeData.status !== "closed_won"
        ) {
            fireTrigger({
                workspaceId,
                type: "opportunity_won",
                contactId: beforeData.contactId || data.contactId || "",
                contactEmail: beforeData.email || undefined,
                payload: {
                    opportunityId: oppId,
                    opportunityValue: Number(updateData.opportunityValue ?? beforeData.opportunityValue) || 0,
                },
            }).catch(() => {});
        }

        // Fire "opportunity_lost" when status flips to closed_lost
        if (
            data.status === "closed_lost" &&
            beforeData.status !== "closed_lost"
        ) {
            fireTrigger({
                workspaceId,
                type: "opportunity_lost",
                contactId: beforeData.contactId || data.contactId || "",
                contactEmail: beforeData.email || undefined,
                payload: {
                    opportunityId: oppId,
                    opportunityValue: Number(updateData.opportunityValue ?? beforeData.opportunityValue) || 0,
                    previousStatus: beforeData.status,
                },
            }).catch(() => {});
        }

        // Fire "opportunity_value_changed" when value changes (and isn't trivially identical)
        if (
            data.value !== undefined &&
            Number(updateData.opportunityValue) !== Number(beforeData.opportunityValue)
        ) {
            fireTrigger({
                workspaceId,
                type: "opportunity_value_changed",
                contactId: beforeData.contactId || data.contactId || "",
                contactEmail: beforeData.email || undefined,
                payload: {
                    opportunityId: oppId,
                    previousValue: Number(beforeData.opportunityValue) || 0,
                    newValue: Number(updateData.opportunityValue) || 0,
                },
            }).catch(() => {});
        }

        // Audit log
        if (session?.user) {
            const auditFields = ["pipelineStageId", "opportunityValue", "estimatedProfit", "priority", "assigneeId", "stayStartDate", "stayEndDate", "notes", "status"];
            const changes = diffChanges(beforeData, updateData, auditFields);
            if (changes) {
                logAudit(workspaceId, {
                    userId: (session.user as any).id || "",
                    userEmail: session.user.email || "",
                    userName: session.user.name || "",
                    action: data.pipelineStageId !== undefined && data.pipelineStageId !== beforeData.pipelineStageId ? "stage_move" : "update",
                    entity: "opportunity",
                    entityId: oppId,
                    entityName: beforeData.name || "",
                    changes,
                }).catch(() => {});
            }
        }

        if (data.contactId && data.notes !== undefined) {
            const content = data.notes ? String(data.notes).trim() : "";
            if (content) {
                await db.addToSubcollection('contacts', data.contactId, 'notes', {
                    content,
                    contactId: data.contactId,
                    opportunityId: oppId,
                    source: "opportunity",
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        }

        if (data.contactId && (data.startDate !== undefined || data.endDate !== undefined || data.name !== undefined || data.email !== undefined || data.phone !== undefined)) {
            const contactUpdate: any = { updatedAt: new Date() };
            if (data.startDate !== undefined) contactUpdate.stayStartDate = data.startDate && String(data.startDate).trim() ? new Date(data.startDate).toISOString() : null;
            if (data.endDate !== undefined) contactUpdate.stayEndDate = data.endDate && String(data.endDate).trim() ? new Date(data.endDate).toISOString() : null;
            if (data.name !== undefined) contactUpdate.name = data.name;
            if (data.email !== undefined) contactUpdate.email = data.email;
            if (data.phone !== undefined) contactUpdate.phone = data.phone;

            await db.doc('contacts', data.contactId).update(contactUpdate);
        }

        revalidatePath("/pipeline");
        revalidatePath("/calendar");
        return { success: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to update opportunity";
        console.error("Failed to update opportunity:", error);
        return { success: false, error: String(message) };
    }
}

export async function updateBlockers(id: string, blockers: string[]) {
    const parsed = updateBlockersSchema.safeParse({ id, blockers });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        const docRef = db.doc('opportunities', id);
        const snap = await docRef.get();
        if (!snap.exists) return { success: false, error: "Opportunity not found" };

        await docRef.update({ blockers, updatedAt: new Date() });

        logAudit(session.user.workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "update",
            entity: "opportunity",
            entityId: id,
            entityName: snap.data()?.name || "",
            metadata: { field: "blockers", blockers },
        }).catch(() => {});

        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to update blockers:", error);
        return { success: false, error: "Failed to update blockers" };
    }
}

export async function claimOpportunity(id: string) {
    const parsed = claimOpportunitySchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        const userId = (session.user as any).id;
        const userName = session.user.name || session.user.email || "Unknown";

        const docRef = db.doc('opportunities', id);
        const snap = await docRef.get();
        if (!snap.exists) return { success: false, error: "Opportunity not found" };

        const data = snap.data()!;

        // If already claimed by this user, unclaim
        if (data.claimedBy === userId) {
            await docRef.update({
                claimedBy: null,
                claimedByName: null,
                claimedAt: null,
                updatedAt: new Date(),
            });
            revalidatePath("/pipeline");
            return { success: true, action: "unclaimed" };
        }

        await docRef.update({
            claimedBy: userId,
            claimedByName: userName,
            claimedAt: new Date(),
            updatedAt: new Date(),
        });

        logAudit(session.user.workspaceId, {
            userId,
            userEmail: session.user.email || "",
            userName,
            action: "claim",
            entity: "opportunity",
            entityId: id,
            entityName: data.name || "",
        }).catch(() => {});

        revalidatePath("/pipeline");
        return { success: true, action: "claimed" };
    } catch (error) {
        console.error("Failed to claim opportunity:", error);
        return { success: false, error: "Failed to claim opportunity" };
    }
}

export async function deleteOpportunity(id: string) {
    const parsed = deleteOpportunitySchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);
        const role = await getCurrentUserRole();
        if (role === "AGENT") throw new Error("Unauthorized");

        // Tenant-isolation: confirm ownership before delete.
        const snap = await db.getOwned('opportunities', id);
        if (!snap) return { success: false, error: "Opportunity not found" };
        const name = snap.data()?.name || "";
        await db.doc('opportunities', id).delete();

        logAudit(session.user.workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "delete",
            entity: "opportunity",
            entityId: id,
            entityName: name,
        }).catch(() => {});

        revalidatePath("/pipeline");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete opportunity:", error);
        return { success: false, error: error.message || "Failed to delete opportunity" };
    }
}

export async function softDeleteOpportunity(id: string) {
    const parsed = deleteOpportunitySchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const role = await getCurrentUserRole();
        if (role === "AGENT") {
            throw new Error("Unauthorized");
        }

        const userId = (session.user as any).id || "";
        const res = await softDelete(session.user.workspaceId, 'opportunities', id, userId);
        if (!res.success) return res;

        revalidatePath("/pipeline");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to soft-delete opportunity:", error);
        return { success: false, error: error.message || "Failed to delete opportunity" };
    }
}

export async function restoreOpportunity(id: string) {
    const parsed = deleteOpportunitySchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const res = await restoreItem(session.user.workspaceId, 'opportunities', id);
        if (!res.success) return res;

        revalidatePath("/pipeline");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to restore opportunity:", error);
        return { success: false, error: error.message || "Failed to restore opportunity" };
    }
}

export async function permanentlyDeleteOpportunity(id: string) {
    const parsed = deleteOpportunitySchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        return await deleteOpportunity(id);
    } catch (error: any) {
        console.error("Failed to permanently delete opportunity:", error);
        return { success: false, error: error.message || "Failed to permanently delete opportunity" };
    }
}

/** @deprecated Locations are now managed via custom fields. */
export async function getBaseNames(): Promise<string[]> {
    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);
        const snap = await db.collection('military_bases').get();
        return snap.docs
            .map(d => (d.data().name as string) || "")
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    } catch {
        return [];
    }
}

// AFCrashpad: special accommodation options (Spouse, Traveling with Pet, EV, …), ordered.
export async function getSpecialAccommodations(): Promise<{ id: string; name: string }[]> {
    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);
        const snap = await db.collection('special_accommodations').get();
        return snap.docs
            .map(d => ({ id: d.id, name: (d.data().name as string) || "", order: typeof d.data().order === "number" ? d.data().order : 999 }))
            .filter(a => a.name)
            .sort((a, b) => a.order - b.order)
            .map(({ id, name }) => ({ id, name }));
    } catch {
        return [];
    }
}

export async function getUsers() {
    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);
        const snapshot = await db.collection('users').orderBy('name', 'asc').get();
        const users = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            email: doc.data().email,
            role: doc.data().role
        }));
        return { success: true, users };
    } catch {
        return { success: true, users: [] };
    }
}

/**
 * Consolidated page-data fetch: returns pipelines + base names + users +
 * priority settings in a single server action call (saves several HTTP
 * round trips on page load).
 */
export async function getPipelinePageData() {
    try {
        const session = await requireAuth();
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);

        const [pipelinesResult, baseNames, usersResult, priorityResult, specialAccommodations] = await Promise.all([
            getPipelines(),
            getBaseNames(),
            getUsers(),
            (async () => {
                const doc = await db.settingsDoc("pipeline").get();
                const data = doc.data();
                return {
                    urgentDays: typeof data?.priorityUrgentDays === "number" ? data.priorityUrgentDays : 14,
                    soonDays: typeof data?.prioritySoonDays === "number" ? data.prioritySoonDays : 30,
                };
            })(),
            getSpecialAccommodations(),
        ]);

        // Fire-and-forget: stay reminders
        checkStayReminders(workspaceId).catch(() => {});

        return {
            success: true,
            pipelines: pipelinesResult.success ? pipelinesResult.pipelines : {},
            baseNames,
            specialAccommodations,
            users: usersResult.success ? usersResult.users : [],
            priorityRanges: priorityResult,
            advancedCount: 0,
        };
    } catch (error: any) {
        captureError(error, { context: "getPipelinePageData" });
        return {
            success: false,
            pipelines: {},
            baseNames: [],
            specialAccommodations: [],
            users: [],
            priorityRanges: { urgentDays: 14, soonDays: 30 },
            advancedCount: 0,
        };
    }
}

export async function updateRequiredDocs(opportunityId: string, field: string, value: boolean) {
    const parsed = updateRequiredDocsSchema.safeParse({ opportunityId, field, value });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        await db.doc('opportunities', parsed.data.opportunityId).update({
            [`requiredDocs.${field}`]: value,
            updatedAt: new Date()
        });
        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to update required docs:", error);
        return { success: false, error: "Failed to update required docs" };
    }
}

// ── Lifecycle: move a deal to the "Lease Signed" stage in its own pipeline ────
export async function moveToLeaseSigned(opportunityId: string) {
    const parsed = moveToLeaseSignedSchema.safeParse({ opportunityId });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);
        const currentUserId = (session.user as any).id;

        // Find the opportunity to get its current stage
        const docRef = db.doc('opportunities', parsed.data.opportunityId);
        const oppDoc = await docRef.get();
        if (!oppDoc.exists) return { success: false, error: "Opportunity not found" };

        const oppData = oppDoc.data()!;
        const currentStageId = oppData.pipelineStageId;

        // Resolve the "Lease Signed" stage within the deal's own pipeline
        const pipelines = await db.collection('pipelines').get();
        let leaseSignedStageId: string | null = null;

        for (const pDoc of pipelines.docs) {
            const stages = await db.subcollection('pipelines', pDoc.id, 'stages').get();
            const hasCurrentStage = stages.docs.some(s => s.id === currentStageId);
            if (hasCurrentStage) {
                const leaseStage = stages.docs.find(s => s.data().name === "Lease Signed");
                if (leaseStage) leaseSignedStageId = leaseStage.id;
                break;
            }
        }

        if (!leaseSignedStageId) return { success: false, error: "Lease Signed stage not found in this pipeline" };

        const history = Array.isArray(oppData.stageHistory) ? [...oppData.stageHistory] : [];
        history.push({ stageId: leaseSignedStageId, enteredAt: new Date() });
        await docRef.update({
            pipelineStageId: leaseSignedStageId,
            stageHistory: history,
            updatedAt: new Date()
        });

        // Execute stage automation rules for Lease Signed
        try {
            const userId = currentUserId || oppData.claimedBy || oppData.assigneeId || "";
            executeStageAutomations(workspaceId, parsed.data.opportunityId, leaseSignedStageId, userId).catch(() => {});
        } catch { /* ignore stage automation errors */ }

        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to move to Lease Signed:", error);
        return { success: false, error: "Failed to move to Lease Signed" };
    }
}

// ── Lifecycle: auto-advance Lease Signed / Move-in Scheduled deals whose stay
// has started to "Current Tenant" (fires referral conversion). Tenant-scoped so
// the daily cron can invoke it per workspace.
export async function autoAdvanceOpportunities(workspaceId: string) {
    try {
        const db = tenantDb(workspaceId);
        const now = new Date();
        const today = now.toISOString().split("T")[0];

        // Find "Lease Signed"/"Move In Scheduled" trigger stages + "Current Tenant" target per pipeline
        const pipelinesSnap = await db.collection('pipelines').get();

        let advancedCount = 0;

        for (const pDoc of pipelinesSnap.docs) {
            const stagesSnap = await db.subcollection('pipelines', pDoc.id, 'stages').get();

            const triggerStageIds = new Set<string>();
            let currentTenantStageId: string | null = null;

            for (const s of stagesSnap.docs) {
                const nameLower = String(s.data().name || "").toLowerCase();
                if (nameLower === "lease signed" || nameLower === "move in scheduled") {
                    triggerStageIds.add(s.id);
                }
                if (nameLower === "current tenant") {
                    currentTenantStageId = s.id;
                }
            }

            if (triggerStageIds.size === 0 || !currentTenantStageId) continue;

            for (const stageId of triggerStageIds) {
                const oppsSnap = await db.collection('opportunities')
                    .where('pipelineStageId', '==', stageId)
                    .get();

                for (const oppDoc of oppsSnap.docs) {
                    const data = oppDoc.data();
                    // Skip non-open deals
                    if (data.status && data.status !== "open") continue;
                    let startDate = data.stayStartDate;

                    // Fall back to the contact's stay start date if the deal has none
                    if (!startDate && data.contactId) {
                        const contactDoc = await db.doc('contacts', data.contactId).get();
                        if (contactDoc.exists) {
                            startDate = contactDoc.data()?.stayStartDate;
                        }
                    }

                    if (!startDate) continue;

                    // Normalize to YYYY-MM-DD for comparison
                    const startStr = typeof startDate === 'string'
                        ? startDate.split("T")[0]
                        : startDate.toDate ? startDate.toDate().toISOString().split("T")[0]
                        : null;

                    if (startStr && startStr <= today) {
                        const history = Array.isArray(data.stageHistory) ? [...data.stageHistory] : [];
                        history.push({ stageId: currentTenantStageId, enteredAt: new Date() });
                        await oppDoc.ref.update({
                            pipelineStageId: currentTenantStageId,
                            stageHistory: history,
                            updatedAt: new Date()
                        });
                        advancedCount++;

                        // Check if this advancement triggers a referral payout
                        if (data.contactId) {
                            const dealValue = Number(data.opportunityValue) || 0;
                            checkReferralConversion(oppDoc.id, data.contactId, dealValue).catch(() => {});
                        }
                    }
                }
            }
        }

        revalidatePath("/pipeline");
        return { success: true, advancedCount };
    } catch (error) {
        console.error("Failed to auto-advance opportunities:", error);
        return { success: false, error: "Failed to auto-advance opportunities" };
    }
}

export async function runStayReminders() {
    try {
        const session = await requireAuth();
        const result = await checkStayReminders(session.user.workspaceId);
        return { success: true, ...result };
    } catch (error) {
        console.error("Failed to run stay reminders:", error);
        return { success: false };
    }
}

// ── Bulk Actions ────────────────────────────────────────────────────────────

const bulkDealIdsSchema = z.array(firestoreIdSchema).min(1).max(200);

export async function bulkDeleteDeals(dealIds: string[]) {
    const parsed = bulkDealIdsSchema.safeParse(dealIds);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        if ((session.user as any).role === "AGENT") {
            throw new Error("Unauthorized");
        }
        const db = tenantDb(session.user.workspaceId);

        // Tenant-isolation: drop any IDs that don't belong to this workspace.
        const ownedIds: string[] = [];
        for (const id of parsed.data) {
            const owned = await db.getOwned('opportunities', id);
            if (owned) ownedIds.push(id);
        }

        const batch = db.batch();
        for (const id of ownedIds) {
            batch.delete(db.doc('opportunities', id));
        }
        await batch.commit();

        logAudit(session.user.workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "bulk_delete",
            entity: "opportunity",
            entityId: ownedIds.join(","),
            entityName: `${ownedIds.length} opportunities`,
            metadata: { count: ownedIds.length, requested: parsed.data.length },
        }).catch(() => {});

        revalidatePath("/pipeline");
        return { success: true, count: ownedIds.length };
    } catch (error: any) {
        console.error("Failed to bulk delete deals:", error);
        return { success: false, error: error.message || "Failed to bulk delete deals" };
    }
}

export async function bulkMoveDeals(dealIds: string[], stageId: string) {
    const idsParsed = bulkDealIdsSchema.safeParse(dealIds);
    const stageParsed = firestoreIdSchema.safeParse(stageId);
    if (!idsParsed.success || !stageParsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        const pipelinesSnap = await db.collection('pipelines').get();
        const stageToPipeline = new Map<string, string>();
        let targetPipelineId: string | null = null;
        for (const pipeline of pipelinesSnap.docs) {
            const stagesSnap = await db.subcollection('pipelines', pipeline.id, 'stages').get();
            for (const stage of stagesSnap.docs) {
                stageToPipeline.set(stage.id, pipeline.id);
                if (stage.id === stageParsed.data) targetPipelineId = pipeline.id;
            }
        }
        if (!targetPipelineId) {
            return { success: false, error: "Target stage not found in any pipeline" };
        }

        const ownedIds: string[] = [];
        let skippedCrossPipeline = 0;
        for (const id of idsParsed.data) {
            const owned = await db.getOwned('opportunities', id);
            if (!owned) continue;
            const currentStageId = (owned.data() as any)?.pipelineStageId;
            const currentPipelineId = currentStageId ? stageToPipeline.get(currentStageId) : null;
            if (currentPipelineId && currentPipelineId !== targetPipelineId) {
                skippedCrossPipeline++;
                continue;
            }
            ownedIds.push(id);
        }

        const batch = db.batch();
        for (const id of ownedIds) {
            batch.update(db.doc('opportunities', id), {
                pipelineStageId: stageParsed.data,
                updatedAt: new Date(),
            });
        }
        await batch.commit();

        logAudit(session.user.workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "bulk_move",
            entity: "opportunity",
            entityId: idsParsed.data.join(","),
            entityName: `${ownedIds.length} opportunities moved to stage ${stageParsed.data}`,
            metadata: { skippedCrossPipeline },
        }).catch(() => {});

        revalidatePath("/pipeline");
        return {
            success: true,
            count: ownedIds.length,
            skippedCrossPipeline,
        };
    } catch (error: any) {
        console.error("Failed to bulk move deals:", error);
        return { success: false, error: error.message || "Failed to bulk move deals" };
    }
}

// ── Payment Tracking Actions ─────────────────────────────────────────────────

export async function addPayment(dealId: string, amount: number, date: string, method: string, notes?: string) {
    const parsed = addPaymentSchema.safeParse({ dealId, amount, date, method, notes });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };

    try {
        const session = await requireAuth();
        const { workspaceId } = session.user;
        const db = tenantDb(workspaceId);

        const paymentRef = db.subcollection('opportunities', parsed.data.dealId, 'payments').doc();
        await paymentRef.set({
            amount: parsed.data.amount,
            date: parsed.data.date,
            method: parsed.data.method,
            notes: parsed.data.notes || "",
            recordedBy: session.user.name || session.user.email || "Unknown",
            workspaceId,
            createdAt: new Date(),
        });

        // Recalculate payment status based on total payments vs deal value
        const oppDoc = await db.doc('opportunities', parsed.data.dealId).get();
        const oppData = oppDoc.data();
        const dealValue = Number(oppData?.opportunityValue) || 0;

        const paymentsSnap = await db.subcollection('opportunities', parsed.data.dealId, 'payments').get();
        let totalPaid = 0;
        paymentsSnap.docs.forEach(doc => { totalPaid += Number(doc.data().amount) || 0; });

        let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
        let revenueStatus: "booked" | "partial" | "collected" = "booked";
        if (totalPaid > 0 && totalPaid < dealValue) {
            paymentStatus = "partial";
            revenueStatus = "partial";
        } else if (totalPaid >= dealValue && dealValue > 0) {
            paymentStatus = "paid";
            revenueStatus = "collected";
        }

        await db.doc('opportunities', parsed.data.dealId).update({
            paymentStatus,
            revenueStatus,
            collectedAmount: totalPaid,
            collectedDate: paymentStatus === "paid" ? new Date().toISOString() : null,
            updatedAt: new Date(),
        });

        logAudit(workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "payment",
            entityId: paymentRef.id,
            entityName: `Payment of $${parsed.data.amount.toFixed(2)} on deal ${parsed.data.dealId}`,
            metadata: { dealId: parsed.data.dealId, amount: parsed.data.amount, method: parsed.data.method },
        }).catch(() => {});

        revalidatePath("/pipeline");
        revalidatePath("/finance");
        return { success: true, paymentId: paymentRef.id, totalPaid, paymentStatus, revenueStatus };
    } catch (error) {
        console.error("Failed to add payment:", error);
        return { success: false, error: "Failed to record payment" };
    }
}

export async function getPayments(dealId: string) {
    const parsed = getPaymentsSchema.safeParse({ dealId });
    if (!parsed.success) return { success: false, error: "Invalid input", payments: [] };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        const paymentsSnap = await db
            .subcollection('opportunities', parsed.data.dealId, 'payments')
            .orderBy('createdAt', 'desc')
            .get();

        const payments = paymentsSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                amount: Number(data.amount) || 0,
                date: data.date || "",
                method: data.method || "other",
                notes: data.notes || "",
                recordedBy: data.recordedBy || "Unknown",
                createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            };
        });

        return { success: true, payments };
    } catch (error) {
        console.error("Failed to get payments:", error);
        return { success: false, error: "Failed to fetch payments", payments: [] };
    }
}

export async function updatePaymentStatus(dealId: string, status: "unpaid" | "partial" | "paid") {
    const parsed = updatePaymentStatusSchema.safeParse({ dealId, status });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        await db.doc('opportunities', parsed.data.dealId).update({
            paymentStatus: parsed.data.status,
            updatedAt: new Date(),
        });

        revalidatePath("/pipeline");
        revalidatePath("/finance");
        return { success: true };
    } catch (error) {
        console.error("Failed to update payment status:", error);
        return { success: false, error: "Failed to update payment status" };
    }
}

export async function updateRevenueStatus(dealId: string, revenueStatus: "booked" | "collected" | "partial", collectedAmount?: number, collectedDate?: string) {
    const parsed = updateRevenueStatusSchema.safeParse({ dealId, revenueStatus, collectedAmount, collectedDate });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        const updateData: Record<string, unknown> = {
            revenueStatus: parsed.data.revenueStatus,
            updatedAt: new Date(),
        };
        if (parsed.data.collectedAmount !== undefined) {
            updateData.collectedAmount = parsed.data.collectedAmount;
        }
        if (parsed.data.collectedDate) {
            updateData.collectedDate = new Date(parsed.data.collectedDate).toISOString();
        }
        if (parsed.data.revenueStatus === "collected") {
            updateData.paymentStatus = "paid";
            if (!parsed.data.collectedDate) {
                updateData.collectedDate = new Date().toISOString();
            }
        }

        await db.doc('opportunities', parsed.data.dealId).update(updateData);

        logAudit(session.user.workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "update",
            entity: "opportunity",
            entityId: parsed.data.dealId,
            entityName: `Revenue status updated to ${parsed.data.revenueStatus}`,
        }).catch(() => {});

        revalidatePath("/pipeline");
        revalidatePath("/finance");
        return { success: true };
    } catch (error) {
        console.error("Failed to update revenue status:", error);
        return { success: false, error: "Failed to update revenue status" };
    }
}

export async function getRevenueData() {
    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        const toDateInput = (val: any): string => {
            if (!val) return "";
            if (typeof val === "string") return val.split("T")[0];
            if (val instanceof Date) return val.toISOString().split("T")[0];
            if (val && typeof val.toDate === "function") return val.toDate().toISOString().split("T")[0];
            if (typeof val === "object" && typeof val._seconds === "number") {
                return new Date(val._seconds * 1000).toISOString().split("T")[0];
            }
            return "";
        };

        const oppsSnap = await db.collection('opportunities').get();
        const deals = oppsSnap.docs
            .filter(doc => !doc.data().deletedAt)
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || "Unknown",
                    value: Number(data.opportunityValue) || 0,
                    revenueStatus: data.revenueStatus || "booked",
                    collectedAmount: Number(data.collectedAmount) || 0,
                    collectedDate: toDateInput(data.collectedDate),
                    paymentStatus: data.paymentStatus || "unpaid",
                    stage: data.pipelineStageId || null,
                };
            });

        const totalBooked = deals.reduce((sum, d) => sum + d.value, 0);
        const totalCollected = deals.reduce((sum, d) => sum + d.collectedAmount, 0);
        const outstanding = totalBooked - totalCollected;

        return {
            success: true,
            data: {
                totalBooked,
                totalCollected,
                outstanding,
                deals,
            },
        };
    } catch (error) {
        console.error("Failed to get revenue data:", error);
        return { success: false, error: "Failed to fetch revenue data" };
    }
}

export async function bulkAssignDeals(dealIds: string[], userId: string) {
    const idsParsed = bulkDealIdsSchema.safeParse(dealIds);
    const userParsed = firestoreIdSchema.safeParse(userId);
    if (!idsParsed.success || !userParsed.success) return { success: false, error: "Invalid input" };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        // Only admins/owners can bulk assign deals
        const role = await getCurrentUserRole();
        if (role !== "ADMIN" && role !== "OWNER") {
            return { success: false, error: "Only admins and owners can assign deals to other users" };
        }

        const batch = db.batch();
        for (const id of idsParsed.data) {
            const docRef = db.doc('opportunities', id);
            batch.update(docRef, {
                assigneeId: userParsed.data,
                updatedAt: new Date(),
            });
        }
        await batch.commit();

        logAudit(session.user.workspaceId, {
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "bulk_assign",
            entity: "opportunity",
            entityId: idsParsed.data.join(","),
            entityName: `${idsParsed.data.length} opportunities assigned to ${userParsed.data}`,
        }).catch(() => {});

        revalidatePath("/pipeline");
        return { success: true, count: idsParsed.data.length };
    } catch (error: any) {
        console.error("Failed to bulk assign deals:", error);
        return { success: false, error: error.message || "Failed to bulk assign deals" };
    }
}

// ── Expenses ────────────────────────────────────────────────────────────────

export async function updateDealExpenses(dealId: string, expenses: { monthlyRent: number; cleaningFee: number; petFee: number; nonrefundableDeposit: number }) {
    const parsed = updateExpensesSchema.safeParse({ dealId, expenses });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        await db.doc('opportunities', parsed.data.dealId).update({
            expenses: parsed.data.expenses,
            updatedAt: new Date(),
        });

        revalidatePath("/pipeline");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update deal expenses:", error);
        return { success: false, error: error.message || "Failed to update expenses" };
    }
}

export async function getDealExpenses(dealId: string) {
    const parsed = firestoreIdSchema.safeParse(dealId);
    if (!parsed.success) return { success: false, expenses: null };

    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);

        const doc = await db.doc('opportunities', parsed.data).get();
        const data = doc.data();
        return {
            success: true,
            expenses: data?.expenses || { monthlyRent: 0, cleaningFee: 0, petFee: 0, nonrefundableDeposit: 0 },
        };
    } catch (error: any) {
        console.error("Failed to get deal expenses:", error);
        return { success: false, expenses: null };
    }
}

export async function getOpportunitiesList() {
    try {
        const session = await requireAuth();
        const db = tenantDb(session.user.workspaceId);
        const snap = await db.collection('opportunities').orderBy('createdAt', 'desc').get();
        const opportunities = snap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || doc.data().contactName || "Untitled Deal",
        }));
        return { success: true, opportunities };
    } catch {
        return { success: false, opportunities: [] };
    }
}
