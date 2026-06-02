"use client"

interface Props {
    state: "cancelled" | "already_cancelled" | "not_found"
    workspaceName: string
    when?: string
}

export function CancelClient({ state, workspaceName, when }: Props) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center space-y-3">
                {state === "not_found" ? (
                    <>
                        <h1 className="text-xl font-semibold text-slate-900">
                            Booking not found
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            That cancellation link is invalid or expired.
                        </p>
                    </>
                ) : state === "already_cancelled" ? (
                    <>
                        <h1 className="text-xl font-semibold text-slate-900">
                            Already cancelled
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Your meeting with{" "}
                            <strong className="text-slate-900">{workspaceName}</strong>
                            {when ? ` on ${formatDate(when)}` : ""} was already cancelled.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-3xl">
                            ✓
                        </div>
                        <h1 className="text-xl font-semibold text-slate-900">
                            Booking cancelled
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Your meeting with{" "}
                            <strong className="text-slate-900">{workspaceName}</strong>
                            {when ? ` on ${formatDate(when)}` : ""} has been cancelled. No
                            further action needed.
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}

function formatDate(iso: string): string {
    try {
        return new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(new Date(iso))
    } catch {
        return iso
    }
}
