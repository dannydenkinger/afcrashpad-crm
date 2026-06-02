import { adminDb } from "@/lib/firebase-admin"
import { NextResponse } from "next/server"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ feedId: string }> }
) {
    try {
        const { feedId } = await params

        if (!feedId) return new NextResponse("Missing Feed ID", { status: 400 })

        // Find user by their unique calendar feed ID
        const usersSnap = await adminDb.collection('users').where('calendarFeedId', '==', feedId).limit(1).get()

        if (usersSnap.empty) return new NextResponse("Invalid Feed URL", { status: 404 })

        const userDoc = usersSnap.docs[0];
        const user = { id: userDoc.id, ...userDoc.data() }

        // Start building iCalendar string manually
        const lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//AFCrashpad CRM//Calendar Sync//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            `X-WR-CALNAME:${(user as any).name || 'Agent'}'s CRM Schedule`,
            "X-WR-TIMEZONE:America/Chicago" // Adjust default if necessary
        ]

        const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

        // Fetch Opportunities assigned to this user
        const oppsSnap = await adminDb.collection('opportunities').where('assigneeId', '==', user.id).get()
        
        // Fetch Tasks assigned to this user
        const tasksSnap = await adminDb.collection('tasks').where('assigneeId', '==', user.id).get()

        // Map Opportunities to Events
        oppsSnap.forEach(doc => {
            const opp = doc.data();
            // Treat the created date or an arbitrary expected date as the event.
            // Opportunities ideally should have a concrete "dueDate" or "closeDate" in a full CRM.
            // For now, let's map it as an all-day event for the day it was created as a placeholder.
            const createdAtDate = opp.createdAt?.toDate ? opp.createdAt.toDate() : new Date();
            const dtStart = createdAtDate.toISOString().replace(/[-:]/g, '').split('T')[0]

            lines.push(
                "BEGIN:VEVENT",
                `UID:opp-${doc.id}@afcrashpad.com`,
                `DTSTAMP:${nowUtc}`,
                `DTSTART;VALUE=DATE:${dtStart}`,
                `SUMMARY:[Deal] ${opp.name}`,
                `DESCRIPTION:Value: $${opp.opportunityValue}\\nPriority: ${opp.priority}\\n`,
                "END:VEVENT"
            )
        });

        // Map Tasks to Events
        tasksSnap.forEach(doc => {
            const task = doc.data();
            if (!task.dueDate) return;

            const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
            const dtStart = dueDate.toISOString().replace(/[-:]/g, '').split('T')[0]
            const prefix = task.completed ? "[Done] " : ""

            lines.push(
                "BEGIN:VEVENT",
                `UID:task-${doc.id}@afcrashpad.com`,
                `DTSTAMP:${nowUtc}`,
                `DTSTART;VALUE=DATE:${dtStart}`,
                `SUMMARY:${prefix}${task.title}`,
                `DESCRIPTION:${task.description || 'No description provided.'}\\nPriority: ${task.priority}`,
                "END:VEVENT"
            )
        });

        lines.push("END:VCALENDAR")

        return new NextResponse(lines.join("\r\n"), {
            headers: {
                "Content-Type": "text/calendar; charset=utf-8",
                "Content-Disposition": `attachment; filename="crm-schedule.ics"`
            }
        })
    } catch (error) {
        console.error("Error generating ICS feed:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
