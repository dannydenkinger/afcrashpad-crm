import { adminDb } from "@/lib/firebase-admin";
import { sendTrackedEmail } from "@/lib/email";

type SequenceTrigger = "new_contact" | "pre_checkin" | "post_checkout";

interface SequenceStep {
    delayDays: number;
    templateId: string;
    templateName: string;
}

function substituteTemplate(text: string, vars: Record<string, string>): string {
    return text
        .replace(/\{\{name\}\}/g, vars.name || "Guest")
        .replace(/\{\{base\}\}/g, vars.base || "your location")
        .replace(/\{\{startDate\}\}/g, vars.startDate || "")
        .replace(/\{\{endDate\}\}/g, vars.endDate || "");
}

/**
 * Trigger an email sequence for a contact. Creates scheduled log entries
 * that will be processed by the cron job.
 */
export async function triggerSequence(
    trigger: SequenceTrigger,
    contactId: string,
    email: string,
    name: string,
    extraVars?: Record<string, string>
) {
    try {
        // Find enabled sequences for this trigger
        const seqSnap = await adminDb
            .collection("email_sequences")
            .where("trigger", "==", trigger)
            .where("enabled", "==", true)
            .get();

        if (seqSnap.empty) return;

        const now = new Date();

        for (const seqDoc of seqSnap.docs) {
            const seq = seqDoc.data();
            const steps: SequenceStep[] = seq.steps || [];

            // Deduplicate: check if this sequence was already triggered for this contact
            const dedupeCheck = await adminDb
                .collection("email_sequence_log")
                .where("sequenceId", "==", seqDoc.id)
                .where("contactId", "==", contactId)
                .where("stepIndex", "==", 0)
                .limit(1)
                .get();

            if (!dedupeCheck.empty) continue;

            // Create log entries for each step
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                const scheduledFor = new Date(now.getTime() + step.delayDays * 86400000);

                await adminDb.collection("email_sequence_log").add({
                    sequenceId: seqDoc.id,
                    sequenceName: seq.name || "",
                    contactId,
                    contactEmail: email,
                    contactName: name,
                    stepIndex: i,
                    templateId: step.templateId,
                    status: "scheduled",
                    scheduledFor,
                    sentAt: null,
                    error: null,
                    extraVars: extraVars || null,
                    createdAt: now,
                });
            }
        }
    } catch (err) {
        console.error("Failed to trigger sequence:", err);
    }
}

/**
 * Process all scheduled emails that are due. Called by cron job.
 */
export async function processScheduledEmails(): Promise<{ sent: number; failed: number }> {
    const results = { sent: 0, failed: 0 };

    try {
        const now = new Date();
        const dueSnap = await adminDb
            .collection("email_sequence_log")
            .where("status", "==", "scheduled")
            .where("scheduledFor", "<=", now)
            .limit(50)
            .get();

        for (const logDoc of dueSnap.docs) {
            const log = logDoc.data();

            try {
                // Load the template
                const templateDoc = await adminDb
                    .collection("email_templates")
                    .doc(log.templateId)
                    .get();

                if (!templateDoc.exists) {
                    await logDoc.ref.update({ status: "failed", error: "Template not found" });
                    results.failed++;
                    continue;
                }

                const template = templateDoc.data()!;
                const vars: Record<string, string> = {
                    name: log.contactName || "Guest",
                    base: "",
                    startDate: "",
                    endDate: "",
                    ...(log.extraVars || {}),
                };

                const subject = substituteTemplate(template.subject || "", vars);
                const html = substituteTemplate(template.body || "", vars).replace(/\n/g, "<br>");

                const { trackingId } = await sendTrackedEmail({
                    to: log.contactEmail,
                    subject,
                    html,
                    contactId: log.contactId,
                });

                await logDoc.ref.update({
                    status: "sent",
                    sentAt: new Date(),
                    trackingId: trackingId || null,
                });
                results.sent++;
            } catch (err: any) {
                await logDoc.ref.update({
                    status: "failed",
                    error: err?.message || "Send failed",
                });
                results.failed++;
            }
        }
    } catch (err) {
        console.error("Process scheduled emails error:", err);
    }

    return results;
}
