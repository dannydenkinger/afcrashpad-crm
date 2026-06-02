import { tenantDb } from "@/lib/tenant-db"

export type AuditAction = "create" | "update" | "delete" | "export" | "settings_change" | "stage_move" | "claim" | "bulk_delete" | "bulk_move" | "bulk_assign"

export interface AuditEntry {
    userId: string
    userEmail: string
    userName: string
    action: AuditAction
    entity: string
    entityId: string
    entityName?: string
    changes?: Record<string, { from: unknown; to: unknown }> | null
    metadata?: Record<string, unknown> | null
}

export async function logAudit(workspaceId: string, params: AuditEntry) {
    try {
        const db = tenantDb(workspaceId)
        await db.add("audit_log", {
            ...params,
            entityName: params.entityName || "",
            changes: params.changes || null,
            metadata: params.metadata || null,
            createdAt: new Date(),
        })
    } catch (err) {
        console.error("Audit log write failed:", err)
    }
}

export function diffChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    fields: string[]
): Record<string, { from: unknown; to: unknown }> | null {
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    for (const field of fields) {
        if (after[field] !== undefined && JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
            changes[field] = { from: before[field] ?? null, to: after[field] }
        }
    }
    return Object.keys(changes).length > 0 ? changes : null
}
