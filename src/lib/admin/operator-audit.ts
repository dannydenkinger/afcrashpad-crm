import "server-only"
import { adminDb } from "@/lib/firebase-admin"

export interface OperatorAuditEntry {
    id: string
    operatorEmail: string
    workspaceId: string
    action: string
    params: Record<string, unknown>
    at: string | null
}

export async function logOperatorAction(input: {
    operatorEmail: string
    workspaceId: string
    action: string
    params?: Record<string, unknown>
}): Promise<void> {
    try {
        await adminDb.collection("operator_audit_log").add({
            operatorEmail: input.operatorEmail,
            workspaceId: input.workspaceId,
            action: input.action,
            params: input.params ?? {},
            at: new Date(),
        })
    } catch {
        // best effort
    }
}

function toIso(ts: unknown): string | null {
    if (!ts) return null
    if (typeof ts === "string") return ts
    if (ts instanceof Date) return ts.toISOString()
    const t = ts as { toDate?: () => Date }
    if (typeof t.toDate === "function") return t.toDate().toISOString()
    return null
}

export async function listOperatorAuditForWorkspace(
    workspaceId: string,
    limit = 50,
): Promise<OperatorAuditEntry[]> {
    try {
        const snap = await adminDb
            .collection("operator_audit_log")
            .where("workspaceId", "==", workspaceId)
            .orderBy("at", "desc")
            .limit(limit)
            .get()
        return snap.docs.map((d) => {
            const data = d.data()
            return {
                id: d.id,
                operatorEmail: (data.operatorEmail as string) || "",
                workspaceId: (data.workspaceId as string) || "",
                action: (data.action as string) || "",
                params: (data.params as Record<string, unknown>) || {},
                at: toIso(data.at),
            }
        })
    } catch {
        return []
    }
}
