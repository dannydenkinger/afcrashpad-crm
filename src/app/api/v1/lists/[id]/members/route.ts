/**
 * POST /api/v1/lists/{id}/members
 *
 * Add CRM contacts to a list. Body: { contactIds: string[] }
 * Honors the existing addContactsToList logic (idempotent, dedupe).
 *
 * Note: external CSV-style emails go through a different endpoint
 * (importEmailsToListAction in app actions); this v1 route is for
 * machine-to-machine integration scenarios where contacts already exist.
 */

import { NextRequest } from "next/server"
import {
    addContactsToList,
    addEmailsToList,
} from "@/lib/lists/contact-lists"
import { fireTrigger } from "@/lib/automations/triggers"
import { badRequest, ok, withApiKey } from "@/lib/api/v1"

export const dynamic = "force-dynamic"

interface Ctx {
    params: Promise<{ id: string }>
}

interface Body {
    contactIds?: string[]
    /** External emails to add as list-only (no CRM contact created) */
    emails?: Array<{ email: string; name?: string }>
}

export async function POST(req: NextRequest, ctx: Ctx) {
    const { id } = await ctx.params
    return withApiKey<Body>(
        req,
        async (apiCtx, body) => {
            const contactIds = Array.isArray(body.contactIds) ? body.contactIds : []
            const emails = Array.isArray(body.emails) ? body.emails : []

            if (contactIds.length === 0 && emails.length === 0) {
                return badRequest("Provide contactIds[] and/or emails[]")
            }

            let crmAdded = 0
            let crmAlreadyPresent = 0
            let externalAdded = 0
            let externalAlreadyPresent = 0
            let externalInvalid = 0

            if (contactIds.length > 0) {
                const r = await addContactsToList(
                    apiCtx.workspaceId,
                    id,
                    contactIds,
                )
                crmAdded = r.added
                crmAlreadyPresent = r.alreadyPresent
                // Fire trigger for each newly added
                for (const cId of contactIds) {
                    fireTrigger({
                        workspaceId: apiCtx.workspaceId,
                        type: "contact_added_to_list",
                        contactId: cId,
                        match: { listId: id },
                    }).catch(() => {})
                }
            }

            if (emails.length > 0) {
                const r = await addEmailsToList(apiCtx.workspaceId, id, emails)
                externalAdded = r.added
                externalAlreadyPresent = r.alreadyPresent
                externalInvalid = r.invalid
            }

            return ok({
                contactsAdded: crmAdded,
                contactsAlreadyPresent: crmAlreadyPresent,
                externalEmailsAdded: externalAdded,
                externalEmailsAlreadyPresent: externalAlreadyPresent,
                externalEmailsInvalid: externalInvalid,
            })
        },
        { parseJson: true },
    )
}
