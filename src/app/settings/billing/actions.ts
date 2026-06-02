"use server"

import { requireAdmin, requireAuth } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import {
    CREDIT_PACKS,
    createCheckoutSession,
    createPortalSession,
    isStripeConfigured,
} from "@/lib/billing/credit-topups"
import {
    createSubscriptionCheckout,
    getPriceId,
    type Cadence,
} from "@/lib/billing/subscriptions"
import type { PlanTier, WorkspacePlanState } from "@/lib/billing/plans"
import { getWorkspacePlan } from "@/lib/billing/plans-server"
import { getBalance } from "@/lib/credits/email-credits"
import type { CreditLedgerReason } from "@/types"
import { headers } from "next/headers"

export interface LedgerRow {
    id: string
    delta: number
    balanceAfter: number
    reason: CreditLedgerReason
    note: string | null
    refId: string | null
    createdAt: string | null
}

export interface BillingState {
    balance: number
    packs: typeof CREDIT_PACKS
    recent: LedgerRow[]
    stripeConfigured: boolean
    hasCustomer: boolean
    plan: WorkspacePlanState
    /** Which tiers have their Stripe prices configured (env vars present). */
    subscriptionPricesConfigured: Record<"pro_monthly" | "pro_yearly" | "max_monthly" | "max_yearly", boolean>
}

export async function getBillingState(): Promise<BillingState> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId!

    const [balance, ledgerSnap, workspaceDoc, plan] = await Promise.all([
        getBalance(workspaceId).catch(() => 0),
        adminDb
            .collection("credit_ledger")
            .where("workspaceId", "==", workspaceId)
            .orderBy("createdAt", "desc")
            .limit(20)
            .get()
            .catch(() => null),
        adminDb.collection("workspaces").doc(workspaceId).get(),
        getWorkspacePlan(workspaceId),
    ])

    const recent: LedgerRow[] = (ledgerSnap?.docs ?? []).map((doc) => {
        const d = doc.data()
        const ts = d.createdAt
        const createdAt = ts?.toDate
            ? ts.toDate().toISOString()
            : typeof ts === "string"
              ? ts
              : null
        return {
            id: doc.id,
            delta: typeof d.delta === "number" ? d.delta : 0,
            balanceAfter: typeof d.balanceAfter === "number" ? d.balanceAfter : 0,
            reason: (d.reason as CreditLedgerReason) || "adjust",
            note: d.note || null,
            refId: d.refId || null,
            createdAt,
        }
    })

    return {
        balance,
        packs: CREDIT_PACKS,
        recent,
        stripeConfigured: isStripeConfigured(),
        hasCustomer: !!workspaceDoc.data()?.stripeCustomerId,
        plan,
        subscriptionPricesConfigured: {
            pro_monthly: !!getPriceId("pro", "monthly"),
            pro_yearly: !!getPriceId("pro", "yearly"),
            max_monthly: !!getPriceId("max", "monthly"),
            max_yearly: !!getPriceId("max", "yearly"),
        },
    }
}

/**
 * Open a Stripe Checkout session for a plan change (upgrade or downgrade).
 * Admin-only. Returns the Checkout URL the client should navigate to.
 *
 * For existing subscribers, prefer the Customer Portal (see
 * openCustomerPortal below) which handles plan switches without a new
 * checkout. This action is mainly for free → paid first-purchase.
 */
export async function startPlanChange(
    tier: Exclude<PlanTier, "free">,
    cadence: Cadence,
): Promise<{ url?: string; error?: string }> {
    if (!isStripeConfigured()) {
        return { error: "Billing isn't configured for this deployment." }
    }
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId!
    const userEmail = session.user.email || undefined

    const h = await headers()
    const host = h.get("host")
    const proto = h.get("x-forwarded-proto") || "https"
    const origin = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : null)
    if (!origin) {
        return { error: "NEXT_PUBLIC_APP_URL is not set" }
    }

    try {
        const { url } = await createSubscriptionCheckout({
            workspaceId,
            tier,
            cadence,
            userEmail,
            origin,
        })
        return { url }
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to start plan change"
        return { error: msg }
    }
}


/**
 * Start a Stripe Checkout flow for the given pack SKU. Returns the URL
 * the client should navigate to. Admin-only — credits are workspace-
 * scoped and we don't want any teammate spending money.
 */
export async function startTopup(
    packSku: string,
): Promise<{ url?: string; error?: string }> {
    if (!isStripeConfigured()) {
        return { error: "Billing isn't configured for this deployment." }
    }
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId!
    const userId = session.user.id!
    const userEmail = session.user.email || undefined

    const h = await headers()
    const host = h.get("host")
    const proto = h.get("x-forwarded-proto") || "https"
    const origin = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : null)
    if (!origin) {
        return { error: "NEXT_PUBLIC_APP_URL is not set" }
    }

    try {
        const { url } = await createCheckoutSession({
            workspaceId,
            packSku,
            userId,
            userEmail,
            origin,
        })
        return { url }
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to start checkout"
        return { error: msg }
    }
}

/**
 * Open the Stripe Customer Portal. Only works after the workspace has
 * done at least one top-up (that's when we first create the Stripe
 * Customer record).
 */
/**
 * Lightweight plan-status read for chrome-level banners (the past-due /
 * canceled banner in AppShell). Avoids the full getBillingState() round-
 * trip — no ledger, no Stripe customer check, no credit-pack list. Just
 * tier + status + period-end date.
 */
export async function getPlanStatus(): Promise<{
    tier: WorkspacePlanState["tier"]
    status: WorkspacePlanState["status"]
    expiresAt: string | null
}> {
    const session = await requireAuth()
    const workspaceId = session.user.workspaceId!
    const state = await getWorkspacePlan(workspaceId)
    return {
        tier: state.tier,
        status: state.status,
        expiresAt: state.expiresAt,
    }
}

export async function openCustomerPortal(): Promise<{ url?: string; error?: string }> {
    if (!isStripeConfigured()) {
        return { error: "Billing isn't configured for this deployment." }
    }
    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId!

    const h = await headers()
    const host = h.get("host")
    const proto = h.get("x-forwarded-proto") || "https"
    const origin = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : null)
    if (!origin) {
        return { error: "NEXT_PUBLIC_APP_URL is not set" }
    }
    const returnUrl = `${origin}/settings/billing`

    try {
        const url = await createPortalSession(workspaceId, returnUrl)
        if (!url) {
            return {
                error: "Buy credits at least once before opening the billing portal.",
            }
        }
        return { url }
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to open portal"
        return { error: msg }
    }
}
