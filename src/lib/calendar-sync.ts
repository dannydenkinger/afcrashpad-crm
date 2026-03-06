import { google } from "googleapis";
import nodeIcal from "node-ical";

const clientEmail = process.env.GA_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
const rawKey = process.env.GA_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
const privateKey = rawKey?.replace(/\\n/g, "\n");
const googleCalendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
const appleCalendarUrl = process.env.APPLE_CALENDAR_URL;

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    description?: string;
    source: "GOOGLE" | "APPLE" | "SYSTEM" | "TASK";
    color?: string;
    calendarId?: string;
    calendarName?: string;
    navigationUrl?: string;
}

export async function fetchGoogleEvents(days: number = 30): Promise<CalendarEvent[]> {
    if (!clientEmail || !privateKey) {
        console.warn("Google credentials missing for Calendar sync.");
        return [];
    }

    try {
        const auth = new google.auth.JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ["https://www.googleapis.com/auth/calendar.readonly"]
        });

        const calendar = google.calendar({ version: "v3", auth });
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - days);

        const response = await calendar.events.list({
            calendarId: googleCalendarId,
            timeMin: timeMin.toISOString(),
            maxResults: 100,
            singleEvents: true,
            orderBy: "startTime",
        });

        return (response.data.items || []).map(event => ({
            id: event.id || Math.random().toString(),
            title: event.summary || "Untitled Event",
            start: new Date(event.start?.dateTime || event.start?.date || ""),
            end: new Date(event.end?.dateTime || event.end?.date || ""),
            description: event.description || "",
            source: "GOOGLE",
            color: "#4285F4" // Google Blue
        }));
    } catch (error) {
        console.error("Error fetching Google Calendar events:", error);
        return [];
    }
}

export async function fetchAppleEvents(): Promise<CalendarEvent[]> {
    if (!appleCalendarUrl) {
        console.warn("Apple Calendar URL missing.");
        return [];
    }

    try {
        const webEvents = await nodeIcal.fromURL(appleCalendarUrl);
        const events: CalendarEvent[] = [];

        for (const k in webEvents) {
            if (Object.prototype.hasOwnProperty.call(webEvents, k)) {
                const ev = webEvents[k] as any;
                if (ev?.type === 'VEVENT') {
                    events.push({
                        id: ev.uid || Math.random().toString(),
                        title: ev.summary || "Untitled Event",
                        start: new Date(ev.start),
                        end: new Date(ev.end),
                        description: ev.description || "",
                        source: "APPLE",
                        color: "#5856D6" // Apple Purple
                    });
                }
            }
        }
        return events;
    } catch (error) {
        console.error("Error fetching Apple Calendar events:", error);
        return [];
    }
}
