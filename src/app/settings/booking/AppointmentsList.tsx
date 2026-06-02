"use client"

import type { Appointment } from "@/lib/booking/store"

export function AppointmentsList({
    appointments,
    timezone,
}: {
    appointments: Appointment[]
    timezone: string
}) {
    return (
        <div className="divide-y border rounded-md">
            {appointments.map((a) => (
                <div
                    key={a.id}
                    className="flex items-center gap-3 py-2.5 px-3 text-sm hover:bg-muted/30 transition-colors"
                >
                    <span
                        className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded shrink-0 ${
                            a.status === "cancelled"
                                ? "bg-muted text-muted-foreground"
                                : "bg-emerald-500/10 text-emerald-700"
                        }`}
                    >
                        {a.status}
                    </span>
                    <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{a.contactName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                            {a.contactEmail}
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums shrink-0 text-right">
                        {formatLocal(a.startsAt, timezone)}
                    </div>
                </div>
            ))}
        </div>
    )
}

function formatLocal(iso: string, tz: string): string {
    try {
        return new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(new Date(iso))
    } catch {
        return iso
    }
}
