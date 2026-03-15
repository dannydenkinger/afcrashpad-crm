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

        // Map Opportunities to Events — use stay dates if available, otherwise skip
        oppsSnap.forEach(doc => {
            const opp = doc.data();

            // Use stayStartDate/stayEndDate for date range events
            const startStr = opp.stayStartDate || null
            const endStr = opp.stayEndDate || null

            if (!startStr) return // Skip opportunities without dates

            const startDate = new Date(startStr)
            if (isNaN(startDate.getTime())) return

            const dtStart = startDate.toISOString().replace(/[-:]/g, '').split('T')[0]

            if (endStr) {
                const endDate = new Date(endStr)
                if (!isNaN(endDate.getTime())) {
                    // Add 1 day to end date for all-day event (iCal DTEND is exclusive)
                    const endPlusOne = new Date(endDate.getTime() + 86400000)
                    const dtEnd = endPlusOne.toISOString().replace(/[-:]/g, '').split('T')[0]
                    lines.push(
                        "BEGIN:VEVENT",
                        `UID:opp-${doc.id}@afcrashpad.com`,
                        `DTSTAMP:${nowUtc}`,
                        `DTSTART;VALUE=DATE:${dtStart}`,
                        `DTEND;VALUE=DATE:${dtEnd}`,
                        `SUMMARY:[Stay] ${opp.name}`,
                        `DESCRIPTION:Value: $${opp.opportunityValue || 0}\\nBase: ${opp.militaryBase || 'N/A'}\\nPriority: ${opp.priority || 'N/A'}`,
                        "END:VEVENT"
                    )
                    return
                }
            }

            // Single-day event if no end date
            lines.push(
                "BEGIN:VEVENT",
                `UID:opp-${doc.id}@afcrashpad.com`,
                `DTSTAMP:${nowUtc}`,
                `DTSTART;VALUE=DATE:${dtStart}`,
                `SUMMARY:[Stay] ${opp.name}`,
                `DESCRIPTION:Value: $${opp.opportunityValue || 0}\\nBase: ${opp.militaryBase || 'N/A'}\\nPriority: ${opp.priority || 'N/A'}`,
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
