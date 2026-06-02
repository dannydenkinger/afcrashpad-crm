import { tenantDb } from "@/lib/tenant-db";
import { createNotification } from "@/app/notifications/actions";
import { sendEmail } from "@/lib/email";
import { triggerSequence } from "@/lib/email-sequences";

function toDate(val: unknown): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof (val as any)?.toDate === "function") return (val as any).toDate();
    if (typeof val === "string") {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

function diffDays(from: Date, to: Date): number {
    const msPerDay = 86400000;
    const fromNoon = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
    const toNoon = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 12);
    return Math.round((toNoon.getTime() - fromNoon.getTime()) / msPerDay);
}

const DEFAULT_CHECK_IN_DAYS = [1, 3, 7];
const DEFAULT_CHECK_OUT_DAYS = [1, 3, 7, 30];

function substituteTemplate(text: string, vars: Record<string, string>): string {
    return text
        .replace(/\{\{name\}\}/g, vars.name || "Guest")
        .replace(/\{\{startDate\}\}/g, vars.startDate || "")
        .replace(/\{\{endDate\}\}/g, vars.endDate || "")
        .replace(/\{\{days\}\}/g, vars.days || "");
}

export async function checkStayReminders(workspaceId: string) {
    const results = { checkinReminders: 0, checkoutReminders: 0, guestEmails: 0 };
    const db = tenantDb(workspaceId)

    try {
        // Load automation settings for configurable days + guest templates
        const settingsDoc = await db.settingsDoc("automations").get();
        const automationData = settingsDoc.exists ? settingsDoc.data() : null;
        const checkInDays: number[] = automationData?.checkInReminderDays ?? DEFAULT_CHECK_IN_DAYS;
        const checkOutDays: number[] = automationData?.checkOutReminderDays ?? DEFAULT_CHECK_OUT_DAYS;
        const guestRemindersEnabled = automationData?.guestRemindersEnabled ?? false;

        // Load guest email templates if enabled
        let checkInTemplate: { subject: string; body: string } | null = null;
        let checkOutTemplate: { subject: string; body: string } | null = null;
        if (guestRemindersEnabled) {
            if (automationData?.guestCheckInTemplateId) {
                const tDoc = await db.doc("email_templates", automationData.guestCheckInTemplateId).get();
                if (tDoc.exists) checkInTemplate = { subject: tDoc.data()!.subject, body: tDoc.data()!.body };
            }
            if (automationData?.guestCheckOutTemplateId) {
                const tDoc = await db.doc("email_templates", automationData.guestCheckOutTemplateId).get();
                if (tDoc.exists) checkOutTemplate = { subject: tDoc.data()!.subject, body: tDoc.data()!.body };
            }
        }

        const oppsSnap = await db.collection("opportunities").get();
        const today = new Date();

        for (const doc of oppsSnap.docs) {
            const data = doc.data();
            const oppId = doc.id;

            let contactName = data.name || "Unknown";
            let contactEmail: string | null = null;
            if (data.contactId) {
                try {
                    const contactDoc = await db.doc("contacts", data.contactId).get();
                    if (contactDoc.exists) {
                        contactName = contactDoc.data()?.name || contactName;
                        contactEmail = contactDoc.data()?.email || null;
                    }
                } catch { /* use fallback */ }
            }

            const templateVars = {
                name: contactName,
                startDate: "",
                endDate: "",
                days: "",
            };

            // Check-in reminders
            const startDate = toDate(data.stayStartDate);
            if (startDate) {
                templateVars.startDate = startDate.toISOString().slice(0, 10);
                const daysUntil = diffDays(today, startDate);

                // Trigger pre_checkin sequence at 7 days before
                if (daysUntil === 7 && contactEmail) {
                    triggerSequence(workspaceId, "pre_checkin", data.contactId || oppId, contactEmail, contactName, {
                        startDate: templateVars.startDate,
                        endDate: templateVars.endDate,
                    }).catch(() => {});
                }
                for (const d of checkInDays) {
                    if (daysUntil === d) {
                        const dedupeKey = `checkin_${oppId}_${d}d_${startDate.toISOString().slice(0, 10)}`;
                        await createNotification({
                            title: `Check-in in ${d} day${d > 1 ? "s" : ""}`,
                            message: `${contactName}`,
                            type: "checkin",
                            linkUrl: `/pipeline?deal=${oppId}`,
                            dedupeKey,
                        });
                        results.checkinReminders++;

                        // Send guest email if enabled
                        if (guestRemindersEnabled && checkInTemplate && contactEmail) {
                            const guestDedupeKey = `guest_checkin_${oppId}_${d}d`;
                            const existing = await db.collection("notifications")
                                .where("dedupeKey", "==", guestDedupeKey).limit(1).get();
                            if (existing.empty) {
                                templateVars.days = String(d);
                                try {
                                    await sendEmail({
                                        to: contactEmail,
                                        subject: substituteTemplate(checkInTemplate.subject, templateVars),
                                        html: substituteTemplate(checkInTemplate.body, templateVars).replace(/\n/g, "<br>"),
                                    });
                                    // Log to prevent duplicate sends
                                    await db.add("notifications", {
                                        dedupeKey: guestDedupeKey,
                                        title: "Guest check-in reminder sent",
                                        message: contactEmail,
                                        type: "checkin",
                                        isRead: true,
                                        createdAt: new Date(),
                                    });
                                    results.guestEmails++;
                                } catch (err) {
                                    console.error("Guest check-in email failed:", err);
                                }
                            }
                        }
                    }
                }
            }

            // Check-out reminders
            const endDate = toDate(data.stayEndDate);
            if (endDate) {
                templateVars.endDate = endDate.toISOString().slice(0, 10);
                const daysUntil = diffDays(today, endDate);

                // Trigger post_checkout sequence 1 day after checkout
                if (daysUntil === -1 && contactEmail) {
                    triggerSequence(workspaceId, "post_checkout", data.contactId || oppId, contactEmail, contactName, {
                        startDate: templateVars.startDate,
                        endDate: templateVars.endDate,
                    }).catch(() => {});
                }
                for (const d of checkOutDays) {
                    if (daysUntil === d) {
                        const dedupeKey = `checkout_${oppId}_${d}d_${endDate.toISOString().slice(0, 10)}`;
                        await createNotification({
                            title: `Check-out in ${d} day${d > 1 ? "s" : ""}`,
                            message: `${contactName}`,
                            type: "checkout",
                            linkUrl: `/pipeline?deal=${oppId}`,
                            dedupeKey,
                        });
                        results.checkoutReminders++;

                        // Send guest email if enabled
                        if (guestRemindersEnabled && checkOutTemplate && contactEmail) {
                            const guestDedupeKey = `guest_checkout_${oppId}_${d}d`;
                            const existing = await db.collection("notifications")
                                .where("dedupeKey", "==", guestDedupeKey).limit(1).get();
                            if (existing.empty) {
                                templateVars.days = String(d);
                                try {
                                    await sendEmail({
                                        to: contactEmail,
                                        subject: substituteTemplate(checkOutTemplate.subject, templateVars),
                                        html: substituteTemplate(checkOutTemplate.body, templateVars).replace(/\n/g, "<br>"),
                                    });
                                    await db.add("notifications", {
                                        dedupeKey: guestDedupeKey,
                                        title: "Guest check-out reminder sent",
                                        message: contactEmail,
                                        type: "checkout",
                                        isRead: true,
                                        createdAt: new Date(),
                                    });
                                    results.guestEmails++;
                                } catch (err) {
                                    console.error("Guest check-out email failed:", err);
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error("Check stay reminders error:", err);
    }

    return results;
}
