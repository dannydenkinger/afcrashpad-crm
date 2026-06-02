"use server"

import { tenantDb } from "@/lib/tenant-db"
import { requireAdmin } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"

type ExportCollection = "contacts" | "opportunities" | "notes" | "tasks" | "email_templates" | "settings"

const COLLECTION_MAP: Record<ExportCollection, string> = {
    contacts: "contacts",
    opportunities: "opportunities",
    notes: "notes",
    tasks: "tasks",
    email_templates: "email_templates",
    settings: "settings",
}

async function fetchTenantCollection(db: ReturnType<typeof tenantDb>, collectionName: string): Promise<Record<string, any>[]> {
    const snapshot = await db.collection(collectionName).get()
    return snapshot.docs.map((doc) => {
        const data = doc.data()
        // Convert Firestore timestamps to ISO strings
        const serialized: Record<string, any> = { id: doc.id }
        for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === "object" && typeof value.toDate === "function") {
                serialized[key] = value.toDate().toISOString()
            } else {
                serialized[key] = value
            }
        }
        return serialized
    })
}

export async function exportAllData(): Promise<{ data: Record<string, any[]>; exportedAt: string }> {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    const result: Record<string, any[]> = {}

    for (const [key, collectionName] of Object.entries(COLLECTION_MAP)) {
        try {
            result[key] = await fetchTenantCollection(db, collectionName)
        } catch (err) {
            console.error(`Error exporting ${collectionName}:`, err)
            result[key] = []
        }
    }

    // Also export pipelines and stages
    try {
        result.pipelines = await fetchTenantCollection(db, "pipelines")
        // For each pipeline, fetch its stages subcollection
        for (const pipeline of result.pipelines) {
            const stagesSnap = await db.subcollection("pipelines", pipeline.id, "stages").orderBy("order").get()
            pipeline.stages = stagesSnap.docs.map((doc) => {
                const data = doc.data()
                const serialized: Record<string, any> = { id: doc.id }
                for (const [k, v] of Object.entries(data)) {
                    if (v && typeof v === "object" && typeof (v as any).toDate === "function") {
                        serialized[k] = (v as any).toDate().toISOString()
                    } else {
                        serialized[k] = v
                    }
                }
                return serialized
            })
        }
    } catch {
        result.pipelines = []
    }

    // Export custom fields
    try {
        result.custom_fields = await fetchTenantCollection(db, "custom_fields")
    } catch {
        result.custom_fields = []
    }

    logAudit(workspaceId, {
        userId: session.user.id || "",
        userEmail: session.user.email || "",
        userName: session.user.name || "",
        action: "export",
        entity: "backup",
        entityId: "all",
        entityName: "Full Data Export",
    }).catch(() => {})

    return {
        data: result,
        exportedAt: new Date().toISOString(),
    }
}

export async function exportSelectiveData(collections: ExportCollection[]): Promise<{ data: Record<string, any[]>; exportedAt: string }> {
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    const db = tenantDb(workspaceId)

    const result: Record<string, any[]> = {}

    for (const key of collections) {
        const collectionName = COLLECTION_MAP[key]
        if (!collectionName) continue
        try {
            result[key] = await fetchTenantCollection(db, collectionName)
        } catch (err) {
            console.error(`Error exporting ${collectionName}:`, err)
            result[key] = []
        }
    }

    logAudit(workspaceId, {
        userId: session.user.id || "",
        userEmail: session.user.email || "",
        userName: session.user.name || "",
        action: "export",
        entity: "backup",
        entityId: collections.join(","),
        entityName: `Selective Export: ${collections.join(", ")}`,
    }).catch(() => {})

    return {
        data: result,
        exportedAt: new Date().toISOString(),
    }
}
