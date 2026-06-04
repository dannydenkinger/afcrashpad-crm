import { NextResponse } from "next/server";
import { autoAdvanceOpportunities } from "@/app/pipeline/actions";
import { checkStayReminders } from "@/lib/reminders";
import { checkStaleOpportunities } from "@/lib/stale-opportunities";
import { processScheduledEmails } from "@/lib/email-sequences";
import { processScheduledMessages } from "@/app/communications/actions";
import { processFollowUpReminders } from "@/lib/follow-up-reminders";
import { processScheduledReports } from "@/lib/scheduled-reports";
import { adminDb } from "@/lib/firebase-admin";
import { logCronRun } from "@/lib/cron-log";

export const dynamic = "force-dynamic";

const CRON_NAME = "advance-opportunities";

async function getActiveWorkspaceIds(): Promise<string[]> {
    const snap = await adminDb.collection("workspaces").where("status", "==", "active").get();
    return snap.docs.map(d => d.id);
}

// Daily cron: auto-advance opportunities, send reminders, check stale deals,
// scheduled emails & messages, follow-up reminders, scheduled reports.
export async function GET(request: Request) {
    const started = Date.now();
    if (process.env.NODE_ENV !== "development") {
        const authHeader = request.headers.get("authorization") ?? "";
        const expected = process.env.CRON_SECRET;
        if (!expected) {
            await logCronRun({ name: CRON_NAME, status: "error", durationMs: Date.now() - started, error: "CRON_SECRET not configured" });
            return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
        }
        if (authHeader !== `Bearer ${expected}`) {
            await logCronRun({ name: CRON_NAME, status: "unauthorized", durationMs: Date.now() - started });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        const workspaceIds = await getActiveWorkspaceIds();
        const allResults: Record<string, unknown> = {};

        for (const workspaceId of workspaceIds) {
            const [advanceResult, remindersResult, staleResult, emailsResult, scheduledMsgsResult, followUpResult, reportsResult] = await Promise.all([
                autoAdvanceOpportunities(workspaceId).catch(err => ({ error: String(err) })),
                checkStayReminders(workspaceId),
                checkStaleOpportunities(workspaceId),
                processScheduledEmails(workspaceId),
                processScheduledMessages(),
                processFollowUpReminders(workspaceId).catch(err => ({ error: String(err) })),
                processScheduledReports(workspaceId).catch(err => ({ error: String(err) })),
            ]);

            allResults[workspaceId] = {
                advance: advanceResult,
                reminders: remindersResult,
                stale: staleResult,
                scheduledEmails: emailsResult,
                scheduledMessages: scheduledMsgsResult,
                followUpReminders: followUpResult,
                scheduledReports: reportsResult,
            };
        }

        await logCronRun({
            name: CRON_NAME,
            status: "success",
            durationMs: Date.now() - started,
            detail: { workspaceCount: workspaceIds.length },
        });
        return NextResponse.json(allResults);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await logCronRun({ name: CRON_NAME, status: "error", durationMs: Date.now() - started, error: message });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
