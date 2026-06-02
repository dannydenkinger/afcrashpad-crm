import { requireAdmin } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { getBookingPage, listAppointmentsForWorkspace } from "@/lib/booking/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "lucide-react"
import { BookingConfigForm } from "./BookingConfigForm"
import { AppointmentsList } from "./AppointmentsList"
import { BackLink } from "@/components/ui/BackLink"

export const dynamic = "force-dynamic"

export default async function BookingSettingsPage() {
    const session = await requireAdmin()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const [page, appointments, wsDoc] = await Promise.all([
        getBookingPage(workspaceId),
        listAppointmentsForWorkspace(workspaceId, 50),
        adminDb.collection("workspaces").doc(workspaceId).get(),
    ])

    const workspaceName = (wsDoc.data()?.name as string) || "Workspace"
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""

    return (
        <div className="container mx-auto max-w-4xl py-10 px-4 space-y-6">
            <div>
                <BackLink href="/settings/workspace" label="Back to Workspace settings" />
                <h1 className="text-2xl font-semibold flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-primary" />
                    Booking page
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Let prospects book meetings with you directly. Each booking auto-creates
                    a contact (if new) and fires the <code>appointment_booked</code> automation
                    trigger.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                    <BookingConfigForm
                        initial={page}
                        appUrl={appUrl}
                        workspaceFallbackName={workspaceName}
                    />
                </CardContent>
            </Card>

            {appointments.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            Recent appointments
                            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                                ({appointments.length})
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AppointmentsList appointments={appointments} timezone={page?.timezone ?? "UTC"} />
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
