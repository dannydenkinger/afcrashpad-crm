import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { NextResponse } from "next/server"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ feedId: string }> }
) {
    try {
        const { feedId } = await params

        if (!feedId) return new NextResponse("Missing Feed ID", { status: 400 })

        // Global lookup: find user by their unique calendar feed ID
        // The feedId itself serves as authorization for this public endpoint
        const usersSnap = await adminDb.collection('users').where('calendarFeedId', '==', feedId).limit(1).get()

        if (usersSnap.empty) return new NextResponse("Invalid Feed URL", { status: 404 })

        const userDoc = usersSnap.docs[0];
        const user = { id: userDoc.id, ...userDoc.data() }

        // Derive workspace from workspace_members
        const memberSnap = await adminDb.collection('workspace_members')
            .where('userId', '==', userDoc.id)
            .where('status', '==', 'active')
            .limit(1)
            .get()

        if (memberSnap.empty) return new NextResponse("No workspace found for user", { status: 404 })
        const workspaceId = memberSnap.docs[0].data().workspaceId
        const db = tenantDb(workspaceId)

        const appDomain = (process.env.NEXT_PUBLIC_APP_URL || "localhost").replace(/^https?:\/\//, '')

        // Start building iCalendar string manually
        const lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            `PRODID:-//Vesta CRM//Calendar Sync//EN`,
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            `X-WR-CALNAME:${(user as any).name || 'Agent'}'s CRM Schedule`,
            "X-WR-TIMEZONE:America/Chicago"
        ]

        const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

        // Fetch Opportunities assigned to this user (tenant-scoped)
        const oppsSnap = await db.collection('opportunities').where('assigneeId', '==', user.id).get()

        // Fetch Tasks assigned to this user (tenant-scoped)
        const tasksSnap = await db.collection('tasks').where('assigneeId', '==', user.id).get()

        // Map Opportunities to Events — use start/end dates if available
        oppsSnap.forEach(doc => {
            const opp = doc.data();

            const startStr = opp.startDate || opp.stayStartDate || null
            const endStr = opp.endDate || opp.stayEndDate || null

            if (!startStr) return

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
                        `UID:opp-${doc.id}@${appDomain}`,
                        `DTSTAMP:${nowUtc}`,
                        `DTSTART;VALUE=DATE:${dtStart}`,
                        `DTEND;VALUE=DATE:${dtEnd}`,
                        `SUMMARY:[Deal] ${opp.name}`,
                        `DESCRIPTION:Value: $${opp.value || opp.opportunityValue || 0}\\nPriority: ${opp.priority || 'N/A'}`,
                        "END:VEVENT"
                    )
                    return
                }
            }

            // Single-day event if no end date
            lines.push(
                "BEGIN:VEVENT",
                `UID:opp-${doc.id}@${appDomain}`,
                `DTSTAMP:${nowUtc}`,
                `DTSTART;VALUE=DATE:${dtStart}`,
                `SUMMARY:[Deal] ${opp.name}`,
                `DESCRIPTION:Value: $${opp.value || opp.opportunityValue || 0}\\nPriority: ${opp.priority || 'N/A'}`,
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
                `UID:task-${doc.id}@${appDomain}`,
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
                "Content-Disposition": `attachment; filename="crm-schedule.ics"`,
                "Cache-Control": "public, max-age=300",
            }
        })
    } catch (error) {
        console.error("Error generating ICS feed:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
