/**
 * Stripe-backed credit top-ups.
 *
 * Flow:
 *   1. User clicks "Buy 10,000 credits" → server action creates a Stripe
 *      Checkout Session with `metadata.workspaceId` + `metadata.creditsToGrant`.
 *   2. User pays on Stripe-hosted Checkout.
 *   3. Stripe hits our webhook with `checkout.session.completed`.
 *   4. Webhook grants credits (idempotent on `session.id` via credit_ledger).
 *
 * Env vars:
 *   STRIPE_SECRET_KEY                  - secret key (sk_test_ or sk_live_)
 *   STRIPE_WEBHOOK_SECRET              - from the Stripe CLI or dashboard
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY - only used client-side if we ever
 *                                        switch to Elements; Checkout redirect
 *                                        doesn't need it on the client.
 */

import Stripe from "stripe"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import { grant as grantCredits } from "@/lib/credits/email-credits"

export interface CreditPack {
    sku: string
    label: string
    credits: number
    amountCents: number
    currency: string
}

export const CREDIT_PACKS: CreditPack[] = [
    { sku: "credits-1k", label: "1,000 credits", credits: 1_000, amountCents: 500, currency: "usd" },
    { sku: "credits-10k", label: "10,000 credits", credits: 10_000, amountCents: 2_500, currency: "usd" },
    { sku: "credits-100k", label: "100,000 credits", credits: 100_000, amountCents: 20_000, currency: "usd" },
]

export function getPack(sku: string): CreditPack | null {
    return CREDIT_PACKS.find((p) => p.sku === sku) ?? null
}

export class StripeNotConfiguredError extends Error {
    constructor() {
        super(
            "Stripe is not configured. Set STRIPE_SECRET_KEY in the environment to enable credit top-ups.",
        )
        this.name = "StripeNotConfiguredError"
    }
}

export function isStripeConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY
}

let cachedStripe: Stripe | null = null

export function getStripe(): Stripe {
    if (cachedStripe) return cachedStripe
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new StripeNotConfiguredError()
    cachedStripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" })
    return cachedStripe
}

export interface CreateCheckoutArgs {
    workspaceId: string
    packSku: string
    userId: string
    origin: string
    /** Used as the new customer's email if we don't have a Stripe customer yet for this workspace. */
    userEmail?: string
}

export async function createCheckoutSession({
    workspaceId,
    packSku,
    userId,
    origin,
    userEmail,
}: CreateCheckoutArgs): Promise<{ url: string; sessionId: string }> {
    if (!workspaceId) throw new Error("workspaceId required")
    const pack = getPack(packSku)
    if (!pack) throw new Error(`Unknown pack: ${packSku}`)

    const stripe = getStripe()
    const base = origin.replace(/\/$/, "")

    // Reuse the workspace's persistent Stripe Customer if we have one —
    // that's what lets us open the Customer Portal later for invoices
    // and payment-method management. First-time top-up: create one,
    // store on the workspace.
    let customerId = await getStoredCustomerId(workspaceId)
    if (!customerId && userEmail) {
        const customer = await stripe.customers.create({
            email: userEmail,
            metadata: { workspaceId },
        })
        customerId = customer.id
        await adminDb.collection("workspaces").doc(workspaceId).set(
            { stripeCustomerId: customerId },
            { merge: true },
        )
    }

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        ...(customerId ? { customer: customerId } : { customer_creation: "always" }),
        line_items: [
            {
                quantity: 1,
                price_data: {
                    currency: pack.currency,
                    unit_amount: pack.amountCents,
                    product_data: {
                        name: pack.label,
                        description: `Adds ${pack.credits.toLocaleString()} email credits to your workspace.`,
                    },
                },
            },
        ],
        metadata: {
            workspaceId,
            userId,
            packSku: pack.sku,
            creditsToGrant: String(pack.credits),
        },
        success_url: `${base}/settings/billing?topup=success`,
        cancel_url: `${base}/settings/billing?topup=canceled`,
    })

    if (!session.url) throw new Error("Stripe did not return a checkout URL")
    return { url: session.url, sessionId: session.id }
}

async function getStoredCustomerId(workspaceId: string): Promise<string | null> {
    const snap = await adminDb.collection("workspaces").doc(workspaceId).get()
    const raw = snap.data()?.stripeCustomerId
    return typeof raw === "string" && raw ? raw : null
}

/**
 * Open the Stripe Customer Portal so users can manage payment methods,
 * download invoices, and request refunds without leaving Vesta-adjacent
 * surfaces.
 *
 * Returns null if there's no persistent customer yet (the workspace
 * hasn't done its first top-up). UI should hide the portal button in
 * that case.
 */
export async function createPortalSession(
    workspaceId: string,
    returnUrl: string,
): Promise<string | null> {
    const customerId = await getStoredCustomerId(workspaceId)
    if (!customerId) return null
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    })
    return session.url
}

/**
 * Apply a completed Checkout Session idempotently. Safe to call multiple
 * times for the same session (guarded by `credit_ledger.refId`).
 */
export async function grantFromCheckoutSession(
    session: Stripe.Checkout.Session,
): Promise<{ granted: boolean; credits: number; workspaceId: string | null }> {
    const md = (session.metadata ?? {}) as Record<string, string>
    const workspaceId = md.workspaceId || null
    const creditsRaw = md.creditsToGrant
    const credits = creditsRaw ? Number(creditsRaw) : 0

    if (!workspaceId || !Number.isFinite(credits) || credits <= 0) {
        console.warn("[Stripe] Checkout session missing metadata — ignoring", session.id)
        return { granted: false, credits: 0, workspaceId }
    }

    // Idempotency check: same session.id already applied?
    const existing = await adminDb
        .collection("credit_ledger")
        .where("refId", "==", session.id)
        .limit(1)
        .get()
    if (!existing.empty) {
        return { granted: false, credits, workspaceId }
    }

    await grantCredits(
        workspaceId,
        credits,
        `Stripe top-up (${md.packSku ?? "pack"})`,
        session.id,
    )
    return { granted: true, credits, workspaceId }
}

/**
 * Revoke credits granted by a Stripe Checkout session that was later
 * refunded or charged back. Looks up the original ledger entry by
 * `refId === session.id` so we know exactly how many credits to claw
 * back. Idempotent on `<sessionId>:<reason>:<chargeId>` so duplicate
 * webhook deliveries don't double-revoke.
 *
 * Called from the Stripe webhook on `charge.refunded` and
 * `charge.dispute.created`. Safe to call when the workspace has spent
 * some/all of the granted credits — this just decrements the balance,
 * which can validly go negative until the next top-up.
 */
export async function revokeFromStripeCharge(
    chargeId: string,
    paymentIntentId: string,
    reason: "refund" | "dispute",
    amountAffectedCents?: number,
): Promise<{ revoked: boolean; credits: number; workspaceId: string | null }> {
    const stripe = getStripe()

    const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 1,
    })
    const session = sessions.data[0]
    if (!session) {
        console.warn(`[Stripe] No checkout session for payment_intent ${paymentIntentId}`)
        return { revoked: false, credits: 0, workspaceId: null }
    }

    const md = (session.metadata ?? {}) as Record<string, string>
    const workspaceId = md.workspaceId || null
    const grantedCredits = md.creditsToGrant ? Number(md.creditsToGrant) : 0
    if (!workspaceId || !Number.isFinite(grantedCredits) || grantedCredits <= 0) {
        return { revoked: false, credits: 0, workspaceId }
    }

    const totalCents = session.amount_total ?? 0
    let creditsToRevoke = grantedCredits
    if (
        amountAffectedCents != null &&
        totalCents > 0 &&
        amountAffectedCents < totalCents
    ) {
        creditsToRevoke = Math.floor((grantedCredits * amountAffectedCents) / totalCents)
    }
    if (creditsToRevoke <= 0) {
        return { revoked: false, credits: 0, workspaceId }
    }

    const revokeRefId = `${session.id}:${reason}:${chargeId}`

    const existing = await adminDb
        .collection("credit_ledger")
        .where("refId", "==", revokeRefId)
        .limit(1)
        .get()
    if (!existing.empty) {
        return { revoked: false, credits: creditsToRevoke, workspaceId }
    }

    const workspaceRef = adminDb.collection("workspaces").doc(workspaceId)
    const ledgerRef = adminDb.collection("credit_ledger").doc()

    await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(workspaceRef)
        if (!snap.exists) throw new Error(`workspace ${workspaceId} not found`)
        const current = typeof snap.data()?.email_credit_balance === "number"
            ? (snap.data()!.email_credit_balance as number)
            : 0
        const next = current - creditsToRevoke
        tx.update(workspaceRef, {
            email_credit_balance: next,
            updatedAt: new Date(),
        })
        tx.set(ledgerRef, {
            workspaceId,
            delta: -creditsToRevoke,
            balanceAfter: next,
            reason: "refund",
            refId: revokeRefId,
            note:
                reason === "dispute"
                    ? `Stripe chargeback (charge ${chargeId})`
                    : `Stripe refund (charge ${chargeId})`,
            createdAt: FieldValue.serverTimestamp(),
        })
    })

    return { revoked: true, credits: creditsToRevoke, workspaceId }
}
