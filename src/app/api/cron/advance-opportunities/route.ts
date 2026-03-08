import { NextResponse } from "next/server";
import { autoAdvanceOpportunities } from "@/app/pipeline/actions";
import { checkStayReminders } from "@/lib/reminders";
import { checkStaleOpportunities } from "@/lib/stale-opportunities";
import { processScheduledEmails } from "@/lib/email-sequences";
import { processScheduledMessages } from "@/app/communications/actions";
import { processFollowUpReminders } from "@/lib/follow-up-reminders";
import { processScheduledReports } from "@/lib/scheduled-reports";

export const dynamic = "force-dynamic";

// Daily cron: auto-advance opportunities, send reminders, check stale deals, send scheduled emails & messages, follow-up reminders, scheduled reports
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [advanceResult, remindersResult, staleResult, emailsResult, scheduledMsgsResult, followUpResult, reportsResult] = await Promise.all([
        autoAdvanceOpportunities(),
        checkStayReminders(),
        checkStaleOpportunities(),
        processScheduledEmails(),
        processScheduledMessages(),
        processFollowUpReminders().catch(err => ({ error: String(err) })),
        processScheduledReports().catch(err => ({ error: String(err) })),
    ]);

    return NextResponse.json({
        ...advanceResult,
        reminders: remindersResult,
        stale: staleResult,
        scheduledEmails: emailsResult,
        scheduledMessages: scheduledMsgsResult,
        followUpReminders: followUpResult,
        scheduledReports: reportsResult,
    });
}
