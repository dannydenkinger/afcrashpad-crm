"use server"

import { adminDb } from "@/lib/firebase-admin"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/audit"
import { createNotification } from "@/app/notifications/actions"
import { sendEmail } from "@/lib/email"
import crypto from "crypto"
import type { Referral, ReferralStatus, ReferralsData, PayoutMethod } from "./types"

export async function getReferralsData(): Promise<{ success: boolean; data?: ReferralsData; error?: string }> {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    try {
        const [referralsSnap, settingsDoc] = await Promise.all([
            adminDb.collection("referrals").orderBy("createdAt", "desc").get(),
            adminDb.collection("settings").doc("referrals").get(),
        ])

        const defaultPayoutAmount = settingsDoc.exists ? (settingsDoc.data()?.defaultPayoutAmount ?? 100) : 100

        const toISO = (v: any) => {
            if (!v) return null
            if (typeof v === "string") return v
            if (v.toDate) return v.toDate().toISOString()
            if (typeof v === "object" && typeof v._seconds === "number") return new Date(v._seconds * 1000).toISOString()
            return null
        }

        const referrals: Referral[] = referralsSnap.docs.map(doc => {
            const d = doc.data()
            return {
                id: doc.id,
                referrerName: d.referrerName || "Unknown",
                referrerEmail: d.referrerEmail || null,
                referrerPhone: d.referrerPhone || null,
                referrerContactId: d.referrerContactId || null,
                referredName: d.referredName || "Unknown",
                referredEmail: d.referredEmail || null,
                referredContactId: d.referredContactId || null,
                referredOpportunityId: d.referredOpportunityId || null,
                status: d.status || "pending",
                dealValue: Number(d.dealValue) || 0,
                payoutAmount: Number(d.payoutAmount) || defaultPayoutAmount,
                payoutPaidAt: toISO(d.payoutPaidAt),
                payoutToken: d.payoutToken || null,
                payoutMethod: d.payoutMethod || null,
                payoutDetails: d.payoutDetails || null,
                payoutFormSentAt: toISO(d.payoutFormSentAt),
                payoutFormSubmittedAt: toISO(d.payoutFormSubmittedAt),
                notes: d.notes || null,
                createdAt: toISO(d.createdAt) || new Date().toISOString(),
                convertedAt: toISO(d.convertedAt),
            }
        })

        const totalReferrals = referrals.length
        const activeTenantsCount = referrals.filter(r => r.status === "active_tenant" || r.status === "paid").length
        const paidCount = referrals.filter(r => r.status === "paid").length
        const conversionRate = totalReferrals > 0 ? Math.round((activeTenantsCount / totalReferrals) * 1000) / 10 : 0
        const totalReferredRevenue = referrals
            .filter(r => r.status === "active_tenant" || r.status === "paid" || r.status === "booked")
            .reduce((s, r) => s + r.dealValue, 0)

        // Payout tracking
        const payoutEligible = referrals.filter(r => r.status === "active_tenant" || r.status === "paid")
        const totalPayoutsEarned = payoutEligible.reduce((s, r) => s + r.payoutAmount, 0)
        const totalPayoutsPaid = referrals.filter(r => r.status === "paid").reduce((s, r) => s + r.payoutAmount, 0)
        const totalPayoutsPending = totalPayoutsEarned - totalPayoutsPaid

        // Top referrers
        const referrerMap: Record<string, { name: string; email: string | null; count: number; activeCount: number; revenue: number; payoutsEarned: number }> = {}
        for (const r of referrals) {
            const key = r.referrerEmail || r.referrerPhone || r.referrerName
            if (!referrerMap[key]) {
                referrerMap[key] = { name: r.referrerName, email: r.referrerEmail, count: 0, activeCount: 0, revenue: 0, payoutsEarned: 0 }
            }
            referrerMap[key].count++
            if (r.status === "active_tenant" || r.status === "paid") {
                referrerMap[key].activeCount++
                referrerMap[key].revenue += r.dealValue
                referrerMap[key].payoutsEarned += r.payoutAmount
            }
        }
        const topReferrers = Object.values(referrerMap).sort((a, b) => b.count - a.count).slice(0, 10)

        return {
            success: true,
            data: {
                referrals, totalReferrals, activeTenantsCount, paidCount, conversionRate,
                totalReferredRevenue, totalPayoutsEarned, totalPayoutsPaid, totalPayoutsPending,
                defaultPayoutAmount, topReferrers,
            },
        }
    } catch (error) {
        console.error("Referrals data error:", error)
        return { success: false, error: "Failed to fetch referrals data" }
    }
}

export async function createReferral(data: {
    referrerName: string
    referrerEmail?: string
    referrerPhone?: string
    referrerContactId?: string
    referredName: string
    referredEmail?: string
    notes?: string
    payoutAmount?: number
}) {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    try {
        // Get default payout amount
        const settingsDoc = await adminDb.collection("settings").doc("referrals").get()
        const defaultPayoutAmount = settingsDoc.exists ? (settingsDoc.data()?.defaultPayoutAmount ?? 100) : 100

        // Check if referrer is an existing contact
        let referrerContactId = data.referrerContactId || null
        if (!referrerContactId && data.referrerEmail) {
            const contactSnap = await adminDb.collection("contacts")
                .where("email", "==", data.referrerEmail)
                .limit(1)
                .get()
            if (!contactSnap.empty) referrerContactId = contactSnap.docs[0].id
        }
        if (!referrerContactId && data.referrerPhone) {
            const contactSnap = await adminDb.collection("contacts")
                .where("phone", "==", data.referrerPhone)
                .limit(1)
                .get()
            if (!contactSnap.empty) referrerContactId = contactSnap.docs[0].id
        }

        const ref = await adminDb.collection("referrals").add({
            referrerName: data.referrerName,
            referrerEmail: data.referrerEmail || null,
            referrerPhone: data.referrerPhone || null,
            referrerContactId,
            referredName: data.referredName,
            referredEmail: data.referredEmail || null,
            referredContactId: null,
            referredOpportunityId: null,
            status: "pending",
            dealValue: 0,
            payoutAmount: data.payoutAmount ?? defaultPayoutAmount,
            payoutPaidAt: null,
            payoutToken: null,
            payoutMethod: null,
            payoutDetails: null,
            payoutFormSentAt: null,
            payoutFormSubmittedAt: null,
            notes: data.notes || null,
            createdAt: new Date(),
            convertedAt: null,
        })

        // Notify the team
        await createNotification({
            title: "New referral received",
            message: `${data.referrerName} referred ${data.referredName}`,
            type: "opportunity",
            linkUrl: `/dashboard?tab=referrals`,
        })

        logAudit({
            userId: (session.user as any).id || "",
            userEmail: session.user.email || "",
            userName: session.user.name || "",
            action: "create",
            entity: "referral",
            entityId: ref.id,
            entityName: `${data.referrerName} → ${data.referredName}`,
        }).catch(() => {})

        revalidatePath("/dashboard")
        return { success: true }
    } catch (error) {
        console.error("Create referral error:", error)
        return { success: false, error: "Failed to create referral" }
    }
}

export async function updateReferralStatus(
    referralId: string,
    status: ReferralStatus,
    data?: { referredContactId?: string; referredOpportunityId?: string; dealValue?: number; payoutAmount?: number }
) {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    try {
        const update: Record<string, unknown> = { status }
        if (status === "active_tenant") update.convertedAt = new Date()
        if (status === "paid") update.payoutPaidAt = new Date()
        if (data?.referredContactId) update.referredContactId = data.referredContactId
        if (data?.referredOpportunityId) update.referredOpportunityId = data.referredOpportunityId
        if (data?.dealValue !== undefined) update.dealValue = data.dealValue
        if (data?.payoutAmount !== undefined) update.payoutAmount = data.payoutAmount

        await adminDb.collection("referrals").doc(referralId).update(update)

        // If marking as paid, notify team
        if (status === "paid") {
            const refDoc = await adminDb.collection("referrals").doc(referralId).get()
            const refData = refDoc.data()
            if (refData) {
                createNotification({
                    title: "Referral payout processed",
                    message: `${refData.referrerName} paid $${refData.payoutAmount} for referring ${refData.referredName}`,
                    type: "opportunity",
                    linkUrl: `/dashboard?tab=referrals`,
                }).catch(() => {})
            }
        }

        revalidatePath("/dashboard")
        return { success: true }
    } catch (error) {
        console.error("Update referral error:", error)
        return { success: false, error: "Failed to update referral" }
    }
}

/**
 * Finds a referral linked to this opportunity/contact by opportunityId, contactId, or email.
 */
async function findLinkedReferral(opportunityId: string, contactId: string) {
    let refSnap = await adminDb.collection("referrals")
        .where("referredOpportunityId", "==", opportunityId)
        .limit(1)
        .get()

    if (refSnap.empty && contactId) {
        refSnap = await adminDb.collection("referrals")
            .where("referredContactId", "==", contactId)
            .limit(1)
            .get()
    }

    if (refSnap.empty && contactId) {
        const contactDoc = await adminDb.collection("contacts").doc(contactId).get()
        const email = contactDoc.data()?.email
        if (email) {
            refSnap = await adminDb.collection("referrals")
                .where("referredEmail", "==", email)
                .limit(1)
                .get()
        }
    }

    return refSnap.empty ? null : refSnap.docs[0]
}

/** Status hierarchy — higher index = more advanced. Never downgrade. */
const STATUS_RANK: Record<string, number> = {
    pending: 0, contacted: 1, booked: 2, active_tenant: 3, paid: 4, lost: -1,
}

/**
 * Called from pipeline actions on EVERY stage change.
 * Maps the pipeline stage name to the appropriate referral status and advances it.
 * Never downgrades (e.g. won't go from active_tenant back to booked).
 */
export async function advanceReferralForStage(
    opportunityId: string,
    contactId: string,
    stageName: string,
    dealValue: number,
) {
    try {
        const refDoc = await findLinkedReferral(opportunityId, contactId)
        if (!refDoc) return

        const refData = refDoc.data()
        const currentRank = STATUS_RANK[refData.status] ?? -1

        // Map pipeline stage names to referral statuses
        const nameL = stageName.toLowerCase()
        let targetStatus: ReferralStatus | null = null

        if (nameL === "current tenant") {
            targetStatus = "active_tenant"
        } else if (nameL.includes("booked") || nameL.includes("lease signed") || nameL.includes("move in") || nameL === "closed won") {
            targetStatus = "booked"
        } else if (nameL.includes("contacted") || nameL.includes("follow") || nameL.includes("qualifying") || nameL.includes("showing") || nameL.includes("application")) {
            targetStatus = "contacted"
        } else if (nameL.includes("closed lost") || nameL.includes("archive")) {
            targetStatus = "lost"
        }

        if (!targetStatus) return

        const targetRank = STATUS_RANK[targetStatus] ?? -1

        // Never downgrade (except to "lost" which is a terminal state)
        if (targetStatus !== "lost" && targetRank <= currentRank) return
        // Don't downgrade paid to anything
        if (refData.status === "paid") return

        const update: Record<string, unknown> = {
            status: targetStatus,
            referredOpportunityId: opportunityId,
            referredContactId: contactId,
            dealValue,
        }
        if (targetStatus === "active_tenant") update.convertedAt = new Date()

        await refDoc.ref.update(update)

        // Notify team when payout is unlocked
        if (targetStatus === "active_tenant") {
            createNotification({
                title: "Referral payout unlocked!",
                message: `${refData.referrerName}'s referral (${refData.referredName}) is now an active tenant — $${refData.payoutAmount} payout earned`,
                type: "opportunity",
                linkUrl: `/dashboard?tab=referrals`,
            }).catch(() => {})
        }
    } catch (error) {
        console.error("Referral stage advance error:", error)
    }
}

/**
 * @deprecated Use advanceReferralForStage instead. Kept for backwards compat with cron auto-advance.
 */
export async function checkReferralConversion(opportunityId: string, contactId: string, dealValue: number) {
    return advanceReferralForStage(opportunityId, contactId, "Current Tenant", dealValue)
}

export async function updateDefaultPayoutAmount(amount: number) {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    try {
        await adminDb.collection("settings").doc("referrals").set(
            { defaultPayoutAmount: amount, updatedAt: new Date() },
            { merge: true }
        )
        revalidatePath("/dashboard")
        return { success: true }
    } catch (error) {
        console.error("Update payout amount error:", error)
        return { success: false, error: "Failed to update payout amount" }
    }
}

/**
 * Sends a payout form email to the referrer.
 * Generates a unique token and emails a link to /referral-payout/[token]
 * where the referrer can submit their preferred payout method.
 */
export async function sendPayoutFormEmail(referralId: string) {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    try {
        const refDoc = await adminDb.collection("referrals").doc(referralId).get()
        if (!refDoc.exists) return { success: false, error: "Referral not found" }

        const refData = refDoc.data()!
        if (refData.status !== "active_tenant") {
            return { success: false, error: "Payout form can only be sent for active tenant referrals" }
        }

        if (!refData.referrerEmail) {
            return { success: false, error: "Referrer has no email address on file" }
        }

        // Generate a secure token
        const payoutToken = crypto.randomBytes(32).toString("hex")

        await adminDb.collection("referrals").doc(referralId).update({
            payoutToken,
            payoutFormSentAt: new Date(),
        })

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        const formUrl = `${baseUrl}/referral-payout/${payoutToken}`

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="padding: 32px; background-color: #0a0a0a; border-radius: 8px;">
                    <h2 style="color: #f5f5f5; margin: 0 0 12px;">Your Referral Payout is Ready!</h2>
                    <p style="color: #a3a3a3; margin: 0 0 8px; font-size: 15px;">
                        Hi ${refData.referrerName},
                    </p>
                    <p style="color: #a3a3a3; margin: 0 0 8px; font-size: 15px;">
                        Great news — your referral of <strong style="color: #f5f5f5;">${refData.referredName}</strong> has become an active tenant!
                        You've earned a <strong style="color: #10b981;">$${refData.payoutAmount}</strong> referral payout.
                    </p>
                    <p style="color: #a3a3a3; margin: 0 0 20px; font-size: 15px;">
                        Please click the button below to tell us how you'd like to receive your payment.
                    </p>
                    <a href="${formUrl}" style="display: inline-block; padding: 12px 28px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
                        Submit Payout Details
                    </a>
                    <p style="color: #525252; font-size: 12px; margin-top: 24px;">
                        This link is unique to you. Do not share it with anyone.
                    </p>
                </div>
                <p style="color: #737373; font-size: 12px; margin-top: 16px; text-align: center;">
                    AFCrashpad &bull; Referral Program
                </p>
            </div>
        `

        await sendEmail({
            to: refData.referrerEmail,
            subject: `Your $${refData.payoutAmount} referral payout is ready — submit your payment details`,
            html,
        })

        revalidatePath("/dashboard")
        return { success: true }
    } catch (error) {
        console.error("Send payout form error:", error)
        return { success: false, error: "Failed to send payout form email" }
    }
}

/**
 * Public-facing action — no auth required.
 * Looks up a referral by its payout token and returns the info needed for the form.
 */
export async function getPayoutFormData(token: string): Promise<{
    success: boolean
    data?: { referrerName: string; referredName: string; payoutAmount: number; alreadySubmitted: boolean; payoutMethod: PayoutMethod; payoutDetails: string | null }
    error?: string
}> {
    try {
        const snap = await adminDb.collection("referrals")
            .where("payoutToken", "==", token)
            .limit(1)
            .get()

        if (snap.empty) return { success: false, error: "Invalid or expired payout link" }

        const d = snap.docs[0].data()
        return {
            success: true,
            data: {
                referrerName: d.referrerName || "Unknown",
                referredName: d.referredName || "Unknown",
                payoutAmount: Number(d.payoutAmount) || 0,
                alreadySubmitted: !!d.payoutFormSubmittedAt,
                payoutMethod: d.payoutMethod || null,
                payoutDetails: d.payoutDetails || null,
            },
        }
    } catch (error) {
        console.error("Get payout form data error:", error)
        return { success: false, error: "Failed to load payout form" }
    }
}

/**
 * Public-facing action — no auth required.
 * Submits the referrer's preferred payout method and details.
 */
export async function submitPayoutDetails(
    token: string,
    method: "zelle" | "venmo" | "paypal" | "check",
    details: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!details.trim()) return { success: false, error: "Please provide your payment details" }

        const snap = await adminDb.collection("referrals")
            .where("payoutToken", "==", token)
            .limit(1)
            .get()

        if (snap.empty) return { success: false, error: "Invalid or expired payout link" }

        const refDoc = snap.docs[0]
        const refData = refDoc.data()

        await refDoc.ref.update({
            payoutMethod: method,
            payoutDetails: details.trim(),
            payoutFormSubmittedAt: new Date(),
        })

        // Notify the team
        const methodLabels: Record<string, string> = { zelle: "Zelle", venmo: "Venmo", paypal: "PayPal", check: "Check/Mail" }
        createNotification({
            title: "Payout details received",
            message: `${refData.referrerName} submitted payout info (${methodLabels[method]}) for referring ${refData.referredName} — $${refData.payoutAmount} ready to process`,
            type: "opportunity",
            linkUrl: `/dashboard?tab=referrals`,
        }).catch(() => {})

        return { success: true }
    } catch (error) {
        console.error("Submit payout details error:", error)
        return { success: false, error: "Failed to submit payout details" }
    }
}
