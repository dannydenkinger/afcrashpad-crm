"use server"

import { tenantDb } from "@/lib/tenant-db"
import { requireAuth } from "@/lib/auth-guard"

interface ExpenseData {
    description: string
    amount: number
    category: string
    date: string
    notes?: string
}

export async function getExpenses() {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snap = await db.collection("expenses").orderBy("date", "desc").limit(500).get()
        const data = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date || "",
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || "",
        }))

        return { success: true, data }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createExpense(data: ExpenseData) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const doc = await db.add("expenses", {
            ...data,
            createdBy: session.user.email,
            createdAt: new Date(),
        })

        return { success: true, id: doc.id }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateExpense(id: string, data: Partial<ExpenseData>) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc("expenses", id).update({
            ...data,
            updatedAt: new Date(),
            updatedBy: session.user.email,
        })

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteExpense(id: string) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        await db.doc("expenses", id).delete()
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
