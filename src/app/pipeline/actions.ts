"use server"

import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createNotification } from "@/app/notifications/actions";
import { checkStayReminders } from "@/lib/reminders";
import { logAudit, diffChanges } from "@/lib/audit";
import { recordCommission } from "@/app/dashboard/commissions/actions";
import { advanceReferralForStage, checkReferralConversion } from "@/app/dashboard/referrals/actions";
import { executeStageAutomations } from "@/lib/stage-automations";
import { softDelete, restoreItem, permanentlyDelete } from "@/lib/soft-delete";
import { captureError } from "@/lib/error-tracking";
import { getCurrentUserRole } from "@/app/settings/users/actions";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const firestoreIdSchema = z.string().min(1).max(128);

const markOpportunitySeenSchema = z.object({
    id: firestoreIdSchema,
});

const bulkCreateOpportunitiesSchema = z.object({
    opportunities: z.array(z.object({
        name: z.string().max(200).optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().max(50).optional().or(z.literal("")),
        base: z.string().max(200).optional().or(z.literal("")),
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
    stage: z.string().max(100).optional(),
    value: z.union([z.string(), z.number()]).optional(),
    margin: z.union([z.string(), z.number()]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    startDate: z.string().optional().or(z.literal("")),
    endDate: z.string().optional().or(z.literal("")),
    notes: z.string().max(5000).optional().or(z.literal("")),
    contactId: z.string().optional(),
    assigneeId: z.string().optional().nullable(),
    specialAccommodationId: z.string().optional().nullable(),
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
    notes: z.string().max(5000).optional().nullable(),
    contactId: z.string().optional(),
    assigneeId: z.string().optional().nullable(),
    leadSourceId: z.string().optional().nullable(),
    tagIds: z.array(z.string()).optional(),
    specialAccommodationId: z.string().optional().nullable(),
    blockers: z.array(z.string().max(500)).max(20).optional(),
    revenueStatus: z.enum(["booked", "collected", "partial"]).optional(),
    collectedAmount: z.number().min(0).optional(),
    collectedDate: z.string().optional().or(z.literal("")),
    paymentStatus: z.enum(["unpaid", "partial", "paid"]).optional(),
});

const updateBlockersSchema = z.object({
    id: firestoreIdSchema,
    blockers: z.array(z.string().max(500)).max(20),
});

const claimOpportunitySchema = z.object({ id: firestoreIdSchema });
const deleteOpportunitySchema = z.object({ id: firestoreIdSchema });

const updateRequiredDocsSchema = z.object({
    opportunityId: firestoreIdSchema,
    field: z.enum(["lease", "tc", "payment"]),
    value: z.boolean(),
});

const moveToLeaseSignedSchema = z.object({ opportunityId: firestoreIdSchema });

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
        const pipelinesSnapshot = await adminDb.collection('pipelines').orderBy('createdAt', 'asc').get();
        
        const pipelinesMap: Record<string, any> = {};
        
        // Load pipelines and their stages
        for (const doc of pipelinesSnapshot.docs) {
            const data = doc.data();
            const stagesSnapshot = await doc.ref.collection('stages').orderBy('order', 'asc').get();
            const stages = stagesSnapshot.docs.map(sDoc => ({
                id: sDoc.id,
                name: sDoc.data().name,
                order: sDoc.data().order
            }));
            
            pipelinesMap[doc.id] = {
                id: doc.id,
                name: data.name,
                stages: stages,
                deals: []
            };
        }

        // Build stageId → (pipelineId, stageName) index for O(1) lookup
        const stageIndex: Record<string, { pipelineId: string; stageName: string }> = {};
        for (const pid in pipelinesMap) {
            for (const stage of pipelinesMap[pid].stages) {
                stageIndex[stage.id] = { pipelineId: pid, stageName: stage.name };
            }
        }

        // Load all opportunities, contacts, and users in parallel (avoid N+1)
        const [oppsSnapshot, contactsSnap, usersSnap] = await Promise.all([
            adminDb.collection('opportunities').orderBy('createdAt', 'desc').get(),
            adminDb.collection('contacts').get(),
            adminDb.collection('users').get(),
        ]);

        // Build contacts and users maps from bulk queries
        const contactsMap: Record<string, any> = {};
        contactsSnap.docs.forEach(doc => {
            contactsMap[doc.id] = { id: doc.id, ...doc.data() };
        });
        const usersMap: Record<string, any> = {};
        usersSnap.docs.forEach(doc => {
            usersMap[doc.id] = { id: doc.id, ...doc.data() };
        });

        // Pre-fetch latest note per contact using collectionGroup (avoids N+1 note queries)
        const contactNotesMap: Record<string, string> = {};
        try {
            const allNotesSnap = await adminDb.collectionGroup('notes').orderBy('createdAt', 'desc').get();
            for (const noteDoc of allNotesSnap.docs) {
                const contactId = noteDoc.ref.parent.parent?.id;
                if (contactId && !contactNotesMap[contactId]) {
                    contactNotesMap[contactId] = noteDoc.data().content || "";
                }
            }
        } catch {
            // Fallback: notes map stays empty, opp.notes will be null
        }

        const allOpps = oppsSnapshot.docs.filter(doc => !doc.data().deletedAt).map(doc => {
            const data = doc.data();
            const contact = data.contactId ? contactsMap[data.contactId] : null;
            const assignee = data.assigneeId ? usersMap[data.assigneeId] : null;
            const stageInfo = data.pipelineStageId ? stageIndex[data.pipelineStageId] : null;

            const base = data.militaryBase || contact?.militaryBase || null;
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
                base: base || null,
                stage: stageInfo?.stageName || "Unknown",
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
                specialAccommodationId: data.specialAccommodationId || null,
                source: data.source || null,
                unread: data.unread ?? false,
                unreadAt: toISO(data.unreadAt),
                lastSeenAt: toISO(data.lastSeenAt),
                lastSeenBy: data.lastSeenBy || null,
                notes: notes || null,
                reasonForStay: data.reasonForStay || null,
                specialAccommodationLabels: Array.isArray(data.specialAccommodationLabels) ? data.specialAccommodationLabels : [],
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
                createdAt: toISO(data.createdAt),
                updatedAt: toISO(data.updatedAt)
            };
        });
        
        for (const opp of allOpps) {
            if (opp.pipelineId && pipelinesMap[opp.pipelineId]) {
                pipelinesMap[opp.pipelineId].deals.push(opp);
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
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const seenBy = (session.user as any).email || session.user.name || "unknown";

        await adminDb.collection('opportunities').doc(id).update({
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
        const pipelineRef = adminDb.collection('pipelines').doc(parsed.data.pipelineId);
        const stagesSnapshot = await pipelineRef.collection('stages').get();
        
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

        const batch = adminDb.batch();

        for (const opp of opportunities) {
            let contactId = null;
            
            if (opp.email) {
                const contactQuery = await adminDb.collection('contacts').where('email', '==', opp.email).limit(1).get();
                if (!contactQuery.empty) {
                    contactId = contactQuery.docs[0].id;
                }
            }

            if (!contactId) {
                const contactRef = adminDb.collection('contacts').doc();
                contactId = contactRef.id;
                batch.set(contactRef, {
                    name: opp.name || "Unknown",
                    email: opp.email || null,
                    phone: opp.phone || null,
                    militaryBase: opp.base || null,
                    status: "Lead",
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            const stageId = stageMap.get(opp.stage?.toLowerCase()) || defaultStageId;
            const oppRef = adminDb.collection('opportunities').doc();
            
            batch.set(oppRef, {
                contactId: contactId,
                pipelineStageId: stageId,
                name: opp.dealName || `${opp.name}'s Deal`,
                opportunityValue: parseFloat(opp.value) || 0,
                estimatedProfit: parseFloat(opp.margin) || 0,
                priority: opp.priority || "MEDIUM",
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        await batch.commit();

        const session = await auth();
        if (session?.user) {
            logAudit({
                userId: (session.user as any).id || "",
                userEmail: session.user.email || "",
                userName: session.user.name || "",
                action: "create",
                entity: "opportunity",
                entityId: "bulk_import",
                entityName: `Bulk import of ${opportunities.length} opportunities`,
                metadata: { count: opportunities.length, pipelineId: parsed.data.pipelineId },
            }).catch(() => {});
        }

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
        const session = await auth();
        if (!session?.user || (session.user as any).role === "AGENT") {
            return { success: false, error: "Unauthorized" };
        }

        const pipelineRef = adminDb.collection('pipelines').doc();
        await pipelineRef.set({
            name,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "pipeline",
            entityId: pipelineRef.id,
            entityName: name,
        }).catch(() => {});

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
        const session = await auth();
        if (!session?.user || (session.user as any).role === "AGENT") {
            return { success: false, error: "Unauthorized" };
        }

        const stageRef = adminDb.collection('pipelines').doc(parsed.data.pipelineId).collection('stages').doc();
        await stageRef.set({
            name,
            order
        });

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "pipeline_stage",
            entityId: stageRef.id,
            entityName: name,
            metadata: { pipelineId: parsed.data.pipelineId },
        }).catch(() => {});

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
        const session = await auth();
        if (!session?.user || (session.user as any).role === "AGENT") {
            return { success: false, error: "Unauthorized" };
        }

        // We need to find which pipeline contains this stage
        const pipelines = await adminDb.collection('pipelines').get();
        for (const pipelineDoc of pipelines.docs) {
            const stageDoc = await pipelineDoc.ref.collection('stages').doc(id).get();
            if (stageDoc.exists) {
                await stageDoc.ref.update({ name, order });
                break;
            }
        }

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "update",
            entity: "pipeline_stage",
            entityId: id,
            entityName: name,
        }).catch(() => {});

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
        const session = await auth();
        if (!session?.user || (session.user as any).role === "AGENT") {
            return { success: false, error: "Unauthorized" };
        }

        const pipelines = await adminDb.collection('pipelines').get();
        for (const pipelineDoc of pipelines.docs) {
            const stageDoc = await pipelineDoc.ref.collection('stages').doc(parsed.data.id).get();
            if (stageDoc.exists) {
                const stageName = stageDoc.data()?.name || "";
                await stageDoc.ref.delete();

                logAudit({
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
        const session = await auth();
        if (!session?.user || (session.user as any).role === "AGENT") {
            return { success: false, error: "Unauthorized" };
        }

        const pipelineRef = adminDb.collection('pipelines').doc(parsed.data.id);
        const pipelineSnap = await pipelineRef.get();
        const pipelineName = pipelineSnap.data()?.name || "";

        // Delete subcollections manually in Firestore
        const stagesSnapshot = await pipelineRef.collection('stages').get();
        const batch = adminDb.batch();
        stagesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        batch.delete(pipelineRef);
        await batch.commit();

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "delete",
            entity: "pipeline",
            entityId: parsed.data.id,
            entityName: pipelineName,
        }).catch(() => {});

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
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        let contactId = null;
        if (data.email) {
            const contactQuery = await adminDb.collection('contacts').where('email', '==', data.email).limit(1).get();
            if (!contactQuery.empty) {
                contactId = contactQuery.docs[0].id;
            }
        } else if (data.contactId) {
            contactId = data.contactId;
        }

        if (!contactId) {
            const contactRef = adminDb.collection('contacts').doc();
            contactId = contactRef.id;
            
            let formattedStartDate = null;
            let formattedEndDate = null;
            if (data.startDate) formattedStartDate = new Date(data.startDate).toISOString();
            if (data.endDate) formattedEndDate = new Date(data.endDate).toISOString();

            await contactRef.set({
                name: data.name || "New Lead",
                email: data.email || null,
                phone: data.phone || null,
                militaryBase: data.base || null,
                stayStartDate: formattedStartDate,
                stayEndDate: formattedEndDate,
                status: "Lead",
                createdAt: new Date(),
                updatedAt: new Date()
            });
        } else {
            // Update existing contact dates if provided
            const contactUpdate: any = { updatedAt: new Date() };
            if (data.name && data.name !== "New Lead") contactUpdate.name = data.name;
            if (data.phone) contactUpdate.phone = data.phone;
            if (data.base) contactUpdate.militaryBase = data.base;
            if (data.startDate) contactUpdate.stayStartDate = new Date(data.startDate).toISOString();
            if (data.endDate) contactUpdate.stayEndDate = new Date(data.endDate).toISOString();
            await adminDb.collection('contacts').doc(contactId).update(contactUpdate);
        }

        // Find stage ID
        let targetPipelineId = pipelineId;
        if (!targetPipelineId) {
            const pipelinesSnap = await adminDb.collection('pipelines').orderBy('createdAt', 'asc').limit(1).get();
            if (!pipelinesSnap.empty) {
                targetPipelineId = pipelinesSnap.docs[0].id;
            }
        }

        if (!targetPipelineId) return { success: false, error: "No pipeline found" };

        const pipelineRef = adminDb.collection('pipelines').doc(targetPipelineId);
        const stagesSnapshot = await pipelineRef.collection('stages').get();
        let stageId: string | null = null;
        stagesSnapshot.forEach(doc => {
            if (doc.data().name === data.stage || (!stageId && doc.data().name.includes('Lead'))) {
                stageId = doc.id;
            }
        });
        if (!stageId && !stagesSnapshot.empty) {
            stageId = stagesSnapshot.docs[0].id;
        }

        const oppRef = adminDb.collection('opportunities').doc();
        await oppRef.set({
            contactId: contactId,
            pipelineStageId: stageId,
            name: `${data.name || "New Lead"} - Deal`,
            opportunityValue: Number(data.value) || 0,
            estimatedProfit: Number(data.margin) || 0,
            priority: data.priority || "MEDIUM",
            assigneeId: data.assigneeId || null,
            specialAccommodationId: data.specialAccommodationId || null,
            militaryBase: data.base || null,
            stayStartDate: data.startDate ? new Date(data.startDate).toISOString() : null,
            stayEndDate: data.endDate ? new Date(data.endDate).toISOString() : null,
            notes: data.notes || null,
            unread: true,
            unreadAt: new Date(),
            lastSeenAt: null,
            lastSeenBy: null,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Notify team about the new opportunity
        await createNotification({
            title: "New opportunity created",
            message: `${data.name || "New Lead"}${data.base ? ` • ${data.base}` : ""}`,
            type: "opportunity",
            linkUrl: `/pipeline?deal=${oppRef.id}`
        });

        if (data.notes) {
            await adminDb.collection('contacts').doc(contactId).collection('notes').add({
                content: data.notes,
                contactId: contactId,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "opportunity",
            entityId: oppRef.id,
            entityName: data.name || "New Deal",
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
    specialAccommodationId?: string | null;
    blockers?: string[];
    revenueStatus?: "booked" | "collected" | "partial";
    collectedAmount?: number;
    collectedDate?: string;
    paymentStatus?: "unpaid" | "partial" | "paid";
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
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };
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
        if (data.specialAccommodationId !== undefined) updateData.specialAccommodationId = data.specialAccommodationId;
        if (data.base !== undefined) updateData.militaryBase = data.base || null;
        if (data.startDate !== undefined) updateData.stayStartDate = data.startDate && String(data.startDate).trim() ? new Date(data.startDate).toISOString() : null;
        if (data.endDate !== undefined) updateData.stayEndDate = data.endDate && String(data.endDate).trim() ? new Date(data.endDate).toISOString() : null;
        if (data.notes !== undefined) updateData.notes = data.notes != null ? String(data.notes) : null;

        if (data.blockers !== undefined) updateData.blockers = data.blockers;
        if (data.revenueStatus !== undefined) updateData.revenueStatus = data.revenueStatus;
        if (data.collectedAmount !== undefined) updateData.collectedAmount = data.collectedAmount;
        if (data.collectedDate !== undefined) updateData.collectedDate = data.collectedDate && String(data.collectedDate).trim() ? new Date(data.collectedDate).toISOString() : null;
        if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus;

        if (data.tagIds !== undefined) {
            updateData.tags = await Promise.all(data.tagIds.map(async (tagId) => {
                const tagDoc = await adminDb.collection('tags').doc(tagId).get();
                return { 
                    tagId, 
                    name: tagDoc.data()?.name || null, 
                    color: tagDoc.data()?.color || null 
                };
            }));
        }

        const docRef = adminDb.collection('opportunities').doc(oppId);
        const snap = await docRef.get();
        if (!snap.exists) {
            return { success: false, error: "Opportunity not found" };
        }
        const beforeData = snap.data() || {};

        // Track stage history for conversion metrics
        if (data.pipelineStageId !== undefined && data.pipelineStageId !== beforeData.pipelineStageId) {
            const history = Array.isArray(beforeData.stageHistory) ? [...beforeData.stageHistory] : [];
            history.push({ stageId: data.pipelineStageId, enteredAt: new Date() });
            updateData.stageHistory = history;
        }

        await docRef.update(updateData);

        // Auto-record commission + check referral conversion on stage change
        if (data.pipelineStageId !== undefined && data.pipelineStageId !== beforeData.pipelineStageId) {
            try {
                const bookedNames = new Set(["Booked", "Closed Won", "Lease Signed"]);
                const pipelines = await adminDb.collection('pipelines').get();
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
                executeStageAutomations(oppId, data.pipelineStageId, automationUserId).catch(() => {});
            } catch { /* ignore stage automation errors */ }
        }

        // Audit log
        if (session?.user) {
            const auditFields = ["pipelineStageId", "opportunityValue", "estimatedProfit", "priority", "assigneeId", "militaryBase", "stayStartDate", "stayEndDate", "notes"];
            const changes = diffChanges(beforeData, updateData, auditFields);
            if (changes) {
                logAudit({
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
                await adminDb.collection('contacts').doc(data.contactId).collection('notes').add({
                    content,
                    contactId: data.contactId,
                    opportunityId: oppId,
                    source: "opportunity",
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        }

        if (data.contactId && (data.startDate !== undefined || data.endDate !== undefined || data.base !== undefined || data.name !== undefined || data.email !== undefined || data.phone !== undefined)) {
            const contactUpdate: any = { updatedAt: new Date() };
            if (data.startDate !== undefined) contactUpdate.stayStartDate = data.startDate && String(data.startDate).trim() ? new Date(data.startDate).toISOString() : null;
            if (data.endDate !== undefined) contactUpdate.stayEndDate = data.endDate && String(data.endDate).trim() ? new Date(data.endDate).toISOString() : null;
            if (data.base !== undefined) contactUpdate.militaryBase = data.base || null;
            if (data.name !== undefined) contactUpdate.name = data.name;
            if (data.email !== undefined) contactUpdate.email = data.email;
            if (data.phone !== undefined) contactUpdate.phone = data.phone;

            await adminDb.collection('contacts').doc(data.contactId).update(contactUpdate);
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
        const session = await auth();
        if (!session?.user) return { success: false, error: "Not authenticated" };

        const docRef = adminDb.collection('opportunities').doc(id);
        const snap = await docRef.get();
        if (!snap.exists) return { success: false, error: "Opportunity not found" };

        await docRef.update({ blockers, updatedAt: new Date() });

        logAudit({
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
        const session = await auth();
        if (!session?.user) return { success: false, error: "Not authenticated" };

        const userId = (session.user as any).id;
        const userName = session.user.name || session.user.email || "Unknown";

        const docRef = adminDb.collection('opportunities').doc(id);
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

        logAudit({
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
        const session = await auth();
        if (!session?.user || (session.user as any).role === "AGENT") {
            throw new Error("Unauthorized");
        }

        const snap = await adminDb.collection('opportunities').doc(id).get();
        const name = snap.data()?.name || "";
        await adminDb.collection('opportunities').doc(id).delete();

        logAudit({
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
        const session = await auth();
        if (!session?.user || (session.user as any).role === "AGENT") {
            throw new Error("Unauthorized");
        }

        const userId = (session.user as any).id || "";
        const res = await softDelete('opportunities', id, userId);
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
        const res = await restoreItem('opportunities', id);
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

export async function getBaseNames(): Promise<string[]> {
    try {
        const metadataDoc = await adminDb.collection('metadata').doc('bases').get();
        if (metadataDoc.exists && metadataDoc.data()?.names) {
            return metadataDoc.data()?.names.sort();
        }
        
        // Fallback to legacy military_bases collection if metadata doc doesn't exist
        const snapshot = await adminDb.collection('military_bases').orderBy('name', 'asc').get();
        return snapshot.docs.map(doc => doc.data().name);
    } catch {
        return [];
    }
}

export async function getUsers() {
    try {
        const snapshot = await adminDb.collection('users').orderBy('name', 'asc').get();
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

export async function updateRequiredDocs(opportunityId: string, field: "lease" | "tc" | "payment", value: boolean) {
    const parsed = updateRequiredDocsSchema.safeParse({ opportunityId, field, value });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        await adminDb.collection('opportunities').doc(parsed.data.opportunityId).update({
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

export async function moveToLeaseSigned(opportunityId: string) {
    const parsed = moveToLeaseSignedSchema.safeParse({ opportunityId });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    try {
        // Find the opportunity to get its pipeline
        const oppDoc = await adminDb.collection('opportunities').doc(parsed.data.opportunityId).get();
        if (!oppDoc.exists) return { success: false, error: "Opportunity not found" };

        const oppData = oppDoc.data()!;
        const currentStageId = oppData.pipelineStageId;

        // Find which pipeline this belongs to
        const pipelines = await adminDb.collection('pipelines').get();
        let leaseSignedStageId: string | null = null;

        for (const pDoc of pipelines.docs) {
            const stages = await pDoc.ref.collection('stages').get();
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
        await adminDb.collection('opportunities').doc(opportunityId).update({
            pipelineStageId: leaseSignedStageId,
            stageHistory: history,
            updatedAt: new Date()
        });

        // Execute stage automation rules for Lease Signed
        try {
            const session = await auth();
            const userId = (session?.user as any)?.id || oppData.claimedBy || oppData.assigneeId || "";
            executeStageAutomations(opportunityId, leaseSignedStageId, userId).catch(() => {});
        } catch { /* ignore stage automation errors */ }

        revalidatePath("/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to move to Lease Signed:", error);
        return { success: false, error: "Failed to move to Lease Signed" };
    }
}

export async function autoAdvanceOpportunities() {
    try {
        const now = new Date();
        const today = now.toISOString().split("T")[0];

        // Get all pipelines and find "Lease Signed", "Move In Scheduled", and "Current Tenant" stages
        const pipelinesSnap = await adminDb.collection('pipelines').get();

        let advancedCount = 0;

        for (const pDoc of pipelinesSnap.docs) {
            const stagesSnap = await pDoc.ref.collection('stages').get();
            const stageMap = new Map<string, { id: string; name: string }>();
            stagesSnap.docs.forEach(s => stageMap.set(s.id, { id: s.id, name: s.data().name }));

            const triggerStageIds = new Set<string>();
            let currentTenantStageId: string | null = null;

            for (const [id, stage] of stageMap) {
                const nameLower = stage.name.toLowerCase();
                if (nameLower === "lease signed" || nameLower === "move in scheduled") {
                    triggerStageIds.add(id);
                }
                if (nameLower === "current tenant") {
                    currentTenantStageId = id;
                }
            }

            if (triggerStageIds.size === 0 || !currentTenantStageId) continue;

            // Find opportunities in these stages
            for (const stageId of triggerStageIds) {
                const oppsSnap = await adminDb.collection('opportunities')
                    .where('pipelineStageId', '==', stageId)
                    .get();

                for (const oppDoc of oppsSnap.docs) {
                    const data = oppDoc.data();
                    let startDate = data.stayStartDate;

                    // Try contact fallback if no direct start date
                    if (!startDate && data.contactId) {
                        const contactDoc = await adminDb.collection('contacts').doc(data.contactId).get();
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
        const result = await checkStayReminders();
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
        const session = await auth();
        if (!session?.user || (session.user as any).role === "AGENT") {
            throw new Error("Unauthorized");
        }

        const batch = adminDb.batch();
        for (const id of parsed.data) {
            batch.delete(adminDb.collection('opportunities').doc(id));
        }
        await batch.commit();

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "bulk_delete",
            entity: "opportunity",
            entityId: parsed.data.join(","),
            entityName: `${parsed.data.length} opportunities`,
        }).catch(() => {});

        revalidatePath("/pipeline");
        return { success: true, count: parsed.data.length };
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
        const session = await auth();
        if (!session?.user) throw new Error("Unauthorized");

        const batch = adminDb.batch();
        for (const id of idsParsed.data) {
            const docRef = adminDb.collection('opportunities').doc(id);
            batch.update(docRef, {
                pipelineStageId: stageParsed.data,
                updatedAt: new Date(),
            });
        }
        await batch.commit();

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "bulk_move",
            entity: "opportunity",
            entityId: idsParsed.data.join(","),
            entityName: `${idsParsed.data.length} opportunities moved to stage ${stageParsed.data}`,
        }).catch(() => {});

        revalidatePath("/pipeline");
        return { success: true, count: idsParsed.data.length };
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
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        const paymentRef = adminDb.collection('opportunities').doc(parsed.data.dealId).collection('payments').doc();
        await paymentRef.set({
            amount: parsed.data.amount,
            date: parsed.data.date,
            method: parsed.data.method,
            notes: parsed.data.notes || "",
            recordedBy: session.user.name || session.user.email || "Unknown",
            createdAt: new Date(),
        });

        // Recalculate payment status based on total payments vs deal value
        const oppDoc = await adminDb.collection('opportunities').doc(parsed.data.dealId).get();
        const oppData = oppDoc.data();
        const dealValue = Number(oppData?.opportunityValue) || 0;

        const paymentsSnap = await adminDb.collection('opportunities').doc(parsed.data.dealId).collection('payments').get();
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

        await adminDb.collection('opportunities').doc(parsed.data.dealId).update({
            paymentStatus,
            revenueStatus,
            collectedAmount: totalPaid,
            collectedDate: paymentStatus === "paid" ? new Date().toISOString() : null,
            updatedAt: new Date(),
        });

        logAudit({
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
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized", payments: [] };

        const paymentsSnap = await adminDb
            .collection('opportunities')
            .doc(parsed.data.dealId)
            .collection('payments')
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
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        await adminDb.collection('opportunities').doc(parsed.data.dealId).update({
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
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

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

        await adminDb.collection('opportunities').doc(parsed.data.dealId).update(updateData);

        logAudit({
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
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

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

        const oppsSnap = await adminDb.collection('opportunities').get();
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
        const session = await auth();
        if (!session?.user) throw new Error("Unauthorized");

        // Only admins/owners can bulk assign deals
        const role = await getCurrentUserRole();
        if (role !== "ADMIN" && role !== "OWNER") {
            return { success: false, error: "Only admins and owners can assign deals to other users" };
        }

        const batch = adminDb.batch();
        for (const id of idsParsed.data) {
            const docRef = adminDb.collection('opportunities').doc(id);
            batch.update(docRef, {
                assigneeId: userParsed.data,
                updatedAt: new Date(),
            });
        }
        await batch.commit();

        logAudit({
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
        const session = await auth();
        if (!session?.user) return { success: false, error: "Unauthorized" };

        await adminDb.collection('opportunities').doc(parsed.data.dealId).update({
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
        const session = await auth();
        if (!session?.user) return { success: false, expenses: null };

        const doc = await adminDb.collection('opportunities').doc(parsed.data).get();
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
