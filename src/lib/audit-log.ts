import { tenantDb } from "@/lib/tenant-db"
import { FieldValue } from "firebase-admin/firestore"

export async function logAudit(workspaceId: string, params: {
    action: string
    entity: string
    entityId: string
    userId: string
    userName?: string
    details?: Record<string, unknown>
}): Promise<void> {
    try {
        const db = tenantDb(workspaceId)
        await db.add("audit_log", {
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
