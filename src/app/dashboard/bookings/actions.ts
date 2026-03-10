"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"
import type { BookingEntry, OverlapGroup, BookingsData } from "./types"

function datesOverlap(s1: string, e1: string, s2: string, e2: string): { start: string; end: string; days: number } | null {
    const start1 = new Date(s1).getTime()
    const end1 = new Date(e1).getTime()
    const start2 = new Date(s2).getTime()
    const end2 = new Date(e2).getTime()

    const overlapStart = Math.max(start1, start2)
    const overlapEnd = Math.min(end1, end2)

    if (overlapStart < overlapEnd) {
        const days = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24))
        return {
            start: new Date(overlapStart).toISOString().split("T")[0],
            end: new Date(overlapEnd).toISOString().split("T")[0],
            days,
        }
    }
    return null
}

export async function getBookingsData(): Promise<{ success: boolean; data?: BookingsData; error?: string }> {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    try {
        const [oppsSnap, contactsSnap, pipelinesSnap, usersSnap] = await Promise.all([
            adminDb.collection("opportunities").get(),
            adminDb.collection("contacts").get(),
            adminDb.collection("pipelines").get(),
            adminDb.collection("users").get(),
        ])

        // Build contacts map
        const contactsMap: Record<string, any> = {}
        contactsSnap.docs.forEach(doc => {
            contactsMap[doc.id] = { id: doc.id, ...doc.data() }
        })

        // Build users map
        const usersMap: Record<string, string> = {}
        usersSnap.docs.forEach(doc => {
            usersMap[doc.id] = doc.data().name || "Unknown"
        })

        // Build stage map
        const stageMap: Record<string, string> = {}
        for (const pDoc of pipelinesSnap.docs) {
            const stagesSnap = await pDoc.ref.collection("stages").get()
            stagesSnap.docs.forEach(sDoc => {
                stageMap[sDoc.id] = sDoc.data().name
            })
        }

        const toDateStr = (val: any): string | null => {
            if (!val) return null
            if (typeof val === "string") return val.split("T")[0]
            if (val.toDate) return val.toDate().toISOString().split("T")[0]
            if (typeof val === "object" && typeof val._seconds === "number") {
                return new Date(val._seconds * 1000).toISOString().split("T")[0]
            }
            return null
        }

        // Filter to opportunities with both dates and a base
        const bookings: BookingEntry[] = []
        const excludeStages = new Set(["Closed Lost", "Archive", "Lost", "Abandoned"])

        for (const doc of oppsSnap.docs) {
            const d = doc.data()
            const contact = d.contactId ? contactsMap[d.contactId] : null

            const base = d.militaryBase || contact?.militaryBase
            const startDate = toDateStr(d.stayStartDate || contact?.stayStartDate)
            const endDate = toDateStr(d.stayEndDate || contact?.stayEndDate)
            const stageName = d.pipelineStageId ? stageMap[d.pipelineStageId] || "Unknown" : "Unknown"

            if (!base || !startDate || !endDate) continue
            if (d.status === "closed_lost" || d.status === "archive" || excludeStages.has(stageName)) continue

            bookings.push({
                id: doc.id,
                contactId: d.contactId || "",
                name: contact?.name || d.name || "Unknown",
                email: contact?.email || d.email || null,
                phone: contact?.phone || d.phone || null,
                base,
                startDate,
                endDate,
                value: Number(d.opportunityValue) || 0,
                margin: Number(d.estimatedProfit) || 0,
                stage: stageName,
                claimedByName: d.claimedByName || null,
                assigneeName: d.assigneeId ? usersMap[d.assigneeId] || null : null,
            })
        }

        // Find overlapping travelers at the same base
        const overlaps: OverlapGroup[] = []
        const baseGroups: Record<string, BookingEntry[]> = {}
        for (const b of bookings) {
            if (!baseGroups[b.base]) baseGroups[b.base] = []
            baseGroups[b.base].push(b)
        }

        // For each base, check all pairs for overlaps
        const processedPairs = new Set<string>()
        for (const [base, travelers] of Object.entries(baseGroups)) {
            if (travelers.length < 2) continue

            // Sort by start date
            travelers.sort((a, b) => a.startDate.localeCompare(b.startDate))

            // Find overlap clusters (groups of travelers with mutual overlap)
            for (let i = 0; i < travelers.length; i++) {
                for (let j = i + 1; j < travelers.length; j++) {
                    const pairKey = [travelers[i].id, travelers[j].id].sort().join("_")
                    if (processedPairs.has(pairKey)) continue
                    processedPairs.add(pairKey)

                    const overlap = datesOverlap(
                        travelers[i].startDate, travelers[i].endDate,
                        travelers[j].startDate, travelers[j].endDate
                    )

                    if (overlap && overlap.days >= 1) {
                        const combinedRevenue = travelers[i].value + travelers[j].value
                        overlaps.push({
                            base,
                            travelers: [travelers[i], travelers[j]],
                            overlapStart: overlap.start,
                            overlapEnd: overlap.end,
                            overlapDays: overlap.days,
                            combinedRevenue,
                            arbitrageNote: `${overlap.days} overlapping days — both travelers can share a single property (2x gov rate, 1x host cost)`,
                        })
                    }
                }
            }
        }

        // Sort overlaps by overlap days descending (most opportunity first)
        overlaps.sort((a, b) => b.overlapDays - a.overlapDays)

        const bases = [...new Set(bookings.map(b => b.base))].sort()

        return { success: true, data: { bookings, overlaps, bases } }
    } catch (error) {
        console.error("Bookings data error:", error)
        return { success: false, error: "Failed to fetch bookings data" }
    }
}
