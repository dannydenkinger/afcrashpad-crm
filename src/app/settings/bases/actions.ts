"use server"

import { tenantDb } from "@/lib/tenant-db"
import { revalidatePath } from "next/cache"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"

/**
 * Military bases admin (AFCrashpad). Each base lives in the `military_bases`
 * collection with `name` + `zipCode`, plus a `periods` subcollection holding
 * seasonal lodging rates ({ startDate, endDate, rate }).
 *
 * Everything is tenant-scoped via tenantDb(workspaceId) and admin-gated, and
 * mutations revalidate `/pipeline` (where base names drive the deal pickers
 * via getBaseNames()).
 *
 * NOTE on batches + tenant isolation: Firestore batch writes bypass the
 * tenantDb proxy's ownership pre-check (the SDK applies them via the ref's
 * internal path). So before touching an existing base in a batch we gate on
 * db.getOwned('military_bases', id). New base docs get workspaceId stamped, and
 * each period doc is stamped too so collectionGroup('periods') stays scoped.
 */

export interface BasePeriod {
    id?: string
    startDate: string
    endDate: string
    rate: number
}

export interface Base {
    id: string
    name: string
    zipCode: string
    periods: BasePeriod[]
}

function toDateStr(val: unknown): string {
    if (!val) return ""
    if (typeof val === "string") return val
    if (val instanceof Date) return val.toISOString().split("T")[0]
    if (typeof (val as any).toDate === "function") return (val as any).toDate().toISOString().split("T")[0]
    return ""
}

function normalizePeriods(periods: BasePeriod[] | undefined): { startDate: string; endDate: string; rate: number }[] {
    if (!Array.isArray(periods)) return []
    return periods
        .map((p) => ({
            startDate: typeof p.startDate === "string" ? p.startDate : "",
            endDate: typeof p.endDate === "string" ? p.endDate : "",
            rate: Number(p.rate) || 0,
        }))
        .filter((p) => p.startDate || p.endDate || p.rate)
}

export async function getBases() {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        const snapshot = await db.collection("military_bases").orderBy("name", "asc").get()
        const bases: Base[] = []

        for (const doc of snapshot.docs) {
            const data = doc.data()
            const periodsSnap = await doc.ref.collection("periods").orderBy("startDate", "asc").get()
            const periods: BasePeriod[] = periodsSnap.docs.map((pDoc) => {
                const pData = pDoc.data()
                return {
                    id: pDoc.id,
                    startDate: toDateStr(pData.startDate),
                    endDate: toDateStr(pData.endDate),
                    rate: Number(pData.rate) || 0,
                }
            })

            bases.push({
                id: doc.id,
                name: data.name || "",
                zipCode: data.zipCode || "",
                periods,
            })
        }

        return { success: true, bases }
    } catch (error) {
        console.error("Failed to fetch bases:", error)
        return { success: false, bases: [] as Base[], error: "Failed to fetch bases" }
    }
}

export async function createBase(data: { name: string; zipCode: string; periods: BasePeriod[] }) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    if (!data.name?.trim()) return { success: false, error: "Base name is required" }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        // Name-uniqueness within the workspace.
        const existing = await db.collection("military_bases").where("name", "==", data.name.trim()).limit(1).get()
        if (!existing.empty) {
            return { success: false, error: "A base with this name already exists." }
        }

        const baseRef = db.collectionRef("military_bases").doc()
        const batch = db.batch()

        batch.set(baseRef, {
            name: data.name.trim(),
            zipCode: data.zipCode?.trim() || "",
            workspaceId,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        for (const period of normalizePeriods(data.periods)) {
            const periodRef = baseRef.collection("periods").doc()
            batch.set(periodRef, { ...period, workspaceId })
        }

        await batch.commit()

        revalidatePath("/settings")
        revalidatePath("/pipeline")
        return { success: true, base: { id: baseRef.id, name: data.name.trim() } }
    } catch (error: any) {
        console.error("Failed to create base:", error)
        return { success: false, error: error.message || "Failed to create base" }
    }
}

export async function updateBase(id: string, data: { name: string; zipCode: string; periods: BasePeriod[] }) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    if (!id) return { success: false, error: "Missing id" }
    if (!data.name?.trim()) return { success: false, error: "Base name is required" }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        // Tenant-isolation: confirm ownership before the batch (batch writes
        // bypass the tenantDb proxy's ownership pre-check).
        const owned = await db.getOwned("military_bases", id)
        if (!owned) return { success: false, error: "Base not found" }

        // Name-uniqueness (ignore self).
        const dup = await db.collection("military_bases").where("name", "==", data.name.trim()).limit(1).get()
        if (!dup.empty && dup.docs[0].id !== id) {
            return { success: false, error: "A base with this name already exists." }
        }

        const baseRef = db.collectionRef("military_bases").doc(id)
        const batch = db.batch()

        batch.update(baseRef, {
            name: data.name.trim(),
            zipCode: data.zipCode?.trim() || "",
            updatedAt: new Date(),
        })

        // Replace the periods subcollection wholesale.
        const periodsSnap = await baseRef.collection("periods").get()
        periodsSnap.forEach((doc) => batch.delete(doc.ref))

        for (const period of normalizePeriods(data.periods)) {
            const periodRef = baseRef.collection("periods").doc()
            batch.set(periodRef, { ...period, workspaceId })
        }

        await batch.commit()

        revalidatePath("/settings")
        revalidatePath("/pipeline")
        return { success: true }
    } catch (error: any) {
        console.error("Failed to update base:", error)
        return { success: false, error: error.message || "Failed to update base" }
    }
}

export async function deleteBase(id: string) {
    let session
    try {
        session = await requireAdmin()
    } catch {
        return { success: false, error: "Admin access required" }
    }

    if (!id) return { success: false, error: "Missing id" }

    try {
        const workspaceId = session.user.workspaceId
        const db = tenantDb(workspaceId)

        // Tenant-isolation: confirm ownership before the batch.
        const owned = await db.getOwned("military_bases", id)
        if (!owned) return { success: false, error: "Base not found" }

        const baseRef = db.collectionRef("military_bases").doc(id)

        // Delete the periods subcollection, then the base doc.
        const periodsSnap = await baseRef.collection("periods").get()
        const batch = db.batch()
        periodsSnap.forEach((doc) => batch.delete(doc.ref))
        batch.delete(baseRef)
        await batch.commit()

        revalidatePath("/settings")
        revalidatePath("/pipeline")
        return { success: true }
    } catch (error: any) {
        console.error("Failed to delete base:", error)
        return { success: false, error: error.message || "Failed to delete base" }
    }
}
