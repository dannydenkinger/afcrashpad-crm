/**
 * Public webhook-in trigger for automations. External systems POST a JSON
 * payload to /api/automations/trigger/<token> to enroll a contact into the
 * matching automation.
 *
 * Token format (HMAC-signed):
 *   base64url(workspaceId.automationId).<sig>
 *
 * Body:
 *   { email: string, name?: string, ...anyOtherFields }
 *
 * Behavior:
 *   - Resolves email to an existing CRM contact, or enrolls as external
 *   - Honors automation.allowReEnroll
 *   - Returns { ok, runId } on success
 */

import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { adminDb } from "@/lib/firebase-admin"
import { getAutomation, isContactEnrolled, startRun } from "@/lib/automations/store"
import { advanceRun } from "@/lib/automations/engine"

export const dynamic = "force-dynamic"

interface Ctx {
    params: Promise<{ token: string }>
}

function getSecret(): string {
    const secret = process.env.TRACKING_SECRET
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("TRACKING_SECRET must be set in production")
        }
        return "vesta-dev-fallback-secret-do-not-use-in-prod"
    }
    return secret
}

function b64urlDecode(s: string): string {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)
    return Buffer.from(padded, "base64").toString("utf8")
}

function sign(payload: string): string {
    return crypto
        .createHmac("sha256", getSecret())
        .update(payload)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
        .slice(0, 32)
}

function verifyToken(token: string): { workspaceId: string; automationId: string } | null {
    if (!token.includes(".")) return null
    const [encoded, sig] = token.split(".")
    if (!encoded || !sig) return null
    let payload: string
    try {
        payload = b64urlDecode(encoded)
    } catch {
        return null
    }
    const expected = sign(payload)
    if (
        sig.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
        return null
    }
    const [workspaceId, automationId] = payload.split(".")
    if (!workspaceId || !automationId) return null
    return { workspaceId, automationId }
}

export async function POST(req: NextRequest, ctx: Ctx) {
    const { token } = await ctx.params
    const verified = verifyToken(token)
    if (!verified) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    let body: { email?: string; name?: string; [key: string]: unknown } = {}
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // Pull email from common shapes used by Calendly / Cal.com / Acuity etc.
    // Top-level wins; fall back to common nested locations.
    const nestedAttendee = (body.payload as { invitee?: { email?: string } } | undefined)?.invitee
    const nestedAttendees = (body.payload as { attendees?: Array<{ email?: string }> } | undefined)?.attendees
    const candidates = [
        body.email,
        (body as { invitee_email?: string }).invitee_email,
        nestedAttendee?.email,
        nestedAttendees?.[0]?.email,
    ]
    const email = (candidates.find((e) => typeof e === "string" && e.includes("@")) ?? "")
        .toString()
        .trim()
        .toLowerCase()
    if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "email required" }, { status: 400 })
    }

    const automation = await getAutomation(verified.workspaceId, verified.automationId)
    if (!automation) {
        return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }
    if (!automation.enabled) {
        return NextResponse.json({ error: "Automation paused" }, { status: 409 })
    }
    const triggerType = automation.trigger.type
    if (triggerType !== "webhook_in" && triggerType !== "appointment_booked") {
        return NextResponse.json(
            { error: `Automation trigger '${triggerType}' does not accept webhook calls` },
            { status: 409 },
        )
    }

    // Resolve email → contact if one exists
    const snap = await adminDb
        .collection("contacts")
        .where("workspaceId", "==", verified.workspaceId)
        .where("email", "==", email)
        .limit(1)
        .get()
    const contactId = snap.empty ? "" : snap.docs[0].id

    if (contactId && !automation.allowReEnroll) {
        if (await isContactEnrolled(automation.id, contactId)) {
            return NextResponse.json({
                ok: true,
                skipped: "already enrolled",
                contactId,
            })
        }
    }

    const run = await startRun({
        workspaceId: verified.workspaceId,
        automationId: automation.id,
        contactId,
        contactEmail: email,
        contextData: {
            triggerType,
            triggerMatch: {},
            triggerPayload: body,
            triggeredAt: new Date().toISOString(),
        },
    })
    advanceRun(run.id).catch((err) =>
        console.error("[webhook_in] advanceRun failed:", err),
    )

    return NextResponse.json({ ok: true, runId: run.id, contactId })
}
