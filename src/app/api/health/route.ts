import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
    const detailed = req.nextUrl.searchParams.get("detailed") === "1"
    const expected = process.env.HEALTH_CHECK_SECRET
    const provided = req.headers.get("authorization") ?? ""
    const authed = detailed && expected ? provided === `Bearer ${expected}` : false

    if (detailed && !authed) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { adminDb } = await import("@/lib/firebase-admin")
        await adminDb.collection("_health").limit(1).get()
    } catch (err: any) {
        if (!detailed) {
            return NextResponse.json({ healthy: false }, { status: 503 })
        }
        return NextResponse.json(
            { healthy: false, checks: { firebase_connection: { status: "error", detail: err.message?.slice(0, 100) } } },
            { status: 503 },
        )
    }

    if (!detailed) {
        return NextResponse.json({ healthy: true }, { status: 200 })
    }

    const checks: Record<string, { status: "ok" | "missing" }> = {
        firebase_connection: { status: "ok" },
    }
    const requiredVars = [
        "NEXTAUTH_SECRET",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "FIREBASE_PROJECT_ID",
        "FIREBASE_PRIVATE_KEY",
        "RESEND_API_KEY",
        "RESEND_FROM_EMAIL",
    ]
    for (const v of requiredVars) {
        checks[v] = process.env[v] ? { status: "ok" } : { status: "missing" }
    }
    const allOk = Object.values(checks).every((c) => c.status === "ok")
    return NextResponse.json({ healthy: allOk, checks }, { status: allOk ? 200 : 503 })
}
