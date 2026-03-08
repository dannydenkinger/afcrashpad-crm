"use server"

import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmailToEligibleUsers, sendPushToEligibleUsers } from "@/lib/notification-dispatch";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const firestoreIdSchema = z.string().min(1).max(128);

const getNotificationsSchema = z.object({
    limit: z.number().int().min(1).max(200).optional(),
});

const markAsReadSchema = z.object({ id: firestoreIdSchema });

const createNotificationSchema = z.object({
    title: z.string().min(1).max(500),
    message: z.string().max(2000),
    type: z.string().min(1).max(50),
    linkUrl: z.string().max(500).optional(),
    taskId: z.string().optional(),
    dedupeKey: z.string().max(200).optional(),
    skipEmail: z.boolean().optional(),
});

function toISO(val: unknown): string | null {
    if (!val) return null;
    if (typeof val === "string") return val;
    if (val instanceof Date) return val.toISOString();
    if (typeof (val as any)?.toDate === "function") return (val as any).toDate().toISOString();
    return null;
}

export async function getNotifications(limit: number = 20) {
    const parsed = getNotificationsSchema.safeParse({ limit });
    if (!parsed.success) return { success: false, notifications: [], unreadCount: 0 };
    limit = parsed.data.limit ?? 20;

    try {
        // Single orderBy avoids requiring a Firestore composite index
        const snapshot = await adminDb.collection('notifications')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const notifications = snapshot.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                title: d.title ?? "",
                message: d.message ?? "",
                type: d.type ?? "",
                linkUrl: d.linkUrl ?? null,
                taskId: d.taskId ?? null,
                isRead: d.isRead === true,
                createdAt: toISO(d.createdAt),
            };
        });

        // Unread first for display
        notifications.sort((a, b) => (a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1));

        const unreadSnapshot = await adminDb.collection('notifications')
            .where('isRead', '==', false)
            .count()
            .get();

        return {
            success: true,
            notifications,
            unreadCount: unreadSnapshot.data().count || 0
        };
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
        return { success: false, notifications: [], unreadCount: 0 };
    }
}

export async function markAsRead(id: string) {
    const parsed = markAsReadSchema.safeParse({ id });
    if (!parsed.success) return { success: false };
    id = parsed.data.id;

    try {
        await adminDb.collection('notifications').doc(id).update({
            isRead: true
        });
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

export async function markAllAsRead() {
    try {
        const unreadSnapshot = await adminDb.collection('notifications')
            .where('isRead', '==', false)
            .get();

        const batch = adminDb.batch();
        unreadSnapshot.forEach(doc => {
            batch.update(doc.ref, { isRead: true });
        });

        await batch.commit();
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

export async function createNotification(data: {
    title: string;
    message: string;
    type: string;
    linkUrl?: string;
    taskId?: string;
    dedupeKey?: string;
    skipEmail?: boolean;
}) {
    const parsed = createNotificationSchema.safeParse(data);
    if (!parsed.success) return { success: false };
    data = parsed.data;

    try {
        // Dedupe check — if a dedupeKey is provided and a notification with the same key
        // already exists, skip creation to prevent duplicate reminders
        if (data.dedupeKey) {
            const existing = await adminDb.collection('notifications')
                .where('dedupeKey', '==', data.dedupeKey)
                .limit(1)
                .get();
            if (!existing.empty) {
                return { success: true, skipped: true };
            }
        }

        await adminDb.collection('notifications').add({
            title: data.title,
            message: data.message,
            type: data.type,
            linkUrl: data.linkUrl || null,
            taskId: data.taskId || null,
            dedupeKey: data.dedupeKey || null,
            isRead: false,
            createdAt: new Date()
        });

        const dispatchPayload = {
            title: data.title,
            message: data.message,
            type: data.type,
            linkUrl: data.linkUrl,
        };

        // Fire-and-forget email dispatch (non-blocking)
        if (!data.skipEmail) {
            sendEmailToEligibleUsers(dispatchPayload)
                .catch(err => console.error("Email dispatch failed:", err));
        }

        // Fire-and-forget push dispatch (non-blocking)
        sendPushToEligibleUsers(dispatchPayload)
            .catch(err => console.error("Push dispatch failed:", err));

        return { success: true };
    } catch (error) {
        console.error("Failed to create notification:", error);
        return { success: false };
    }
}
