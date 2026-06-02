import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import { sendTrackedEmail } from "@/lib/email"
import { triggerSequence } from "@/lib/email-sequences"
import { fireTrigger } from "@/lib/automations/triggers"
import { determineAssignee } from "@/lib/auto-assign"

function normalizeDateToYmd(input: unknown): string | null {
    if (!input) return null
    const s = String(input).trim()
    if (!s) return null
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) return s
    const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (usMatch) {
        return `${usMatch[3]}-${String(Number(usMatch[1])).padStart(2, '0')}-${String(Number(usMatch[2])).padStart(2, '0')}`
    }
    const d = new Date(s)
    if (isNaN(d.getTime())) return null
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params

        // Rate limit
        const { allowed } = rateLimit(getRateLimitKey(request, "form-submit"), 30)
        if (!allowed) {
            return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
        }

        // Fetch form config
        const formDoc = await adminDb.collection("lead_forms").doc(formId).get()
        if (!formDoc.exists) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 })
        }
        const formData = formDoc.data()!
        if (formData.status !== "active") {
            return NextResponse.json({ error: "Form is inactive" }, { status: 400 })
        }

        const workspaceId = formData.workspaceId
        const db = tenantDb(workspaceId)
        const payload = await request.json()

        // Honeypot spam check — if the hidden "website" field has a value, it's a bot
        if (payload.website || payload.__honeypot) {
            return NextResponse.json({ success: true, message: "Form submitted successfully" })
        }

        // Submission cooldown check
        if (formData.spamProtection?.submissionCooldownMinutes && payload.email) {
            const cooldownMs = formData.spamProtection.submissionCooldownMinutes * 60 * 1000
            const recentSnap = await db.collection("contacts")
                .where("email", "==", payload.email)
                .limit(1)
                .get()
            if (!recentSnap.empty) {
                const lastUpdate = recentSnap.docs[0].data().updatedAt
                if (lastUpdate) {
                    const lastTime = lastUpdate.toDate ? lastUpdate.toDate().getTime() : new Date(lastUpdate).getTime()
                    if (Date.now() - lastTime < cooldownMs) {
                        return NextResponse.json({ error: "Please wait before submitting again" }, { status: 429 })
                    }
                }
            }
        }

        // Validate required fields
        for (const field of formData.fields || []) {
            if (field.required && field.type !== "header" && field.type !== "hidden") {
                const val = payload[field.label?.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")] ||
                    (field.type === "email" && payload.email) ||
                    (field.type === "phone" && payload.phone) ||
                    (field.label.toLowerCase().includes("name") && payload.name)
                if (!val || (typeof val === "string" && !val.trim())) {
                    return NextResponse.json({ error: `${field.label} is required` }, { status: 400 })
                }
            }
        }

        // Require email
        if (!payload.email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 })
        }

        // Normalize
        const email = payload.email
        const name = payload.name || "Website Lead"
        const phone = payload.phone || null
        const notes = payload.message || payload.notes || null

        // Collect extra fields
        const knownKeys = new Set(["email", "name", "phone", "message", "notes"])
        const extraFields: Record<string, string> = {}
        for (const [key, val] of Object.entries(payload)) {
            if (!knownKeys.has(key) && val && String(val).trim()) {
                extraFields[key] = String(val).trim()
            }
        }

        // Find or create contact
        let contactId: string
        const existing = await db.collection("contacts").where("email", "==", email).limit(1).get()

        if (existing.empty) {
            const contactRef = await db.add("contacts", {
                name,
                email,
                phone,
                status: "Lead",
                source: `form:${formData.name}`,
                ...(Object.keys(extraFields).length > 0 && { customFormFields: extraFields }),
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            contactId = contactRef.id

            triggerSequence(workspaceId, "new_contact", contactId, email, name, {}).catch(() => {})
        } else {
            contactId = existing.docs[0].id
            await db.doc("contacts", contactId).update({
                name: name || existing.docs[0].data().name,
                phone: phone || existing.docs[0].data().phone,
                updatedAt: new Date(),
            })
        }

        // Create opportunity in default pipeline
        let opportunityId: string | null = null
        const pipelinesSnap = await db.collection("pipelines").get()
        const sortedPipelines = pipelinesSnap.docs.sort((a, b) => {
            const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0
            const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0
            return aTime - bTime
        })

        if (sortedPipelines.length > 0) {
            const defaultPipeline = sortedPipelines[0]
            const stagesSnap = await db.subcollection("pipelines", defaultPipeline.id, "stages").orderBy("order", "asc").get()
            if (!stagesSnap.empty) {
                const stages = stagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                const targetStage = stages.find((s: any) =>
                    s.name.toLowerCase().includes("new lead") || s.name.toLowerCase().includes("inquiry")
                ) || stages[0]

                // Build notes from all fields
                const noteParts: string[] = []
                if (notes) noteParts.push(`Message: ${notes}`)
                for (const [key, val] of Object.entries(extraFields)) {
                    const label = key.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
                    noteParts.push(`${label}: ${val}`)
                }
                const sharedNotes = noteParts.length > 0 ? `Form: ${formData.name}\n${noteParts.join("\n")}` : `Form: ${formData.name}`

                const oppRef = await db.add("opportunities", {
                    contactId,
                    pipelineStageId: targetStage.id,
                    name: `${name} - ${formData.name}`,
                    priority: "MEDIUM",
                    opportunityValue: 0,
                    source: "form",
                    formId,
                    formName: formData.name,
                    notes: sharedNotes,
                    unread: true,
                    unreadAt: new Date(),
                    lastSeenAt: null,
                    lastSeenBy: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })
                opportunityId = oppRef.id

                // Auto-assign
                try {
                    const assignee = await determineAssignee(workspaceId, {
                        leadSource: "form",
                        source: "form",
                        base: null,
                    })
                    if (assignee) {
                        await oppRef.update({
                            assignedTo: assignee.userId,
                            assignedToName: assignee.userName,
                        })
                    }
                } catch {}

                // Contact note
                if (sharedNotes) {
                    await db.addToSubcollection("contacts", contactId, "notes", {
                        content: sharedNotes,
                        contactId,
                        opportunityId: oppRef.id,
                        source: "form",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })
                }
            }
        }

        // Notification
        try {
            await db.add("notifications", {
                title: `New Lead from ${formData.name}`,
                message: `${name} submitted the ${formData.name} form`,
                type: "opportunity",
                linkUrl: opportunityId ? `/pipeline?deal=${opportunityId}` : "/contacts",
                read: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
        } catch {}

        // Increment submission count
        await adminDb.collection("lead_forms").doc(formId).update({
            submissionCount: (formData.submissionCount || 0) + 1,
        })

        // Admin email notification
        if (formData.notifications?.adminEmailEnabled && formData.notifications.adminEmailAddresses?.length) {
            try {
                const { sendEmail } = await import("@/lib/email")
                const { captureError } = await import("@/lib/error-tracking")
                const fieldSummary = Object.entries(payload)
                    .filter(([k]) => !["website", "__honeypot"].includes(k))
                    .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:600;vertical-align:top;white-space:nowrap;">${k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</td><td style="padding:6px 12px;">${String(v)}</td></tr>`)
                    .join("")
                const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><h2 style="margin-bottom:16px;">New submission: ${formData.name}</h2><table style="width:100%;border-collapse:collapse;font-size:14px;">${fieldSummary}</table></div>`
                for (const addr of formData.notifications.adminEmailAddresses) {
                    sendEmail({ to: addr, subject: `New lead from ${formData.name}`, html }).catch((err) => {
                        console.error(`[FORM-SUBMIT] admin notification to ${addr} failed:`, err)
                        captureError(err, { scope: "form-admin-notification", formId, recipient: addr })
                    })
                }
            } catch (err) {
                console.error("[FORM-SUBMIT] admin notification setup failed:", err)
            }
        }

        // Autoresponder email
        if (formData.notifications?.autoresponderEnabled && payload.email) {
            try {
                const { sendEmail } = await import("@/lib/email")
                const { captureError } = await import("@/lib/error-tracking")
                let subject = formData.notifications.autoresponderSubject || "Thank you for your submission"
                let body = formData.notifications.autoresponderBody || "We've received your message and will be in touch soon."
                const replaceTags = (str: string) => str
                    .replace(/\{\{name\}\}/g, name || "")
                    .replace(/\{\{email\}\}/g, email || "")
                    .replace(/\{\{phone\}\}/g, phone || "")
                    .replace(/\{\{form_name\}\}/g, formData.name || "")
                subject = replaceTags(subject)
                body = replaceTags(body)
                const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">${body.replace(/\n/g, "<br>")}</div>`
                sendEmail({ to: payload.email, subject, html }).catch((err) => {
                    console.error(`[FORM-SUBMIT] autoresponder to ${payload.email} failed:`, err)
                    captureError(err, { scope: "form-autoresponder", formId, recipient: payload.email })
                })
            } catch (err) {
                console.error("[FORM-SUBMIT] autoresponder setup failed:", err)
            }
        }

        // Fire unified-engine "form_submitted" trigger so any matching
        // automation can pick up the lead (welcome series, lead notification, etc.)
        fireTrigger({
            workspaceId,
            type: "form_submitted",
            contactId,
            contactEmail: payload.email,
            match: { formId },
            payload: { name: payload.name, opportunityId: opportunityId ?? null },
        }).catch(() => {})

        return NextResponse.json({
            success: true,
            message: "Form submitted successfully",
            contactId,
            opportunityId,
        })
    } catch (error: any) {
        console.error("[FORM-SUBMIT] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
