/**
 * Booking pages + appointments storage.
 *
 * One booking_pages doc per workspace (multi-page support is a v2 thing).
 * Public booking URL: /booking/<slug>
 *
 * Slot generation is recomputed on each page load — no pre-computed slot
 * inventory. Trade-off: page load is O(existingBookings + days * slots) but
 * we don't need a background sync job to keep slot availability fresh.
 */

import crypto from "node:crypto"
import { adminDb } from "@/lib/firebase-admin"

export interface DayHours {
    /** Hour-of-day, 0-23. */
    start: number
    /** Hour-of-day, 0-23. */
    end: number
}

export interface AppointmentType {
    /** Stable id, e.g. "discovery-call". Slug-shaped. */
    id: string
    /** Display name shown on the public booking page. */
    name: string
    /** How long this meeting type runs. Overrides slotDurationMinutes when picked. */
    durationMinutes: number
    /** Optional one-liner shown under the name on the public picker. */
    description?: string
}

export interface BookingPage {
    id: string
    workspaceId: string
    /** URL slug (lowercase letters/numbers/hyphens). Globally unique. */
    slug: string
    /** Display name on the booking page. */
    name: string
    /** Workspace IANA timezone for slot rendering. */
    timezone: string
    /** Default slot length in minutes — used when there are no appointment types,
     *  or as a fallback for any record that doesn't reference a type. */
    slotDurationMinutes: number
    /** Optional list of bookable meeting types. When non-empty the public page
     *  asks the visitor to pick a type first; the chosen type's duration is
     *  used for slot generation. Empty/undefined → single-type mode (legacy). */
    appointmentTypes?: AppointmentType[]
    /** Buffer between meetings in minutes (added to existing appointment ranges when checking conflicts). */
    bufferMinutes: number
    /** Earliest a slot can be booked: this many hours from now. */
    advanceNoticeHours: number
    /** Hard cap per day (0 = unlimited). */
    maxPerDay: number
    /** Per day-of-week (0=Sun..6=Sat) hours. Missing day = closed. */
    hoursByDay: Partial<Record<number, DayHours>>
    /** How far out into the future bookings are allowed. */
    futureWindowDays: number
    /** Optional intro shown above the calendar on the public page. */
    intro?: string
    createdAt: string
    updatedAt: string
}

export interface Appointment {
    id: string
    workspaceId: string
    bookingPageId: string
    contactId: string | null
    contactEmail: string
    contactName: string
    notes?: string
    /** Optional reference to the AppointmentType selected when booking. */
    appointmentTypeId?: string
    appointmentTypeName?: string
    /** ISO datetimes (UTC). */
    startsAt: string
    endsAt: string
    /** HMAC token for cancel-by-link. */
    cancelToken: string
    status: "confirmed" | "cancelled"
    createdAt: string
    cancelledAt?: string
}

function tsToISO(ts: unknown): string {
    if (!ts) return new Date().toISOString()
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
        return (ts as { toDate: () => Date }).toDate().toISOString()
    }
    if (ts instanceof Date) return ts.toISOString()
    return typeof ts === "string" ? ts : new Date().toISOString()
}

function defaultPage(workspaceId: string, slug: string): Omit<BookingPage, "id" | "createdAt" | "updatedAt"> {
    return {
        workspaceId,
        slug,
        name: "Book a meeting",
        timezone: "America/New_York",
        slotDurationMinutes: 30,
        bufferMinutes: 0,
        advanceNoticeHours: 4,
        maxPerDay: 0,
        hoursByDay: {
            1: { start: 9, end: 17 },
            2: { start: 9, end: 17 },
            3: { start: 9, end: 17 },
            4: { start: 9, end: 17 },
            5: { start: 9, end: 17 },
        },
        futureWindowDays: 30,
    }
}

function mapPage(id: string, data: Record<string, unknown>): BookingPage {
    return {
        id,
        workspaceId: (data.workspaceId as string) ?? "",
        slug: (data.slug as string) ?? "",
        name: (data.name as string) ?? "Book a meeting",
        timezone: (data.timezone as string) ?? "America/New_York",
        slotDurationMinutes: (data.slotDurationMinutes as number) ?? 30,
        appointmentTypes: Array.isArray(data.appointmentTypes)
            ? (data.appointmentTypes as AppointmentType[])
            : undefined,
        bufferMinutes: (data.bufferMinutes as number) ?? 0,
        advanceNoticeHours: (data.advanceNoticeHours as number) ?? 4,
        maxPerDay: (data.maxPerDay as number) ?? 0,
        hoursByDay: (data.hoursByDay as BookingPage["hoursByDay"]) ?? {},
        futureWindowDays: (data.futureWindowDays as number) ?? 30,
        intro: (data.intro as string) || undefined,
        createdAt: tsToISO(data.createdAt),
        updatedAt: tsToISO(data.updatedAt),
    }
}

function mapAppointment(id: string, data: Record<string, unknown>): Appointment {
    return {
        id,
        workspaceId: (data.workspaceId as string) ?? "",
        bookingPageId: (data.bookingPageId as string) ?? "",
        contactId: (data.contactId as string) ?? null,
        contactEmail: (data.contactEmail as string) ?? "",
        contactName: (data.contactName as string) ?? "",
        notes: (data.notes as string) || undefined,
        appointmentTypeId: (data.appointmentTypeId as string) || undefined,
        appointmentTypeName: (data.appointmentTypeName as string) || undefined,
        startsAt: tsToISO(data.startsAt),
        endsAt: tsToISO(data.endsAt),
        cancelToken: (data.cancelToken as string) ?? "",
        status: (data.status as Appointment["status"]) ?? "confirmed",
        createdAt: tsToISO(data.createdAt),
        cancelledAt: data.cancelledAt ? tsToISO(data.cancelledAt) : undefined,
    }
}

export async function getBookingPage(workspaceId: string): Promise<BookingPage | null> {
    const snap = await adminDb
        .collection("booking_pages")
        .where("workspaceId", "==", workspaceId)
        .limit(1)
        .get()
    if (snap.empty) return null
    const d = snap.docs[0]
    return mapPage(d.id, d.data())
}

export async function getBookingPageBySlug(slug: string): Promise<BookingPage | null> {
    const snap = await adminDb
        .collection("booking_pages")
        .where("slug", "==", slug)
        .limit(1)
        .get()
    if (snap.empty) return null
    const d = snap.docs[0]
    return mapPage(d.id, d.data())
}

export async function upsertBookingPage(
    workspaceId: string,
    patch: Partial<Omit<BookingPage, "id" | "workspaceId" | "createdAt" | "updatedAt">>,
): Promise<BookingPage> {
    const existing = await getBookingPage(workspaceId)
    const now = new Date()
    if (existing) {
        const updates: Record<string, unknown> = { updatedAt: now }
        for (const [k, v] of Object.entries(patch)) {
            if (v !== undefined) updates[k] = v
        }
        // slug uniqueness check (skip if unchanged)
        if (patch.slug && patch.slug !== existing.slug) {
            await assertSlugAvailable(patch.slug, existing.id)
        }
        await adminDb.collection("booking_pages").doc(existing.id).update(updates)
        const updated = await adminDb.collection("booking_pages").doc(existing.id).get()
        return mapPage(updated.id, updated.data()!)
    }
    // Create
    const slug = patch.slug?.trim() || `book-${workspaceId.slice(0, 8)}`
    await assertSlugAvailable(slug, null)
    const data = {
        ...defaultPage(workspaceId, slug),
        ...patch,
        slug,
        createdAt: now,
        updatedAt: now,
    }
    const ref = await adminDb.collection("booking_pages").add(data)
    const snap = await ref.get()
    return mapPage(ref.id, snap.data()!)
}

async function assertSlugAvailable(slug: string, exceptId: string | null): Promise<void> {
    const cleaned = slug.toLowerCase().replace(/[^a-z0-9-]/g, "")
    if (!cleaned) throw new Error("Slug cannot be empty")
    const snap = await adminDb
        .collection("booking_pages")
        .where("slug", "==", cleaned)
        .limit(1)
        .get()
    if (!snap.empty && snap.docs[0].id !== exceptId) {
        throw new Error(`Slug "${cleaned}" is already taken`)
    }
}

export async function listAppointmentsInRange(
    workspaceId: string,
    start: Date,
    end: Date,
): Promise<Appointment[]> {
    const snap = await adminDb
        .collection("appointments")
        .where("workspaceId", "==", workspaceId)
        .where("startsAt", ">=", start)
        .where("startsAt", "<=", end)
        .get()
    return snap.docs
        .map((d) => mapAppointment(d.id, d.data()))
        .filter((a) => a.status === "confirmed")
}

export async function listAppointmentsForWorkspace(
    workspaceId: string,
    limit = 200,
): Promise<Appointment[]> {
    const snap = await adminDb
        .collection("appointments")
        .where("workspaceId", "==", workspaceId)
        .orderBy("startsAt", "desc")
        .limit(limit)
        .get()
    return snap.docs.map((d) => mapAppointment(d.id, d.data()))
}

export async function getAppointment(id: string): Promise<Appointment | null> {
    const doc = await adminDb.collection("appointments").doc(id).get()
    if (!doc.exists) return null
    return mapAppointment(doc.id, doc.data()!)
}

export async function findAppointmentByCancelToken(
    token: string,
): Promise<Appointment | null> {
    const snap = await adminDb
        .collection("appointments")
        .where("cancelToken", "==", token)
        .limit(1)
        .get()
    if (snap.empty) return null
    return mapAppointment(snap.docs[0].id, snap.docs[0].data())
}

export interface CreateAppointmentInput {
    workspaceId: string
    bookingPageId: string
    contactId: string | null
    contactEmail: string
    contactName: string
    notes?: string
    appointmentTypeId?: string
    appointmentTypeName?: string
    startsAt: Date
    endsAt: Date
}

export async function createAppointment(
    input: CreateAppointmentInput,
): Promise<Appointment> {
    const cancelToken = crypto.randomBytes(20).toString("hex")
    const ref = await adminDb.collection("appointments").add({
        workspaceId: input.workspaceId,
        bookingPageId: input.bookingPageId,
        contactId: input.contactId,
        contactEmail: input.contactEmail.toLowerCase(),
        contactName: input.contactName,
        notes: input.notes ?? null,
        appointmentTypeId: input.appointmentTypeId ?? null,
        appointmentTypeName: input.appointmentTypeName ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        cancelToken,
        status: "confirmed",
        createdAt: new Date(),
    })
    const snap = await ref.get()
    return mapAppointment(ref.id, snap.data()!)
}

export async function cancelAppointment(id: string): Promise<void> {
    await adminDb.collection("appointments").doc(id).update({
        status: "cancelled",
        cancelledAt: new Date(),
    })
}

// ── Slot generation ────────────────────────────────────────────────────

export interface BookableSlot {
    /** ISO start time. */
    start: string
    /** ISO end time. */
    end: string
}

export interface DayBlock {
    /** Local date label (YYYY-MM-DD in the page's timezone). */
    date: string
    /** Day of week 0-6 in the page's timezone. */
    dow: number
    slots: BookableSlot[]
}

/** Format a JS Date into a YYYY-MM-DD string in the given IANA timezone. */
function dateInTz(d: Date, tz: string): { date: string; dow: number; hour: number; minute: number } {
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
        hour12: false,
    })
    const parts = fmt.formatToParts(d)
    const get = (k: string) => parts.find((p) => p.type === k)?.value ?? ""
    const date = `${get("year")}-${get("month")}-${get("day")}`
    const wkdayMap: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    }
    const dow = wkdayMap[get("weekday")] ?? 0
    return {
        date,
        dow,
        hour: parseInt(get("hour"), 10),
        minute: parseInt(get("minute"), 10),
    }
}

/**
 * Build a UTC Date from the given local YYYY-MM-DD HH:MM in a target IANA tz.
 * Approximate: derives the TZ offset for the input local date via Intl.
 */
function localToUtc(dateStr: string, hour: number, minute: number, tz: string): Date {
    // Build a Date at "wall clock" UTC and figure out the target-tz offset
    const [y, m, d] = dateStr.split("-").map(Number)
    const guess = new Date(Date.UTC(y, m - 1, d, hour, minute))
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        hour12: false,
        timeZoneName: "shortOffset",
    })
    const offsetPart =
        fmt.formatToParts(guess).find((p) => p.type === "timeZoneName")?.value || "GMT+0"
    const match = /GMT([+-])(\d+)(?::(\d+))?/.exec(offsetPart)
    let offsetMinutes = 0
    if (match) {
        const sign = match[1] === "+" ? 1 : -1
        const hh = parseInt(match[2], 10) || 0
        const mm = parseInt(match[3] || "0", 10) || 0
        offsetMinutes = sign * (hh * 60 + mm)
    }
    return new Date(guess.getTime() - offsetMinutes * 60_000)
}

/** Generate available slots for the next N days respecting bookings + page config.
 *  If `durationOverride` is set (e.g. from a selected AppointmentType), uses that
 *  instead of page.slotDurationMinutes for slot length. */
export function generateSlots(
    page: BookingPage,
    existingAppointments: Appointment[],
    now: Date = new Date(),
    durationOverride?: number,
): DayBlock[] {
    const earliest = new Date(now.getTime() + page.advanceNoticeHours * 60 * 60 * 1000)
    const latest = new Date(now.getTime() + page.futureWindowDays * 24 * 60 * 60 * 1000)
    const tz = page.timezone || "UTC"
    const effectiveDuration = durationOverride && durationOverride > 0
        ? durationOverride
        : page.slotDurationMinutes
    const slotMs = effectiveDuration * 60_000
    const bufferMs = page.bufferMinutes * 60_000

    // Bucket existing appointments by their local date in tz
    const busy = existingAppointments.map((a) => ({
        start: new Date(a.startsAt).getTime(),
        end: new Date(a.endsAt).getTime(),
    }))

    const days: DayBlock[] = []
    const cursor = new Date(now)
    for (let i = 0; i < page.futureWindowDays; i++) {
        const dt = new Date(cursor.getTime() + i * 24 * 60 * 60 * 1000)
        const local = dateInTz(dt, tz)
        const hours = page.hoursByDay[local.dow]
        if (!hours) continue

        const slots: BookableSlot[] = []
        for (let hour = hours.start; hour < hours.end; hour++) {
            for (let minute = 0; minute < 60; minute += effectiveDuration) {
                if (hour + minute / 60 + effectiveDuration / 60 > hours.end) continue
                const startUtc = localToUtc(local.date, hour, minute, tz)
                const endUtc = new Date(startUtc.getTime() + slotMs)
                if (startUtc < earliest) continue
                if (startUtc > latest) continue
                const conflict = busy.some(
                    (b) =>
                        startUtc.getTime() < b.end + bufferMs &&
                        endUtc.getTime() > b.start - bufferMs,
                )
                if (conflict) continue
                slots.push({
                    start: startUtc.toISOString(),
                    end: endUtc.toISOString(),
                })
            }
        }
        if (page.maxPerDay > 0 && slots.length > page.maxPerDay) {
            slots.length = page.maxPerDay
        }
        if (slots.length > 0) {
            days.push({ date: local.date, dow: local.dow, slots })
        }
    }
    return days
}
