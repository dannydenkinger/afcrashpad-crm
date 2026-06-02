import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth-guard"
import { captureError, captureMessage } from "@/lib/error-tracking"

export const dynamic = "force-dynamic"

/**
 * Throws a server-side error so you can verify Sentry ingestion after
 * adding the DSN. Owner-only to keep production from being trivially
 * pingable by anyone.
 *
 *   GET  /api/test/error           → throws (uncaught — exercises onRequestError)
 *   GET  /api/test/error?capture   → captureError (manual exception path)
 *   GET  /api/test/error?message   → captureMessage warning (non-error path)
 */
export async function GET(request: Request) {
    const session = await getAuthSession()
    if (session?.user?.role !== "OWNER") {
        return NextResponse.json({ error: "Owner only" }, { status: 403 })
    }

    const url = new URL(request.url)

    if (url.searchParams.has("message")) {
        captureMessage("Sentry test message — non-error path", "warning")
        return NextResponse.json({
            ok: true,
            mode: "message",
            message: "Sent a captureMessage to Sentry (or console if DSN missing).",
        })
    }

    if (url.searchParams.has("capture")) {
        captureError(new Error("Sentry test — captureError path"), {
            triggeredBy: session.user.email,
            mode: "manual-capture",
        })
        return NextResponse.json({
            ok: true,
            mode: "capture",
            message: "Sent a captureException to Sentry (or console if DSN missing).",
        })
    }

    // Default: uncaught throw. This exercises the Sentry instrumentation
    // hook's onRequestError handler so you can verify the full pipeline.
    throw new Error(
        `Sentry test — uncaught error path (triggered by ${session.user.email})`,
    )
}
