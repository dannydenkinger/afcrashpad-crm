import {
    generateSlots,
    getBookingPageBySlug,
    listAppointmentsInRange,
} from "@/lib/booking/store"
import { notFound } from "next/navigation"
import { adminDb } from "@/lib/firebase-admin"
import { BookingClient } from "./BookingClient"

export const dynamic = "force-dynamic"

interface PageProps {
    params: Promise<{ slug: string }>
}

export default async function PublicBookingPage({ params }: PageProps) {
    const { slug } = await params
    const page = await getBookingPageBySlug(slug)
    if (!page) notFound()

    const now = new Date()
    const horizon = new Date(now.getTime() + page.futureWindowDays * 24 * 60 * 60 * 1000)
    const existing = await listAppointmentsInRange(page.workspaceId, now, horizon)

    // Pre-compute slots per appointment type so the client can swap instantly
    // when the visitor picks a type. Falls back to a single "default" slot set
    // when the page has no types configured.
    const types = page.appointmentTypes ?? []
    const slotsByType: Record<string, ReturnType<typeof generateSlots>> = {}
    if (types.length > 0) {
        for (const t of types) {
            slotsByType[t.id] = generateSlots(page, existing, now, t.durationMinutes)
        }
    } else {
        slotsByType.__default = generateSlots(page, existing, now)
    }

    // Workspace name for the header
    const wsDoc = await adminDb.collection("workspaces").doc(page.workspaceId).get()
    const workspaceName = (wsDoc.data()?.name as string) || page.name

    return (
        <BookingClient
            slug={slug}
            pageName={page.name}
            workspaceName={workspaceName}
            timezone={page.timezone}
            slotMinutes={page.slotDurationMinutes}
            intro={page.intro}
            appointmentTypes={types}
            slotsByType={slotsByType}
        />
    )
}
