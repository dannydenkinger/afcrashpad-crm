/**
 * Shared calendar event shape used across the calendar feature. Once held
 * fetchGoogleEvents / fetchAppleEvents helpers that pulled the operator's
 * personal Google/Apple calendars via env-var creds — both are gone now.
 * Calendar reads happen via per-workspace OAuth tokens in their own files.
 */

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    description?: string;
    source: "GOOGLE" | "APPLE" | "SYSTEM" | "TASK" | "EVENT" | "APPOINTMENT";
    color?: string;
    calendarId?: string;
    calendarName?: string;
    navigationUrl?: string;
}
