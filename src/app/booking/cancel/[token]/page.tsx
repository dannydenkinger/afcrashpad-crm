import { findAppointmentByCancelToken, cancelAppointment, getBookingPageBySlug } from "@/lib/booking/store"
import { CancelClient } from "./CancelClient"
import { adminDb } from "@/lib/firebase-admin"

export const dynamic = "force-dynamic"

interface Props {
    params: Promise<{ token: string }>
}

export default async function CancelPage({ params }: Props) {
    const { token } = await params
    const appointment = await findAppointmentByCancelToken(token)

    if (!appointment) {
        return (
            <CancelClient
                state="not_found"
                workspaceName="this organization"
            />
        )
    }

    if (appointment.status === "cancelled") {
        return (
            <CancelClient
                state="already_cancelled"
                workspaceName="this organization"
                when={appointment.startsAt}
            />
        )
    }

    // Cancel the appointment immediately on page load
    await cancelAppointment(appointment.id)

    // Workspace name for nicer copy
    const wsDoc = await adminDb.collection("workspaces").doc(appointment.workspaceId).get()
    const workspaceName = (wsDoc.data()?.name as string) || "this organization"

    void getBookingPageBySlug // referenced for completeness; not needed here

    return (
        <CancelClient
            state="cancelled"
            workspaceName={workspaceName}
            when={appointment.startsAt}
        />
    )
}
