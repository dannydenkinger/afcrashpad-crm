"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"
import type { ScheduledReport } from "./types"

export async function getScheduledReports(): Promise<{ success: boolean; reports?: ScheduledReport[]; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user?.email) return { success: false, error: "Unauthorized" }

        const snap = await adminDb.collection("scheduled_reports").orderBy("createdAt", "desc").get()
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
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        const session = await auth()
        if (!session?.user?.email) return { success: false, error: "Unauthorized" }

        const usersSnap = await adminDb.collection("users").where("email", "==", session.user.email).limit(1).get()
        if (usersSnap.empty) return { success: false, error: "User not found" }

        const ref = await adminDb.collection("scheduled_reports").add({
            userId: usersSnap.docs[0].id,
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
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection("scheduled_reports").doc(id).update({
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
    try {
        await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    try {
        await adminDb.collection("scheduled_reports").doc(id).delete()
        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete scheduled report:", error)
        return { success: false, error: "Failed to delete scheduled report" }
    }
}
