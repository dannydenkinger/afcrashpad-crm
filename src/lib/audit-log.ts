import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

export async function logAudit(params: {
    action: string
    entity: string
    entityId: string
    userId: string
    userName?: string
    details?: Record<string, unknown>
}): Promise<void> {
    try {
        await adminDb.collection("audit_log").add({
            action: params.action,
            entity: params.entity,
            entityId: params.entityId,
            userId: params.userId,
            userName: params.userName || "",
            details: params.details || null,
            timestamp: new Date().toISOString(),
            createdAt: FieldValue.serverTimestamp(),
        })
    } catch (err) {
        console.error("Audit log write failed:", err)
    }
}
