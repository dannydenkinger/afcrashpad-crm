"use server"

import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { createNotification } from "@/app/notifications/actions";
import type { CalendarEvent } from "@/lib/calendar-sync";
import { getGoogleCalendarClient } from "@/lib/google-calendar";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const firestoreIdSchema = z.string().min(1).max(128);

const getUnifiedEventsSchema = z.object({
    days: z.number().int().min(1).max(365).optional(),
});

const recurrenceSchema = z.object({
    type: z.enum(["none", "daily", "weekly", "monthly"]),
    interval: z.number().int().min(1).max(365).optional(),
    endDate: z.coerce.date().optional().nullable(),
}).optional().nullable();

const createTaskSchema = z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    dueDate: z.coerce.date().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    contactId: z.string().optional(),
    opportunityId: z.string().optional(),
    assigneeId: z.string().optional(),
    recurrence: recurrenceSchema,
    blockedByTaskId: z.string().optional().nullable(),
});

const toggleTaskCompleteSchema = z.object({
    taskId: firestoreIdSchema,
    completed: z.boolean(),
});

const updateTaskSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).optional(),
    dueDate: z.coerce.date().optional().nullable(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    completed: z.boolean().optional(),
    contactId: z.string().optional().nullable(),
    opportunityId: z.string().optional().nullable(),
    recurrence: recurrenceSchema,
    blockedByTaskId: z.string().optional().nullable(),
});

// ── Task Template Schemas ───────────────────────────────────────────────────

const taskTemplateItemSchema = z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    relativeDueDays: z.number().int().min(0).max(365).optional(),
});

const createTaskTemplateSchema = z.object({
    name: z.string().min(1).max(200),
    tasks: z.array(taskTemplateItemSchema).min(1).max(50),
});

const updateTaskTemplateSchema = z.object({
    templateId: firestoreIdSchema,
    name: z.string().min(1).max(200),
    tasks: z.array(taskTemplateItemSchema).min(1).max(50),
});

// ── Task Comment Schema ─────────────────────────────────────────────────────

const addTaskCommentSchema = z.object({
    taskId: firestoreIdSchema,
    text: z.string().min(1).max(5000),
});

// ── Recurring Event Exception Schema ────────────────────────────────────────

const recurrenceExceptionSchema = z.object({
    date: z.coerce.date(),
    action: z.enum(["skip", "modify"]),
    modifications: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        dueDate: z.coerce.date().optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    }).optional(),
});

const deleteTaskSchema = z.object({ taskId: firestoreIdSchema });

export async function getUnifiedEvents(days: number = 30): Promise<CalendarEvent[]> {
    const parsed = getUnifiedEventsSchema.safeParse({ days });
    if (!parsed.success) return [];
    days = parsed.data.days ?? 30;
    const events: CalendarEvent[] = [];

    const session = await auth();
    if (!session?.user?.id) return [];

    // 1. Fetch External Calendars (Google OAuth)
    try {
        const calendar = await getGoogleCalendarClient(session.user.id);
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - days);

        let calendars: any[] = [];
        try {
            const calendarListResponse = await calendar.calendarList.list();
            calendars = calendarListResponse.data.items || [];
        } catch (e: any) {
            // User has not granted calendar.readonly scope - fall back to primary only
            calendars = [{ id: "primary", summary: "Primary", backgroundColor: "#4285F4" }];
        }

        const eventPromises = calendars.map(async (cal) => {
            try {
                const response = await calendar.events.list({
                    calendarId: cal.id || "primary",
                    timeMin: timeMin.toISOString(),
                    maxResults: 100,
                    singleEvents: true,
                    orderBy: "startTime",
                });

                return (response.data.items || []).map(event => ({
                    id: event.id || Math.random().toString(),
                    title: event.summary || "Untitled Event",
                    start: new Date((event as any).start?.dateTime || (event as any).start?.date || ""),
                    end: new Date((event as any).end?.dateTime || (event as any).end?.date || ""),
                    description: event.description || "",
                    source: "GOOGLE" as const,
                    color: cal.backgroundColor || "#4285F4",
                    calendarId: cal.id,
                    calendarName: cal.summary || "Google Calendar",
                }));
            } catch (err: any) {
                // Failed to fetch events for this calendar - skip it
                return [];
            }
        });

        const nestedEvents = await Promise.all(eventPromises);
        const googleEvents = nestedEvents.flat();

        events.push(...googleEvents);
    } catch (error) {
        // Google Calendar integration not active or fetch error - silently continue
    }

    // 2. Fetch CRM Stay Dates from Contacts (using Firebase)
    try {
        const contactsSnapshot = await adminDb.collection('contacts').get();
        const oppsSnapshot = await adminDb.collection('opportunities').get();
        
        // Map opportunities to contacts
        const oppsByContact: Record<string, string> = {};
        oppsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.contactId && !oppsByContact[data.contactId]) {
                oppsByContact[data.contactId] = doc.id;
            }
        });

        contactsSnapshot.forEach(doc => {
            const row = doc.data();
            // Need at least one date set
            if (!row.stayStartDate && !row.stayEndDate) return;

            const oppId = oppsByContact[doc.id];
            const navUrl = oppId ? `/pipeline?deal=${oppId}` : `/contacts/${doc.id}`;

            const start = row.stayStartDate?.toDate ? row.stayStartDate.toDate() : (row.stayStartDate ? new Date(row.stayStartDate) : null);
            const end = row.stayEndDate?.toDate ? row.stayEndDate.toDate() : (row.stayEndDate ? new Date(row.stayEndDate) : null);

            if (start) {
                events.push({
                    id: `checkin-${doc.id}`,
                    title: `Check-in: ${row.name || 'Unknown'}`,
                    start: start,
                    end: start,
                    source: "SYSTEM",
                    color: "#10B981",
                    navigationUrl: navUrl,
                });
            }
            
            if (end) {
                events.push({
                    id: `checkout-${doc.id}`,
                    title: `Check-out: ${row.name || 'Unknown'}`,
                    start: end,
                    end: end,
                    source: "SYSTEM",
                    color: "#EF4444",
                    navigationUrl: navUrl,
                });
            }
        });
    } catch (error) {
        console.error("Error fetching CRM stay dates from Firebase:", error);
    }

    // 3. Fetch Internal Tasks (using Firebase)
    try {
        const tasksSnapshot = await adminDb.collection('tasks')
            .where('completed', '==', false)
            .get();

        tasksSnapshot.forEach(doc => {
            const task = doc.data();
            if (task.dueDate) {
                const date = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
                events.push({
                    id: `task-${doc.id}`,
                    title: `Task: ${task.title}`,
                    start: date,
                    end: date,
                    source: "TASK",
                    color: "#F59E0B"
                });
            }
        });
    } catch (error) {
        console.error("Error fetching internal tasks from Firebase:", error);
    }

    return events;
}

export async function createTask(data: {
    title: string;
    description?: string;
    dueDate?: Date;
    priority?: string;
    contactId?: string;
    opportunityId?: string;
    assigneeId?: string;
    recurrence?: { type: string; interval?: number; endDate?: Date | null } | null;
    blockedByTaskId?: string | null;
}) {
    const parsed = createTaskSchema.safeParse(data);
    if (!parsed.success) return { id: null, error: "Invalid input" };
    data = parsed.data;

    const recurrence = data.recurrence && data.recurrence.type !== "none"
        ? {
            type: data.recurrence.type,
            interval: data.recurrence.interval || 1,
            endDate: data.recurrence.endDate || null,
        }
        : null;

    const taskRef = await adminDb.collection('tasks').add({
        title: data.title,
        description: data.description || null,
        dueDate: data.dueDate ? data.dueDate : null,
        priority: data.priority || 'MEDIUM',
        contactId: data.contactId || null,
        opportunityId: data.opportunityId || null,
        assigneeId: data.assigneeId || null,
        blockedByTaskId: data.blockedByTaskId || null,
        completed: false,
        recurrence,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    return { id: taskRef.id };
}

export async function toggleTaskComplete(taskId: string, completed: boolean) {
    const parsed = toggleTaskCompleteSchema.safeParse({ taskId, completed });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    taskId = parsed.data.taskId;
    completed = parsed.data.completed;

    await adminDb.collection('tasks').doc(taskId).update({
        completed,
        updatedAt: new Date()
    });
    return { success: true };
}

export async function getTasks() {
    const tasksSnapshot = await adminDb.collection('tasks').orderBy('dueDate', 'asc').get();
    const tasks = [];
    
    // Simple caching for related entities
    const contactsMap: Record<string, any> = {};
    const usersMap: Record<string, any> = {};

    for (const doc of tasksSnapshot.docs) {
        const taskData = doc.data();
        let contactData = null;
        let assigneeData = null;

        if (taskData.contactId) {
            if (!contactsMap[taskData.contactId]) {
                const cDoc = await adminDb.collection('contacts').doc(taskData.contactId).get();
                if (cDoc.exists) contactsMap[taskData.contactId] = { id: cDoc.id, ...cDoc.data() };
            }
            contactData = contactsMap[taskData.contactId];
        }

        if (taskData.assigneeId) {
            if (!usersMap[taskData.assigneeId]) {
                const uDoc = await adminDb.collection('users').doc(taskData.assigneeId).get();
                if (uDoc.exists) usersMap[taskData.assigneeId] = { id: uDoc.id, ...uDoc.data() };
            }
            assigneeData = usersMap[taskData.assigneeId];
        }

        const dueDate = taskData.dueDate?.toDate ? taskData.dueDate.toDate() : (taskData.dueDate ? new Date(taskData.dueDate) : null);
        const recurrence = taskData.recurrence ? {
            type: taskData.recurrence.type,
            interval: taskData.recurrence.interval || 1,
            endDate: taskData.recurrence.endDate?.toDate
                ? taskData.recurrence.endDate.toDate().toISOString()
                : (taskData.recurrence.endDate ? new Date(taskData.recurrence.endDate).toISOString() : null),
        } : null;
        tasks.push({
            id: doc.id,
            ...taskData,
            title: taskData.title ?? 'Task',
            completed: taskData.completed ?? false,
            dueDate: dueDate ? dueDate.toISOString() : null,
            createdAt: taskData.createdAt?.toDate ? taskData.createdAt.toDate().toISOString() : taskData.createdAt,
            updatedAt: taskData.updatedAt?.toDate ? taskData.updatedAt.toDate().toISOString() : taskData.updatedAt,
            recurrence,
            blockedByTaskId: taskData.blockedByTaskId || null,
            blockedByTaskTitle: null as string | null,
            blockedByTaskCompleted: null as boolean | null,
            contact: contactData ? { id: contactData.id, name: contactData.name, email: contactData.email } : null,
            assignee: assigneeData ? { id: assigneeData.id, name: assigneeData.name } : null
        });
    }

    // Resolve blocking task names for dependency display
    for (const task of tasks) {
        if (task.blockedByTaskId) {
            const blockingTask = tasks.find(t => t.id === task.blockedByTaskId);
            if (blockingTask) {
                task.blockedByTaskTitle = blockingTask.title;
                task.blockedByTaskCompleted = blockingTask.completed;
            } else {
                // Blocking task might be in a different filter set, fetch directly
                try {
                    const blockDoc = await adminDb.collection('tasks').doc(task.blockedByTaskId).get();
                    if (blockDoc.exists) {
                        const bd = blockDoc.data()!;
                        task.blockedByTaskTitle = bd.title || 'Task';
                        task.blockedByTaskCompleted = bd.completed ?? false;
                    }
                } catch { /* ignore */ }
            }
        }
    }

    // Create reminder notifications for tasks due in next 24h (lazy, on fetch)
    try {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        for (const task of tasks) {
            if (task.completed || !task.dueDate) continue;
            const due = new Date(task.dueDate);
            if (due >= now && due <= in24h) {
                const existing = await adminDb.collection('notifications')
                    .where('taskId', '==', task.id)
                    .limit(1)
                    .get();
                if (existing.empty) {
                    await createNotification({
                        title: `Task due soon: ${task.title}`,
                        message: task.dueDate ? `Due ${new Date(task.dueDate).toLocaleString()}` : '',
                        type: 'checkin',
                        linkUrl: '/tasks',
                        taskId: task.id
                    });
                }
            }
        }
    } catch (e) {
        // Task reminder creation failed - non-critical, continue
    }

    return tasks;
}

export async function updateTask(taskId: string, data: {
    title?: string;
    description?: string;
    dueDate?: Date | null;
    priority?: string;
    completed?: boolean;
    contactId?: string | null;
    opportunityId?: string | null;
    recurrence?: { type: string; interval?: number; endDate?: Date | null } | null;
    blockedByTaskId?: string | null;
}) {
    const idParsed = firestoreIdSchema.safeParse(taskId);
    if (!idParsed.success) return { success: false, error: "Invalid input" };
    const dataParsed = updateTaskSchema.safeParse(data);
    if (!dataParsed.success) return { success: false, error: "Invalid input" };
    taskId = idParsed.data;
    data = dataParsed.data;

    const updateData: any = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.completed !== undefined) updateData.completed = data.completed;
    if (data.contactId !== undefined) updateData.contactId = data.contactId;
    if (data.opportunityId !== undefined) updateData.opportunityId = data.opportunityId;
    if (data.blockedByTaskId !== undefined) updateData.blockedByTaskId = data.blockedByTaskId;
    if (data.recurrence !== undefined) {
        updateData.recurrence = data.recurrence && data.recurrence.type !== "none"
            ? {
                type: data.recurrence.type,
                interval: data.recurrence.interval || 1,
                endDate: data.recurrence.endDate || null,
            }
            : null;
    }

    await adminDb.collection('tasks').doc(taskId).update(updateData);
    return { success: true };
}

function calculateNextDueDate(currentDueDate: Date, recurrence: { type: string; interval: number }): Date {
    const next = new Date(currentDueDate);
    const interval = recurrence.interval || 1;
    switch (recurrence.type) {
        case "daily":
            next.setDate(next.getDate() + interval);
            break;
        case "weekly":
            next.setDate(next.getDate() + 7 * interval);
            break;
        case "monthly":
            next.setMonth(next.getMonth() + interval);
            break;
    }
    return next;
}

export async function completeRecurringTask(taskId: string) {
    const parsed = firestoreIdSchema.safeParse(taskId);
    if (!parsed.success) return { success: false, error: "Invalid task ID", nextTaskId: null };
    taskId = parsed.data;

    const taskDoc = await adminDb.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) return { success: false, error: "Task not found", nextTaskId: null };

    const taskData = taskDoc.data()!;
    const recurrence = taskData.recurrence;
    if (!recurrence || recurrence.type === "none") {
        // Not a recurring task, just mark complete
        await adminDb.collection('tasks').doc(taskId).update({ completed: true, updatedAt: new Date() });
        return { success: true, nextTaskId: null };
    }

    // Mark current task as complete
    await adminDb.collection('tasks').doc(taskId).update({ completed: true, updatedAt: new Date() });

    // Calculate the next due date
    const currentDueDate = taskData.dueDate?.toDate
        ? taskData.dueDate.toDate()
        : (taskData.dueDate ? new Date(taskData.dueDate) : new Date());

    const nextDueDate = calculateNextDueDate(currentDueDate, recurrence);

    // Check if next occurrence is past the end date
    if (recurrence.endDate) {
        const endDate = recurrence.endDate?.toDate
            ? recurrence.endDate.toDate()
            : new Date(recurrence.endDate);
        if (nextDueDate > endDate) {
            return { success: true, nextTaskId: null };
        }
    }

    // Create the next occurrence
    const nextTaskRef = await adminDb.collection('tasks').add({
        title: taskData.title,
        description: taskData.description || null,
        dueDate: nextDueDate,
        priority: taskData.priority || 'MEDIUM',
        contactId: taskData.contactId || null,
        opportunityId: taskData.opportunityId || null,
        assigneeId: taskData.assigneeId || null,
        completed: false,
        recurrence,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    return { success: true, nextTaskId: nextTaskRef.id };
}

export async function deleteTask(taskId: string) {
    const parsed = deleteTaskSchema.safeParse({ taskId });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    taskId = parsed.data.taskId;

    await adminDb.collection('tasks').doc(taskId).delete();
    return { success: true };
}

// ── Task Templates ──────────────────────────────────────────────────────────

export async function getTaskTemplates() {
    const snapshot = await adminDb.collection('task_templates').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        tasks: doc.data().tasks || [],
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : doc.data().createdAt,
    }));
}

export async function createTaskTemplate(data: {
    name: string;
    tasks: { title: string; description?: string; priority?: string; relativeDueDays?: number }[];
}) {
    const parsed = createTaskTemplateSchema.safeParse(data);
    if (!parsed.success) return { id: null, error: "Invalid input" };

    const ref = await adminDb.collection('task_templates').add({
        name: parsed.data.name,
        tasks: parsed.data.tasks,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    return { id: ref.id };
}

export async function updateTaskTemplate(templateId: string, data: {
    name: string;
    tasks: { title: string; description?: string; priority?: string; relativeDueDays?: number }[];
}) {
    const parsed = updateTaskTemplateSchema.safeParse({ templateId, ...data });
    if (!parsed.success) return { success: false, error: "Invalid input" };

    await adminDb.collection('task_templates').doc(parsed.data.templateId).update({
        name: parsed.data.name,
        tasks: parsed.data.tasks,
        updatedAt: new Date(),
    });
    return { success: true };
}

export async function deleteTaskTemplate(templateId: string) {
    const parsed = firestoreIdSchema.safeParse(templateId);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    await adminDb.collection('task_templates').doc(parsed.data).delete();
    return { success: true };
}

export async function applyTaskTemplate(templateId: string) {
    const parsed = firestoreIdSchema.safeParse(templateId);
    if (!parsed.success) return { success: false, error: "Invalid template ID" };

    const templateDoc = await adminDb.collection('task_templates').doc(parsed.data).get();
    if (!templateDoc.exists) return { success: false, error: "Template not found" };

    const template = templateDoc.data()!;
    const today = new Date();
    const createdIds: string[] = [];

    for (const taskDef of template.tasks) {
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + (taskDef.relativeDueDays || 0));

        const ref = await adminDb.collection('tasks').add({
            title: taskDef.title,
            description: taskDef.description || null,
            dueDate,
            priority: taskDef.priority || 'MEDIUM',
            contactId: null,
            opportunityId: null,
            assigneeId: null,
            blockedByTaskId: null,
            completed: false,
            recurrence: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        createdIds.push(ref.id);
    }

    return { success: true, createdCount: createdIds.length };
}

// ── Task Comments ───────────────────────────────────────────────────────────

export async function getTaskComments(taskId: string) {
    const parsed = firestoreIdSchema.safeParse(taskId);
    if (!parsed.success) return [];

    const snapshot = await adminDb.collection('tasks').doc(parsed.data)
        .collection('comments').orderBy('createdAt', 'asc').get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId || null,
        userName: doc.data().userName || 'Unknown',
        text: doc.data().text,
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : doc.data().createdAt,
    }));
}

export async function addTaskComment(taskId: string, text: string) {
    const parsed = addTaskCommentSchema.safeParse({ taskId, text });
    if (!parsed.success) return { id: null, error: "Invalid input" };

    const session = await auth();
    const userName = session?.user?.name || 'Unknown';
    const userId = session?.user?.id || null;

    const ref = await adminDb.collection('tasks').doc(parsed.data.taskId)
        .collection('comments').add({
            userId,
            userName,
            text: parsed.data.text,
            createdAt: new Date(),
        });

    return { id: ref.id };
}

// ── Recurring Event Exceptions ──────────────────────────────────────────────

export async function addRecurrenceException(taskId: string, exception: {
    date: Date;
    action: "skip" | "modify";
    modifications?: {
        title?: string;
        description?: string;
        dueDate?: Date;
        priority?: string;
    };
}) {
    const idParsed = firestoreIdSchema.safeParse(taskId);
    if (!idParsed.success) return { success: false, error: "Invalid task ID" };
    const exParsed = recurrenceExceptionSchema.safeParse(exception);
    if (!exParsed.success) return { success: false, error: "Invalid exception data" };

    const taskDoc = await adminDb.collection('tasks').doc(idParsed.data).get();
    if (!taskDoc.exists) return { success: false, error: "Task not found" };

    const taskData = taskDoc.data()!;
    const exceptions = taskData.exceptions || [];

    // Remove any existing exception for the same date
    const exDate = exParsed.data.date;
    const filtered = exceptions.filter((e: any) => {
        const eDate = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return eDate.toDateString() !== exDate.toDateString();
    });

    filtered.push({
        date: exParsed.data.date,
        action: exParsed.data.action,
        modifications: exParsed.data.modifications || null,
    });

    await adminDb.collection('tasks').doc(idParsed.data).update({
        exceptions: filtered,
        updatedAt: new Date(),
    });

    return { success: true };
}

export async function updateFutureOccurrences(taskId: string, fromDate: Date, modifications: {
    title?: string;
    description?: string;
    priority?: string;
}) {
    const idParsed = firestoreIdSchema.safeParse(taskId);
    if (!idParsed.success) return { success: false, error: "Invalid task ID" };

    const updateData: any = { updatedAt: new Date() };
    if (modifications.title !== undefined) updateData.title = modifications.title;
    if (modifications.description !== undefined) updateData.description = modifications.description;
    if (modifications.priority !== undefined) updateData.priority = modifications.priority;

    await adminDb.collection('tasks').doc(idParsed.data).update(updateData);
    return { success: true };
}
