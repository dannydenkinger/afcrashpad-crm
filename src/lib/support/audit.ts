import "server-only"
import { adminDb } from "@/lib/firebase-admin"

export interface LogSupportActionInput {
    grantId: string
    workspaceId: string
    agentUserId: string
    agentEmail: string
    action: "session_start" | "session_end" | "mutation" | "view"
    entity?: string
    entityId?: string
    method?: string
    path?: string
    ip?: string | null
    userAgent?: string | null
}

/**
 * Append an entry to support_audit_log. Fire-and-forget — failure to
 * log shouldn't break the request.
 */
export async function logSupportAction(input: LogSupportActionInput): Promise<void> {
    try {
        await adminDb.collection("support_audit_log").add({
            grantId: input.grantId,
            workspaceId: input.workspaceId,
            agentUserId: input.agentUserId,
            agentEmail: input.agentEmail,
            action: input.action,
            entity: input.entity ?? null,
            entityId: input.entityId ?? null,
            method: input.method ?? null,
            path: input.path ?? null,
            ip: input.ip ?? null,
            userAgent: input.userAgent ?? null,
            at: new Date(),
        })
    } catch {
        // Best effort.
    }
}

export interface AuditLogEntry {
    id: string
    grantId: string
    workspaceId: string
    agentEmail: string
    action: string
    entity: string | null
    entityId: string | null
    method: string | null
    path: string | null
    at: string | null
}

function toIso(ts: unknown): string | null {
    if (!ts) return null
    if (typeof ts === "string") return ts
    if (ts instanceof Date) return ts.toISOString()
    const t = ts as { toDate?: () => Date }
    if (typeof t.toDate === "function") return t.toDate().toISOString()
    return null
}

export async function listSupportAuditForWorkspace(
    workspaceId: string,
    limit = 100,
): Promise<AuditLogEntry[]> {
    try {
        const snap = await adminDb
            .collection("support_audit_log")
            .where("workspaceId", "==", workspaceId)
            .orderBy("at", "desc")
            .limit(limit)
            .get()
        return snap.docs.map((d) => {
            const data = d.data()
            return {
                id: d.id,
                grantId: (data.grantId as string) || "",
                workspaceId: (data.workspaceId as string) || "",
                agentEmail: (data.agentEmail as string) || "",
                action: (data.action as string) || "",
                entity: (data.entity as string) || null,
                entityId: (data.entityId as string) || null,
                method: (data.method as string) || null,
                path: (data.path as string) || null,
                at: toIso(data.at),
            }
        })
    } catch {
        return []
    }
}
