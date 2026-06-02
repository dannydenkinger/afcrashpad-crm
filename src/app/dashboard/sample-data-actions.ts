"use server"

import { tenantDb } from "@/lib/tenant-db"
import { requireAuth } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"

/**
 * Seeds a workspace with example contacts, deals, and tasks so a brand-new
 * user has something to click around in instead of staring at empty
 * tables. Every record is tagged `__sample__` so we can wipe them all in
 * one batch when the user is done exploring.
 *
 * Idempotency: re-running stacks more sample data on top — call sites
 * should check `hasSampleData()` first to avoid that, or rely on the
 * "Already loaded" toast in the UI.
 */
const SAMPLE_TAG_NAME = "__sample__"

const SAMPLE_CONTACTS = [
    { name: "Jordan Avery", email: "jordan.avery@northwind.example", phone: "+1 555 0142", status: "Lead", businessName: "Northwind Coffee" },
    { name: "Riley Chen", email: "riley@kettle-co.example", phone: "+1 555 0188", status: "Prospect", businessName: "Kettle & Co" },
    { name: "Sam Patel", email: "spatel@brightline.example", phone: "+1 555 0214", status: "Active Client", businessName: "Brightline Studios" },
    { name: "Morgan Liu", email: "morgan@fern.example", phone: "+1 555 0335", status: "Lead", businessName: "Fern Architecture" },
    { name: "Taylor Brooks", email: "taylor@grovehq.example", phone: "+1 555 0451", status: "Past Client", businessName: "Grove HQ" },
    { name: "Avery Nakamura", email: "avery@haystack.example", phone: "+1 555 0517", status: "Lead", businessName: "Haystack Logistics" },
    { name: "Quinn Diaz", email: "qdiaz@orbitlabs.example", phone: "+1 555 0628", status: "Active Client", businessName: "Orbit Labs" },
    { name: "Jamie Park", email: "jamie@meridian.example", phone: "+1 555 0739", status: "Prospect", businessName: "Meridian Group" },
    { name: "Casey Reed", email: "casey@thicket.example", phone: "+1 555 0856", status: "Lead", businessName: "Thicket Roasters" },
    { name: "Drew Martinez", email: "drew@stoneside.example", phone: "+1 555 0931", status: "Past Client", businessName: "Stoneside Property" },
]

interface SampleDealSeed {
    /** Index into SAMPLE_CONTACTS — keeps the seed file readable. */
    contactIdx: number
    name: string
    /** Stage name (we'll resolve to a real stage from the workspace's first pipeline). */
    stageName: string
    value: number
    status?: "open" | "closed_won" | "closed_lost"
    daysAgo: number
}

const SAMPLE_DEALS: SampleDealSeed[] = [
    { contactIdx: 0, name: "Espresso machine refresh", stageName: "New Lead", value: 4_200, daysAgo: 2 },
    { contactIdx: 1, name: "Wholesale account renewal", stageName: "Qualified", value: 12_500, daysAgo: 9 },
    { contactIdx: 2, name: "Studio remodel", stageName: "Proposal Sent", value: 38_750, daysAgo: 14 },
    { contactIdx: 3, name: "Permit drawings", stageName: "Negotiation", value: 6_800, daysAgo: 21 },
    { contactIdx: 4, name: "Q3 retainer extension", stageName: "Closed Won", value: 24_000, status: "closed_won", daysAgo: 35 },
    { contactIdx: 6, name: "Onboarding implementation", stageName: "Contacted", value: 9_400, daysAgo: 4 },
    { contactIdx: 9, name: "Property listing package", stageName: "Closed Won", value: 18_900, status: "closed_won", daysAgo: 60 },
]

interface SampleTaskSeed {
    title: string
    contactIdx: number
    daysFromNow: number
    priority: "HIGH" | "MEDIUM" | "LOW"
    completed?: boolean
}

const SAMPLE_TASKS: SampleTaskSeed[] = [
    { title: "Follow up on espresso machine quote", contactIdx: 0, daysFromNow: 1, priority: "HIGH" },
    { title: "Send proposal recap email", contactIdx: 2, daysFromNow: 0, priority: "MEDIUM" },
    { title: "Confirm permit timeline", contactIdx: 3, daysFromNow: 3, priority: "MEDIUM" },
    { title: "Schedule kickoff call", contactIdx: 6, daysFromNow: 2, priority: "HIGH" },
    { title: "Send thank-you note", contactIdx: 4, daysFromNow: -2, priority: "LOW", completed: true },
]

export async function hasSampleData(): Promise<boolean> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)
        const tagSnap = await db.collection("tags").where("name", "==", SAMPLE_TAG_NAME).limit(1).get()
        return !tagSnap.empty
    } catch {
        return false
    }
}

export async function loadSampleData(): Promise<{ success: boolean; error?: string; counts?: { contacts: number; deals: number; tasks: number } }> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)
        const userId = session.user.id

        const now = new Date()

        // Tag every sample record so we can sweep them later. The tag itself
        // is a regular tag in the workspace; users can hide/show it.
        let sampleTagId: string
        const tagSnap = await db.collection("tags").where("name", "==", SAMPLE_TAG_NAME).limit(1).get()
        if (tagSnap.empty) {
            const tagRef = await db.add("tags", {
                name: SAMPLE_TAG_NAME,
                color: "#94a3b8",
                createdAt: now,
                updatedAt: now,
            })
            sampleTagId = tagRef.id
        } else {
            sampleTagId = tagSnap.docs[0].id
        }

        // Resolve the workspace's first pipeline + its stage map. Sample
        // deals reference stages by name; if a name doesn't exist (because
        // the workspace picked a non-Generic snapshot), fall back to the
        // first non-closed stage so deals still land somewhere reasonable.
        const pipelinesSnap = await db.collection("pipelines").orderBy("createdAt", "asc").limit(1).get()
        if (pipelinesSnap.empty) {
            return { success: false, error: "No pipeline found in this workspace. Apply an industry template first." }
        }
        const pipelineDoc = pipelinesSnap.docs[0]
        const stagesSnap = await db.subcollection("pipelines", pipelineDoc.id, "stages").orderBy("order", "asc").get()
        const stageByName: Record<string, string> = {}
        for (const s of stagesSnap.docs) {
            stageByName[(s.data().name as string) || ""] = s.id
        }
        const fallbackStageId = stagesSnap.docs[0]?.id

        // Create contacts in parallel
        const contactIds: string[] = []
        await Promise.all(SAMPLE_CONTACTS.map(async (c, idx) => {
            const ref = await db.add("contacts", {
                ...c,
                tags: [{ tagId: sampleTagId, name: SAMPLE_TAG_NAME, color: "#94a3b8" }],
                createdAt: now,
                updatedAt: now,
            })
            contactIds[idx] = ref.id
        }))

        // Create opportunities tied to those contacts
        await Promise.all(SAMPLE_DEALS.map(async (d) => {
            const stageId = stageByName[d.stageName] || fallbackStageId
            if (!stageId) return
            const createdAt = new Date(now.getTime() - d.daysAgo * 86400 * 1000)
            await db.add("opportunities", {
                contactId: contactIds[d.contactIdx],
                pipelineStageId: stageId,
                status: d.status || "open",
                name: d.name,
                opportunityValue: d.value,
                priority: "MEDIUM",
                assigneeId: userId,
                tags: [{ tagId: sampleTagId, name: SAMPLE_TAG_NAME, color: "#94a3b8" }],
                workspaceId,
                createdAt,
                updatedAt: createdAt,
            })
        }))

        // Create tasks
        await Promise.all(SAMPLE_TASKS.map(async (t) => {
            const dueDate = new Date(now.getTime() + t.daysFromNow * 86400 * 1000)
            await db.add("tasks", {
                title: t.title,
                contactId: contactIds[t.contactIdx],
                dueDate,
                priority: t.priority,
                completed: t.completed || false,
                assigneeId: userId,
                createdAt: now,
                updatedAt: now,
            })
        }))

        revalidatePath("/dashboard")
        revalidatePath("/contacts")
        revalidatePath("/pipeline")
        revalidatePath("/tasks")

        return {
            success: true,
            counts: {
                contacts: SAMPLE_CONTACTS.length,
                deals: SAMPLE_DEALS.length,
                tasks: SAMPLE_TASKS.length,
            },
        }
    } catch (error) {
        console.error("Failed to load sample data:", error)
        return { success: false, error: "Failed to load sample data" }
    }
}

export async function clearSampleData(): Promise<{ success: boolean; error?: string; deleted?: number }> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const tagSnap = await db.collection("tags").where("name", "==", SAMPLE_TAG_NAME).limit(1).get()
        if (tagSnap.empty) return { success: true, deleted: 0 }
        const sampleTagId = tagSnap.docs[0].id

        // Find every record carrying the sample tag. Firestore can't query
        // array-of-object membership directly, so we fetch and filter.
        const [contactsSnap, oppsSnap, tasksSnap] = await Promise.all([
            db.collection("contacts").get(),
            db.collection("opportunities").get(),
            db.collection("tasks").get(),
        ])

        const sampleContactIds = new Set<string>()
        const ops: Promise<unknown>[] = []
        let deleted = 0

        for (const doc of contactsSnap.docs) {
            const tags = doc.data().tags
            if (Array.isArray(tags) && tags.some((t) => t?.tagId === sampleTagId)) {
                sampleContactIds.add(doc.id)
                ops.push(doc.ref.delete())
                deleted++
            }
        }
        for (const doc of oppsSnap.docs) {
            const tags = doc.data().tags
            const taggedSample = Array.isArray(tags) && tags.some((t) => t?.tagId === sampleTagId)
            const ofSampleContact = sampleContactIds.has(doc.data().contactId)
            if (taggedSample || ofSampleContact) {
                ops.push(doc.ref.delete())
                deleted++
            }
        }
        for (const doc of tasksSnap.docs) {
            // Tasks aren't tagged directly; we delete tasks tied to sample contacts.
            if (sampleContactIds.has(doc.data().contactId)) {
                ops.push(doc.ref.delete())
                deleted++
            }
        }

        // Finally remove the sample tag itself
        ops.push(db.doc("tags", sampleTagId).delete())

        await Promise.all(ops)

        revalidatePath("/dashboard")
        revalidatePath("/contacts")
        revalidatePath("/pipeline")
        revalidatePath("/tasks")

        return { success: true, deleted }
    } catch (error) {
        console.error("Failed to clear sample data:", error)
        return { success: false, error: "Failed to clear sample data" }
    }
}
