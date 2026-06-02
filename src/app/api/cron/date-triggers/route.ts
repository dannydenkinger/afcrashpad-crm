/**
 * Daily cron: fires birthday + anniversary automation triggers for any
 * contact whose stored date matches today's MM-DD (UTC).
 *
 * Runs once per day. Idempotency is via the per-contact single-enrollment
 * guard inside fireTrigger — if the cron fires twice on the same day, the
 * automation only enrolls each contact once (unless allowReEnroll is on).
 */

import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { fireTrigger } from "@/lib/automations/triggers"
import { logCronRun } from "@/lib/cron-log"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const CRON_NAME = "date-triggers"

interface ContactDateMatch {
    workspaceId: string
    contactId: string
    email?: string
    type: "birthday" | "anniversary"
    date: string
}

const PER_TICK_CAP = 5000

export async function GET(req: NextRequest) {
    const started = Date.now()
    if (process.env.NODE_ENV !== "development") {
        const authHeader = req.headers.get("authorization") ?? ""
        const expected = process.env.CRON_SECRET
        if (!expected) {
            await logCronRun({ name: CRON_NAME, status: "error", durationMs: Date.now() - started, error: "CRON_SECRET not configured" })
            return NextResponse.json(
                { error: "CRON_SECRET not configured" },
                { status: 500 },
            )
        }
        if (authHeader !== `Bearer ${expected}`) {
            await logCronRun({ name: CRON_NAME, status: "unauthorized", durationMs: Date.now() - started })
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    try {
        const today = new Date()
        const mm = String(today.getUTCMonth() + 1).padStart(2, "0")
        const dd = String(today.getUTCDate()).padStart(2, "0")
        const todayMmDd = `${mm}-${dd}`

        const matches: ContactDateMatch[] = []
        const snap = await adminDb.collection("contacts").limit(PER_TICK_CAP).get()
        for (const d of snap.docs) {
            const data = d.data()
            const workspaceId = data.workspaceId as string | undefined
            if (!workspaceId) continue

            for (const field of ["birthday", "anniversary"] as const) {
                const raw = (data[field] as string | undefined) ?? ""
                if (!raw) continue
                const mmddMatch =
                    /^\d{4}-(\d{2})-(\d{2})/.exec(raw) ??
                    /^(\d{2})-(\d{2})$/.exec(raw)
                if (!mmddMatch) continue
                const got = `${mmddMatch[1]}-${mmddMatch[2]}`
                if (got !== todayMmDd) continue
                matches.push({
                    workspaceId,
                    contactId: d.id,
                    email: (data.email as string) || undefined,
                    type: field,
                    date: raw,
                })
            }
        }

        let fired = 0
        for (const m of matches) {
            await fireTrigger({
                workspaceId: m.workspaceId,
                type: m.type,
                contactId: m.contactId,
                contactEmail: m.email,
                payload: { date: m.date },
            }).catch(() => {})
            fired += 1
        }

        await logCronRun({
            name: CRON_NAME,
            status: "success",
            durationMs: Date.now() - started,
            detail: { date: todayMmDd, scanned: snap.size, matches: matches.length, fired },
        })
        return NextResponse.json({
            ok: true,
            date: todayMmDd,
            scanned: snap.size,
            matches: matches.length,
            fired,
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        await logCronRun({ name: CRON_NAME, status: "error", durationMs: Date.now() - started, error: message })
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
