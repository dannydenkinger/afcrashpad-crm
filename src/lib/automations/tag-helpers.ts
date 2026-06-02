import { adminDb } from "@/lib/firebase-admin"
import { tenantDb } from "@/lib/tenant-db"
import { fireTrigger } from "./triggers"

export async function addTagToContactByName(
    workspaceId: string,
    contactId: string,
    tagName: string,
): Promise<void> {
    const trimmed = tagName.trim()
    if (!trimmed) return

    const db = tenantDb(workspaceId)

    const tagSnap = await db.collection("tags").where("name", "==", trimmed).limit(1).get()
    let tagId: string
    let color: string
    if (tagSnap.empty) {
        const ref = await db.add("tags", {
            name: trimmed,
            color: "#94a3b8",
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        tagId = ref.id
        color = "#94a3b8"
    } else {
        tagId = tagSnap.docs[0].id
        color = (tagSnap.docs[0].data().color as string) || "#94a3b8"
    }

    const contactRef = adminDb.collection("contacts").doc(contactId)
    const contactSnap = await contactRef.get()
    if (!contactSnap.exists) return
    const existing = (contactSnap.data()?.tags as Array<{ tagId?: string }> | undefined) || []
    if (existing.some((t) => t?.tagId === tagId)) return

    await contactRef.update({
        tags: [...existing, { tagId, name: trimmed, color }],
        updatedAt: new Date(),
    })

    fireTrigger({
        workspaceId,
        type: "tag_added",
        contactId,
        match: { tagId },
    }).catch(() => {})
}
