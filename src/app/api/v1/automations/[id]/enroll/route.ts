/**
 * POST /api/v1/automations/{id}/enroll
 *
 * Enroll one or more contacts into an automation. Honors the automation's
 * allowReEnroll setting. Body:
 *   { contactIds?: string[], email?: string }
 *
 * If `email` is provided, we resolve to an existing CRM contact by email or
 * enroll as an external recipient (engine handles the no-contact case).
 * `contactIds[]` enrolls each id directly.
 */

import { NextRequest } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import {
    getAutomation,
    isContactEnrolled,
    startRun,
} from "@/lib/automations/store"
import { advanceRun } from "@/lib/automations/engine"
import {
    badRequest,
    forbidden,
    notFound,
    ok,
    withApiKey,
} from "@/lib/api/v1"

export const dynamic = "force-dynamic"

interface Ctx {
    params: Promise<{ id: string }>
}

interface Body {
    contactIds?: string[]
    email?: string
}

export async function POST(req: NextRequest, ctx: Ctx) {
    const { id: automationId } = await ctx.params
    return withApiKey<Body>(
        req,
        async (apiCtx, body) => {
            const automation = await getAutomation(apiCtx.workspaceId, automationId)
            if (!automation) return notFound()
            if (automation.workspaceId !== apiCtx.workspaceId) return forbidden()

            const allowReEnroll = automation.allowReEnroll ?? false

            // Build the enrollment list — contactIds + (email → resolved contactId or external)
            const enrollments: Array<{ contactId: string; contactEmail?: string }> = []

            for (const cId of body.contactIds ?? []) {
                enrollments.push({ contactId: cId })
            }

            if (body.email) {
                const email = body.email.trim().toLowerCase()
                if (!email.includes("@")) {
                    return badRequest("Invalid email")
                }
                const snap = await adminDb
                    .collection("contacts")
                    .where("workspaceId", "==", apiCtx.workspaceId)
                    .where("email", "==", email)
                    .limit(1)
                    .get()
                enrollments.push({
                    contactId: snap.empty ? "" : snap.docs[0].id,
                    contactEmail: email,
                })
            }

            if (enrollments.length === 0) {
                return badRequest("Provide contactIds[] and/or email")
            }

            let enrolled = 0
            let skipped = 0
            const runIds: string[] = []
            for (const e of enrollments) {
                if (e.contactId && !allowReEnroll) {
                    if (await isContactEnrolled(automationId, e.contactId)) {
                        skipped += 1
                        continue
                    }
                }
                const run = await startRun({
                    workspaceId: apiCtx.workspaceId,
                    automationId,
                    contactId: e.contactId,
                    contactEmail: e.contactEmail,
                    contextData: {
                        triggerType: "manual",
                        triggerMatch: {},
                        triggerPayload: { source: "api" },
                        triggeredAt: new Date().toISOString(),
                    },
                })
                advanceRun(run.id).catch(() => {})
                runIds.push(run.id)
                enrolled += 1
            }

            return ok({ enrolled, skipped, runIds })
        },
        { parseJson: true },
    )
}
