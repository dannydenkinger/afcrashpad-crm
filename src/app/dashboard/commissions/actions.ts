"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/audit"
import type { CommissionEntry, CommissionSummary, CommissionsData } from "./types"

export async function getCommissionsData(): Promise<{ success: boolean; data?: CommissionsData; error?: string }> {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    try {
        const [commissionsSnap, settingsDoc] = await Promise.all([
            adminDb.collection("commissions").orderBy("earnedAt", "desc").get(),
            adminDb.collection("settings").doc("commissions").get(),
        ])

        const defaultRate = settingsDoc.exists ? (settingsDoc.data()?.defaultRate ?? 10) : 10

        const entries: CommissionEntry[] = commissionsSnap.docs.map(doc => {
            const d = doc.data()
            const toISO = (v: any) => {
                if (!v) return null
                if (typeof v === "string") return v
                if (v.toDate) return v.toDate().toISOString()
                if (typeof v === "object" && typeof v._seconds === "number") return new Date(v._seconds * 1000).toISOString()
                return null
            }
            return {
                id: doc.id,
                opportunityId: d.opportunityId || "",
                dealName: d.dealName || "Unknown Deal",
                contactName: d.contactName || "Unknown",
                base: d.base || null,
                agentId: d.agentId || "",
                agentName: d.agentName || "Unknown",
                dealValue: Number(d.dealValue) || 0,
                commissionRate: Number(d.commissionRate) || defaultRate,
                commissionAmount: Number(d.commissionAmount) || 0,
                status: d.status === "paid" ? "paid" : "earned",
                paidAt: toISO(d.paidAt),
                earnedAt: toISO(d.earnedAt) || toISO(d.createdAt) || new Date().toISOString(),
                createdAt: toISO(d.createdAt) || new Date().toISOString(),
            }
        })

        // Summaries per agent
        const agentMap: Record<string, CommissionSummary> = {}
        for (const e of entries) {
            if (!agentMap[e.agentId]) {
                agentMap[e.agentId] = {
                    agentId: e.agentId,
                    agentName: e.agentName,
                    totalEarned: 0,
                    totalPaid: 0,
                    totalPending: 0,
                    dealCount: 0,
                }
            }
            const s = agentMap[e.agentId]
            s.totalEarned += e.commissionAmount
            s.dealCount++
            if (e.status === "paid") {
                s.totalPaid += e.commissionAmount
            } else {
                s.totalPending += e.commissionAmount
            }
        }

        const summaries = Object.values(agentMap).sort((a, b) => b.totalEarned - a.totalEarned)

        const totalEarned = entries.reduce((s, e) => s + e.commissionAmount, 0)
        const totalPaid = entries.filter(e => e.status === "paid").reduce((s, e) => s + e.commissionAmount, 0)
        const totalPending = totalEarned - totalPaid

        return {
            success: true,
            data: { entries, summaries, defaultRate, totalEarned, totalPaid, totalPending },
        }
    } catch (error) {
        console.error("Commissions data error:", error)
        return { success: false, error: "Failed to fetch commissions data" }
    }
}

export async function recordCommission(opportunityId: string, agentId: string) {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    try {
        // Get opportunity data
        const oppDoc = await adminDb.collection("opportunities").doc(opportunityId).get()
        if (!oppDoc.exists) return { success: false, error: "Opportunity not found" }

        const oppData = oppDoc.data()!
        const contactId = oppData.contactId

        // Get contact name
        let contactName = "Unknown"
        if (contactId) {
            const contactDoc = await adminDb.collection("contacts").doc(contactId).get()
            if (contactDoc.exists) contactName = contactDoc.data()?.name || "Unknown"
        }

        // Get agent name
        const agentDoc = await adminDb.collection("users").doc(agentId).get()
        const agentName = agentDoc.exists ? agentDoc.data()?.name || "Unknown" : "Unknown"

        // Get commission rate
        const settingsDoc = await adminDb.collection("settings").doc("commissions").get()
        const defaultRate = settingsDoc.exists ? (settingsDoc.data()?.defaultRate ?? 10) : 10

        // Check for agent-specific rate
        const agentRatesDoc = await adminDb.collection("settings").doc("commission_rates").get()
        const agentRates = agentRatesDoc.exists ? agentRatesDoc.data() || {} : {}
        const rate = agentRates[agentId] ?? defaultRate

        const dealValue = Number(oppData.opportunityValue) || 0
        const commissionAmount = Math.round((dealValue * rate) / 100 * 100) / 100

        // Check if already recorded
        const existing = await adminDb.collection("commissions")
            .where("opportunityId", "==", opportunityId)
            .where("agentId", "==", agentId)
            .limit(1)
            .get()

        if (!existing.empty) {
            return { success: false, error: "Commission already recorded for this deal and agent" }
        }

        await adminDb.collection("commissions").add({
            opportunityId,
            dealName: oppData.name || `${contactName}'s Deal`,
            contactName,
            base: oppData.militaryBase || null,
            agentId,
            agentName,
            dealValue,
            commissionRate: rate,
            commissionAmount,
            status: "earned",
            paidAt: null,
            earnedAt: new Date(),
            createdAt: new Date(),
        })

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "commission",
            entityId: opportunityId,
            entityName: `${agentName} - ${contactName}`,
        }).catch(() => {})

        revalidatePath("/dashboard")
        return { success: true }
    } catch (error) {
        console.error("Record commission error:", error)
        return { success: false, error: "Failed to record commission" }
    }
}

export async function markCommissionPaid(commissionId: string) {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    try {
        await adminDb.collection("commissions").doc(commissionId).update({
            status: "paid",
            paidAt: new Date(),
        })

        revalidatePath("/dashboard")
        return { success: true }
    } catch (error) {
        console.error("Mark commission paid error:", error)
        return { success: false, error: "Failed to mark commission as paid" }
    }
}

export async function updateDefaultCommissionRate(rate: number) {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    try {
        await adminDb.collection("settings").doc("commissions").set(
            { defaultRate: rate, updatedAt: new Date() },
            { merge: true }
        )

        revalidatePath("/dashboard")
        return { success: true }
    } catch (error) {
        console.error("Update commission rate error:", error)
        return { success: false, error: "Failed to update rate" }
    }
}

export async function updateAgentCommissionRate(agentId: string, rate: number) {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    try {
        await adminDb.collection("settings").doc("commission_rates").set(
            { [agentId]: rate, updatedAt: new Date() },
            { merge: true }
        )

        revalidatePath("/dashboard")
        return { success: true }
    } catch (error) {
        console.error("Update agent commission rate error:", error)
        return { success: false, error: "Failed to update agent rate" }
    }
}
