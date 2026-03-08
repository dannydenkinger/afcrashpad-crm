"use server"

import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth-guard";

// --- Automation Settings ---

export async function getAutomationSettings() {
    try {
        const doc = await adminDb.collection('settings').doc('automations').get();
        if (!doc.exists) {
            return {
                success: true,
                settings: {
                    autoReplyEnabled: false,
                    autoReplyTemplateId: null,
                    autoAdvanceEnabled: false,
                }
            };
        }
        const data = doc.data()!;
        return {
            success: true,
            settings: {
                autoReplyEnabled: data.autoReplyEnabled ?? false,
                autoReplyTemplateId: data.autoReplyTemplateId ?? null,
                autoAdvanceEnabled: data.autoAdvanceEnabled ?? false,
                staleOpportunityEnabled: data.staleOpportunityEnabled ?? false,
                guestRemindersEnabled: data.guestRemindersEnabled ?? false,
                checkInReminderDays: data.checkInReminderDays ?? [1, 3, 7],
                checkOutReminderDays: data.checkOutReminderDays ?? [1, 3, 7, 30],
                guestCheckInTemplateId: data.guestCheckInTemplateId ?? null,
                guestCheckOutTemplateId: data.guestCheckOutTemplateId ?? null,
            }
        };
    } catch (error) {
        console.error("Failed to get automation settings:", error);
        return { success: false, error: "Failed to get settings" };
    }
}

export async function updateAutomationSettings(updates: {
    autoReplyEnabled?: boolean;
    autoReplyTemplateId?: string | null;
    autoAdvanceEnabled?: boolean;
    staleOpportunityEnabled?: boolean;
    guestRemindersEnabled?: boolean;
    checkInReminderDays?: number[];
    checkOutReminderDays?: number[];
    guestCheckInTemplateId?: string | null;
    guestCheckOutTemplateId?: string | null;
}) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const session = await auth();
        if (!session?.user?.email) return { success: false, error: "Unauthorized" };

        const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get();
        if (usersSnap.empty) return { success: false, error: "Unauthorized" };

        await adminDb.collection('settings').doc('automations').set(
            { ...updates, updatedAt: new Date() },
            { merge: true }
        );

        logAudit({
            userId: usersSnap.docs[0].id,
            userEmail: session.user.email,
            userName: usersSnap.docs[0].data()?.name || "",
            action: "settings_change",
            entity: "settings",
            entityId: "automations",
            entityName: "Automation Settings",
            metadata: updates,
        }).catch(() => {});

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to update automation settings:", error);
        return { success: false, error: "Failed to update settings" };
    }
}

// --- Email Templates ---

export async function getEmailTemplates() {
    try {
        const snap = await adminDb.collection('email_templates').orderBy('createdAt', 'desc').get();
        const templates = snap.docs.map(doc => {
            const data = doc.data();
            const ts = data.createdAt;
            const createdAt = ts?.toDate ? ts.toDate().toISOString() : (ts instanceof Date ? ts.toISOString() : ts || null);
            return {
                id: doc.id,
                name: data.name || "",
                subject: data.subject || "",
                body: data.body || "",
                createdAt,
            };
        });
        return { success: true, templates };
    } catch (error) {
        console.error("Failed to get email templates:", error);
        return { success: false, error: "Failed to get templates" };
    }
}

export async function createEmailTemplate(data: { name: string; subject: string; body: string }) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const ref = await adminDb.collection('email_templates').add({
            name: data.name,
            subject: data.subject,
            body: data.body,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        revalidatePath("/settings");
        return { success: true, id: ref.id };
    } catch (error) {
        console.error("Failed to create email template:", error);
        return { success: false, error: "Failed to create template" };
    }
}

export async function updateEmailTemplate(id: string, data: { name?: string; subject?: string; body?: string }) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection('email_templates').doc(id).update({
            ...data,
            updatedAt: new Date(),
        });

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to update email template:", error);
        return { success: false, error: "Failed to update template" };
    }
}

// --- Staleness Thresholds ---

export async function getStalenessSettings() {
    try {
        const pipelinesSnap = await adminDb.collection("pipelines").orderBy("createdAt", "asc").get()
        const pipelines: { id: string; name: string; stages: { id: string; name: string; stalenessThresholdDays: number | null; probability: number }[] }[] = []

        for (const pDoc of pipelinesSnap.docs) {
            const stagesSnap = await pDoc.ref.collection("stages").orderBy("order", "asc").get()
            const stages = stagesSnap.docs.map(s => ({
                id: s.id,
                name: s.data().name || "",
                stalenessThresholdDays: s.data().stalenessThresholdDays ?? null,
                probability: s.data().probability ?? 0,
            }))
            pipelines.push({ id: pDoc.id, name: pDoc.data().name || "", stages })
        }

        return { success: true, pipelines }
    } catch (error) {
        console.error("Failed to get staleness settings:", error)
        return { success: false, error: "Failed to get settings" }
    }
}

export async function updateStageSettings(pipelineId: string, stageId: string, updates: { stalenessThresholdDays?: number | null; probability?: number }) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection("pipelines").doc(pipelineId).collection("stages").doc(stageId).update(updates)
        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to update stage settings:", error)
        return { success: false, error: "Failed to update" }
    }
}

export async function deleteEmailTemplate(id: string) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection('email_templates').doc(id).delete();

        // If this was the active auto-reply template, clear it
        const settingsDoc = await adminDb.collection('settings').doc('automations').get();
        if (settingsDoc.exists && settingsDoc.data()?.autoReplyTemplateId === id) {
            await adminDb.collection('settings').doc('automations').update({
                autoReplyTemplateId: null,
                autoReplyEnabled: false,
                updatedAt: new Date(),
            });
        }

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete email template:", error);
        return { success: false, error: "Failed to delete template" };
    }
}
