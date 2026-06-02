/**
 * Stripe subscription helpers — separate concern from credit top-ups.
 *
 * Top-ups are one-time `mode: payment` Checkout sessions. Subscriptions
 * are `mode: subscription` Checkout sessions tied to recurring Price
 * IDs created in the Stripe Dashboard. We DO NOT define the prices in
 * code (Stripe is the source of truth for amounts); we read price IDs
 * from env vars so the same code works for test and live modes.
 *
 * Required env vars (4 minimum):
 *   STRIPE_PRICE_PRO_MONTHLY
 *   STRIPE_PRICE_PRO_YEARLY
 *   STRIPE_PRICE_MAX_MONTHLY
 *   STRIPE_PRICE_MAX_YEARLY
 *
 * Optional (seat overage):
 *   STRIPE_PRICE_PRO_SEAT_MONTHLY  — recurring per-seat above the 3 included on Pro
 *   STRIPE_PRICE_PRO_SEAT_YEARLY
 *   STRIPE_PRICE_MAX_SEAT_MONTHLY  — recurring per-seat above the 10 included on Max
 *   STRIPE_PRICE_MAX_SEAT_YEARLY
 *
 * Customer is reused from the existing top-up flow (workspace.stripeCustomerId).
 */

import Stripe from "stripe"
import { adminDb } from "@/lib/firebase-admin"
import {
    getStripe,
    isStripeConfigured,
} from "@/lib/billing/credit-topups"
import type { PlanTier } from "@/lib/billing/plans"

export type Cadence = "monthly" | "yearly"

const PRICE_ENV_KEYS: Record<Exclude<PlanTier, "free">, Record<Cadence, string>> = {
    pro: {
        monthly: "STRIPE_PRICE_PRO_MONTHLY",
        yearly: "STRIPE_PRICE_PRO_YEARLY",
    },
    max: {
        monthly: "STRIPE_PRICE_MAX_MONTHLY",
        yearly: "STRIPE_PRICE_MAX_YEARLY",
    },
}

const SEAT_PRICE_ENV_KEYS: Record<Exclude<PlanTier, "free">, Record<Cadence, string>> = {
    pro: {
        monthly: "STRIPE_PRICE_PRO_SEAT_MONTHLY",
        yearly: "STRIPE_PRICE_PRO_SEAT_YEARLY",
    },
    max: {
        monthly: "STRIPE_PRICE_MAX_SEAT_MONTHLY",
        yearly: "STRIPE_PRICE_MAX_SEAT_YEARLY",
    },
}

export function getPriceId(tier: Exclude<PlanTier, "free">, cadence: Cadence): string | null {
    const key = PRICE_ENV_KEYS[tier][cadence]
    return process.env[key] || null
}

export function getSeatPriceId(tier: Exclude<PlanTier, "free">, cadence: Cadence): string | null {
    const key = SEAT_PRICE_ENV_KEYS[tier][cadence]
    return process.env[key] || null
}

interface CreateSubscriptionCheckoutArgs {
    workspaceId: string
    tier: Exclude<PlanTier, "free">
    cadence: Cadence
    userEmail?: string
    origin: string
    /** Additional seats above the base (charged via the seat price line if configured). */
    extraSeats?: number
}

/**
 * Start a Stripe Checkout session for a subscription. Reuses the
 * workspace's Stripe Customer if there is one; otherwise creates one
 * with the user's email so the Customer Portal works afterwards.
 */
export async function createSubscriptionCheckout({
    workspaceId,
    tier,
    cadence,
    userEmail,
    origin,
    extraSeats = 0,
}: CreateSubscriptionCheckoutArgs): Promise<{ url: string; sessionId: string }> {
    if (!isStripeConfigured()) {
        throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY")
    }
    if (!workspaceId) throw new Error("workspaceId required")

    const priceId = getPriceId(tier, cadence)
    if (!priceId) {
        throw new Error(
            `Missing env var ${PRICE_ENV_KEYS[tier][cadence]} — create the Stripe price first and add the price ID.`,
        )
    }

    const stripe = getStripe()
    const customerId = await ensureCustomer(stripe, workspaceId, userEmail)

    const lineItems: Array<{ price: string; quantity: number }> = [
        { price: priceId, quantity: 1 },
    ]

    if (extraSeats > 0) {
        const seatPriceId = getSeatPriceId(tier, cadence)
        if (seatPriceId) {
            lineItems.push({ price: seatPriceId, quantity: extraSeats })
        }
    }

    const base = origin.replace(/\/$/, "")
    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: lineItems,
        metadata: { workspaceId, tier, cadence, extraSeats: String(extraSeats) },
        subscription_data: {
            metadata: { workspaceId, tier, cadence },
        },
        success_url: `${base}/settings/billing?plan_change=success`,
        cancel_url: `${base}/settings/billing?plan_change=canceled`,
        allow_promotion_codes: true,
    })

    if (!session.url) throw new Error("Stripe did not return a checkout URL")
    return { url: session.url, sessionId: session.id }
}

async function ensureCustomer(
    stripe: Stripe,
    workspaceId: string,
    userEmail?: string,
): Promise<string> {
    const wsRef = adminDb.collection("workspaces").doc(workspaceId)
    const wsSnap = await wsRef.get()
    const existing = wsSnap.data()?.stripeCustomerId as string | undefined
    if (existing) return existing

    const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { workspaceId },
    })
    await wsRef.set({ stripeCustomerId: customer.id }, { merge: true })
    return customer.id
}

/**
 * Map a Stripe subscription event back to our internal plan state.
 * Pulls the price ID off the first line item and matches it against
 * the configured env vars to figure out which tier+cadence it is.
 */
export function tierFromSubscription(sub: Stripe.Subscription): {
    tier: PlanTier
    cadence: Cadence | null
} {
    const items = sub.items?.data ?? []
    for (const item of items) {
        const priceId = item.price?.id
        if (!priceId) continue
        for (const tier of ["pro", "max"] as const) {
            for (const cadence of ["monthly", "yearly"] as const) {
                if (process.env[PRICE_ENV_KEYS[tier][cadence]] === priceId) {
                    return { tier, cadence }
                }
            }
        }
    }
    // Fallback: read metadata if it was stamped at checkout time
    const metaTier = (sub.metadata?.tier as PlanTier) || "free"
    const metaCadence = (sub.metadata?.cadence as Cadence) || null
    return { tier: metaTier, cadence: metaCadence }
}

/**
 * Apply a Stripe Subscription's current state to the workspace doc.
 * Idempotent — safe to call on every webhook event for the same sub.
 */
export async function syncSubscriptionToWorkspace(sub: Stripe.Subscription): Promise<void> {
    const workspaceId =
        (sub.metadata?.workspaceId as string) ||
        (await findWorkspaceByCustomerId(sub.customer as string))
    if (!workspaceId) {
        console.warn(`[subs] No workspace for subscription ${sub.id}`)
        return
    }

    const { tier } = tierFromSubscription(sub)
    const status = mapStripeStatus(sub.status)

    const periodEnd: number | null | undefined = (sub as unknown as { current_period_end?: number | null }).current_period_end
    const expiresAt =
        typeof periodEnd === "number" && periodEnd > 0
            ? new Date(periodEnd * 1000).toISOString()
            : null

    // Track quantity of the *first* line item as included seats; any
    // additional seat-priced line items become extraSeats.
    let extraSeats = 0
    const items = sub.items?.data ?? []
    for (const item of items) {
        const priceId = item.price?.id
        const isSeatPrice = (["pro", "max"] as const).some((t) =>
            (["monthly", "yearly"] as const).some(
                (c) => process.env[SEAT_PRICE_ENV_KEYS[t][c]] === priceId,
            ),
        )
        if (isSeatPrice) extraSeats += item.quantity || 0
    }

    await adminDb.collection("workspaces").doc(workspaceId).set(
        {
            plan: tier,
            planStatus: status,
            planExpiresAt: expiresAt,
            extraSeats,
            stripeSubscriptionId: sub.id,
            updatedAt: new Date().toISOString(),
        },
        { merge: true },
    )
}

function mapStripeStatus(s: Stripe.Subscription.Status): "active" | "past_due" | "canceled" | "trialing" | "inactive" {
    switch (s) {
        case "active":
            return "active"
        case "trialing":
            return "trialing"
        case "past_due":
        case "unpaid":
            return "past_due"
        case "canceled":
        case "incomplete_expired":
            return "canceled"
        case "incomplete":
        case "paused":
            return "inactive"
        default:
            return "inactive"
    }
}

async function findWorkspaceByCustomerId(customerId: string): Promise<string | null> {
    if (!customerId) return null
    const snap = await adminDb
        .collection("workspaces")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get()
    if (snap.empty) return null
    return snap.docs[0].id
}
