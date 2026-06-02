"use server"

import { tenantDb } from "@/lib/tenant-db"
import { revalidatePath } from "next/cache"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"
import type { ScheduledReport } from "./types"

export async function getScheduledReports(): Promise<{ success: boolean; reports?: ScheduledReport[]; error?: string }> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snap = await db.collection("scheduled_reports").orderBy("createdAt", "desc").get()
        const reports: ScheduledReport[] = snap.docs.map(doc => {
            const data = doc.data()
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || null)
            const lastSentAt = data.lastSentAt?.toDate ? data.lastSentAt.toDate().toISOString() : (data.lastSentAt || null)
            return {
                id: doc.id,
                userId: data.userId || "",
                frequency: data.frequency || "weekly",
                recipients: data.recipients || [],
                reportType: data.reportType || "pipeline_summary",
                enabled: data.enabled ?? true,
                lastSentAt,
                createdAt,
            }
        })
        return { success: true, reports }
    } catch (error) {
        console.error("Failed to get scheduled reports:", error)
        return { success: false, error: "Failed to get scheduled reports" }
    }
}

export async function createScheduledReport(data: {
    frequency: string
    recipients: string[]
    reportType: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const ref = await db.add("scheduled_reports", {
            userId: session.user.id || "",
            frequency: data.frequency,
            recipients: data.recipients,
            reportType: data.reportType,
            enabled: true,
            lastSentAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        revalidatePath("/settings")
        return { success: true, id: ref.id }
    } catch (error) {
        console.error("Failed to create scheduled report:", error)
        return { success: false, error: "Failed to create scheduled report" }
    }
}

export async function updateScheduledReport(
    id: string,
    updates: {
        frequency?: string
        recipients?: string[]
        reportType?: string
        enabled?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc("scheduled_reports", id).update({
            ...updates,
            updatedAt: new Date(),
        })

        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to update scheduled report:", error)
        return { success: false, error: "Failed to update scheduled report" }
    }
}

export async function deleteScheduledReport(id: string): Promise<{ success: boolean; error?: string }> {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc("scheduled_reports", id).delete()
        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete scheduled report:", error)
        return { success: false, error: "Failed to delete scheduled report" }
    }
}
