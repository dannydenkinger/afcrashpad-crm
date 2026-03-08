"use server"

import { adminDb } from "@/lib/firebase-admin"
import { requireAdmin } from "@/lib/auth-guard"

export async function getAuditLog(filters?: {
    entity?: string
    userId?: string
    limit?: number
    startAfter?: string
}) {
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        let query = adminDb.collection("audit_log").orderBy("createdAt", "desc") as FirebaseFirestore.Query

        if (filters?.entity) {
            query = query.where("entity", "==", filters.entity)
        }
        if (filters?.userId) {
            query = query.where("userId", "==", filters.userId)
        }
        if (filters?.startAfter) {
            query = query.startAfter(new Date(filters.startAfter))
        }

        const limit = filters?.limit || 50
        const snap = await query.limit(limit).get()

        const entries = snap.docs.map(doc => {
            const d = doc.data()
            const createdAt = d.createdAt?.toDate
                ? d.createdAt.toDate().toISOString()
                : d.createdAt instanceof Date
                    ? d.createdAt.toISOString()
                    : String(d.createdAt || "")

            return {
                id: doc.id,
                userId: d.userId || "",
                userEmail: d.userEmail || "",
                userName: d.userName || "",
                action: d.action || "",
                entity: d.entity || "",
                entityId: d.entityId || "",
                entityName: d.entityName || "",
                changes: d.changes || null,
                metadata: d.metadata || null,
                createdAt,
            }
        })

        return { success: true, entries }
    } catch (error) {
        console.error("Failed to fetch audit log:", error)
        return { success: false, error: "Failed to fetch audit log" }
    }
}
