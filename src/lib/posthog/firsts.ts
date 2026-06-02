import "server-only"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import { track } from "./server"
import type { VestaEvent } from "./events"

/**
 * Fire a "first time this happened in this workspace" event exactly
 * once, ever. Uses a Firestore transaction on the workspace doc so
 * concurrent calls can't both fire — only the first writer sees the
 * field as unset and gets to set it + capture the event.
 *
 * The flag lives at `workspaces/<id>.firsts.<key>` (an ISO timestamp).
 *
 * Pass the event you'd like to capture. Distinct id is the userId who
 * triggered it. Returns `true` if this was the first occurrence.
 */
export async function trackFirstForWorkspace(input: {
    workspaceId: string
    userId: string
    key: string
    event: VestaEvent
}): Promise<boolean> {
    const { workspaceId, userId, key, event } = input
    if (!workspaceId || !userId) return false

    const wsRef = adminDb.collection("workspaces").doc(workspaceId)
    let didFire = false
    try {
        await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(wsRef)
            const firsts = (snap.data()?.firsts as Record<string, unknown> | undefined) ?? {}
            if (firsts[key]) return
            tx.update(wsRef, {
                [`firsts.${key}`]: FieldValue.serverTimestamp(),
            })
            didFire = true
        })
    } catch {
        return false
    }

    if (didFire) {
        await track({ event, distinctId: userId, workspaceId })
    }
    return didFire
}
