"use server"

import { z } from "zod"
import { adminDb } from "@/lib/firebase-admin"
import {
    createAppointment,
    generateSlots,
    getBookingPageBySlug,
    listAppointmentsInRange,
} from "@/lib/booking/store"
import { fireTrigger } from "@/lib/automations/triggers"
import { sendEmail } from "@/lib/ses/sender"

const submitSchema = z.object({
    slug: z.string().min(1),
    startsAt: z.string().min(1),
    name: z.string().min(1).max(120),
    email: z.string().email(),
    notes: z.string().max(2000).optional(),
    appointmentTypeId: z.string().max(120).optional(),
})

export async function submitBookingAction(input: z.infer<typeof submitSchema>) {
    const parsed = submitSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    try {
        const page = await getBookingPageBySlug(parsed.data.slug)
        if (!page) return { success: false, error: "Booking page not found" }

        // Resolve which duration to use — the picked appointment type if set,
        // otherwise the page default
        let pickedType: { id: string; name: string; durationMinutes: number } | null = null
        if (parsed.data.appointmentTypeId && page.appointmentTypes) {
            pickedType = page.appointmentTypes.find((t) => t.id === parsed.data.appointmentTypeId) ?? null
            if (!pickedType) return { success: false, error: "That appointment type no longer exists." }
        }
        const duration = pickedType?.durationMinutes ?? page.slotDurationMinutes

        const startsAt = new Date(parsed.data.startsAt)
        const endsAt = new Date(startsAt.getTime() + duration * 60_000)

        // Re-validate that the requested slot is still available (avoid races)
        const horizon = new Date(
            Date.now() + page.futureWindowDays * 24 * 60 * 60 * 1000,
        )
        const existing = await listAppointmentsInRange(page.workspaceId, new Date(), horizon)
        const days = generateSlots(page, existing, new Date(), duration)
        const targetIso = startsAt.toISOString()
        const slotStillFree = days.some((d) =>
            d.slots.some((s) => s.start === targetIso),
        )
        if (!slotStillFree) {
            return { success: false, error: "That slot was just taken — please pick another." }
        }

        // Resolve email → existing contact, or create one
        const email = parsed.data.email.trim().toLowerCase()
        let contactId: string | null = null
        const contactSnap = await adminDb
            .collection("contacts")
            .where("workspaceId", "==", page.workspaceId)
            .where("email", "==", email)
            .limit(1)
            .get()
        if (!contactSnap.empty) {
            contactId = contactSnap.docs[0].id
        } else {
            const ref = await adminDb.collection("contacts").add({
                workspaceId: page.workspaceId,
                name: parsed.data.name,
                email,
                phone: null,
                status: "Lead",
                tags: [],
                source: "booking",
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            contactId = ref.id
        }

        const appointment = await createAppointment({
            workspaceId: page.workspaceId,
            bookingPageId: page.id,
            contactId,
            contactEmail: email,
            contactName: parsed.data.name,
            notes: parsed.data.notes,
            appointmentTypeId: pickedType?.id,
            appointmentTypeName: pickedType?.name,
            startsAt,
            endsAt,
        })

        // Fire automation trigger
        fireTrigger({
            workspaceId: page.workspaceId,
            type: "appointment_booked",
            contactId: contactId ?? "",
            contactEmail: email,
            payload: {
                appointmentId: appointment.id,
                bookingPageId: page.id,
                startsAt: startsAt.toISOString(),
                endsAt: endsAt.toISOString(),
            },
        }).catch(() => {})

        // Best-effort confirmation email — workspace must have SES configured
        try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
            const cancelUrl = `${appUrl}/booking/cancel/${appointment.cancelToken}`
            await sendEmail({
                workspaceId: page.workspaceId,
                to: email,
                subject: `Confirmed: ${page.name}`,
                html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;color:#0f172a;">
<p style="font-size:16px;line-height:1.6;">Hi ${escapeHtml(parsed.data.name)},</p>
<p style="font-size:16px;line-height:1.6;">Your meeting is confirmed for:</p>
<p style="font-size:18px;font-weight:600;color:#4f46e5;">
${escapeHtml(formatLocal(startsAt, page.timezone))} (${escapeHtml(page.timezone)})
</p>
<p style="font-size:14px;color:#64748b;line-height:1.6;">Need to cancel? <a href="${cancelUrl}" style="color:#4f46e5;">Use this link</a>.</p>
</div>`,
                contactId: contactId ?? undefined,
                campaignId: `booking:${appointment.id}`,
                autoResolveContact: false,
            })
        } catch {
            // SES might not be configured for this workspace — booking still saved
        }

        return {
            success: true,
            appointmentId: appointment.id,
            startsAt: appointment.startsAt,
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Booking failed"
        return { success: false, error: message }
    }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

function formatLocal(date: Date, tz: string): string {
    try {
        return new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(date)
    } catch {
        return date.toISOString()
    }
}
