import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import {
    getStripe,
    grantFromCheckoutSession,
    isStripeConfigured,
    revokeFromStripeCharge,
} from "@/lib/billing/credit-topups"
import { syncSubscriptionToWorkspace } from "@/lib/billing/subscriptions"
import { captureError, captureMessage } from "@/lib/error-tracking"
import { adminDb } from "@/lib/firebase-admin"
import { track } from "@/lib/posthog/server"
import type { PlanTier } from "@/lib/billing/plans"
import type { CadenceProp, PlanTierProp } from "@/lib/posthog/events"

async function readPlanFromSub(sub: Stripe.Subscription): Promise<{
    workspaceId: string | null
    tier: PlanTier
    cadence: CadenceProp
    status: string
}> {
    const workspaceId = (sub.metadata?.workspaceId as string) || null
    const tier = ((sub.metadata?.tier as PlanTier) || "free") as PlanTier
    const cadence = ((sub.metadata?.cadence as CadenceProp) || "monthly") as CadenceProp
    return { workspaceId, tier, cadence, status: sub.status }
}

async function currentWorkspaceTier(workspaceId: string | null): Promise<PlanTierProp> {
    if (!workspaceId) return "free"
    const snap = await adminDb.collection("workspaces").doc(workspaceId).get()
    const t = snap.data()?.plan as string | undefined
    return t === "pro" || t === "max" ? t : "free"
}

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    if (!isStripeConfigured()) {
        return NextResponse.json(
            { error: "Stripe not configured" },
            { status: 503 },
        )
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) {
        console.error("[Stripe webhook] STRIPE_WEBHOOK_SECRET is not set")
        return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    const signature = req.headers.get("stripe-signature")
    if (!signature) {
        return NextResponse.json({ error: "Missing Stripe-Signature" }, { status: 400 })
    }

    const rawBody = await req.text()
    let event: Stripe.Event
    try {
        const stripe = getStripe()
        event = stripe.webhooks.constructEvent(rawBody, signature, secret)
    } catch (err) {
        const message = err instanceof Error ? err.message : "Signature verification failed"
        console.error("[Stripe webhook] signature error:", message)
        return NextResponse.json({ error: message }, { status: 401 })
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session
                // Two modes: one-time credit pack OR new subscription. The
                // subscription path is fully handled by the subscription.*
                // events below — we only need to grant credits here.
                if (session.mode === "payment") {
                    await grantFromCheckoutSession(session)
                }
                return NextResponse.json({ ok: true })
            }

            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.resumed": {
                const sub = event.data.object as Stripe.Subscription
                const subMeta = await readPlanFromSub(sub)
                const beforeTier = await currentWorkspaceTier(subMeta.workspaceId)
                await syncSubscriptionToWorkspace(sub)
                const afterTier = await currentWorkspaceTier(subMeta.workspaceId)

                if (subMeta.workspaceId) {
                    if (event.type === "customer.subscription.created" && afterTier !== "free") {
                        track({
                            workspaceId: subMeta.workspaceId,
                            event: {
                                name: "checkout_completed",
                                props: { tier: afterTier, cadence: subMeta.cadence },
                            },
                        }).catch(() => {})
                    }
                    if (beforeTier !== afterTier) {
                        track({
                            workspaceId: subMeta.workspaceId,
                            event: {
                                name: "plan_changed",
                                props: { from_tier: beforeTier, to_tier: afterTier, status: subMeta.status },
                            },
                        }).catch(() => {})
                    }
                }
                return NextResponse.json({ ok: true })
            }

            case "customer.subscription.deleted":
            case "customer.subscription.paused": {
                const sub = event.data.object as Stripe.Subscription
                const subMeta = await readPlanFromSub(sub)
                const beforeTier = await currentWorkspaceTier(subMeta.workspaceId)
                await syncSubscriptionToWorkspace(sub)

                if (subMeta.workspaceId && beforeTier !== "free") {
                    track({
                        workspaceId: subMeta.workspaceId,
                        event: { name: "subscription_canceled", props: { tier: beforeTier } },
                    }).catch(() => {})
                }

                captureMessage(
                    `Subscription ${event.type.replace("customer.subscription.", "")}: ${sub.id}`,
                    "info",
                )
                return NextResponse.json({ ok: true })
            }

            case "invoice.payment_failed": {
                // First failure → Stripe marks subscription past_due. Sync
                // again so our workspace doc reflects it.
                const invoice = event.data.object as Stripe.Invoice
                const subscription = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription
                const subId =
                    typeof subscription === "string"
                        ? subscription
                        : subscription?.id
                if (subId) {
                    const stripe = getStripe()
                    const sub = await stripe.subscriptions.retrieve(subId)
                    await syncSubscriptionToWorkspace(sub)
                    captureMessage(
                        `Invoice payment failed: subscription=${subId} amount=${invoice.amount_due}`,
                        "warning",
                    )
                }
                return NextResponse.json({ ok: true })
            }

            case "invoice.paid": {
                // Successful recovery from past_due → re-sync to flip status.
                const invoice = event.data.object as Stripe.Invoice
                const subscription = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription
                const subId =
                    typeof subscription === "string"
                        ? subscription
                        : subscription?.id
                if (subId) {
                    const stripe = getStripe()
                    const sub = await stripe.subscriptions.retrieve(subId)
                    await syncSubscriptionToWorkspace(sub)
                }
                return NextResponse.json({ ok: true })
            }

            case "charge.refunded": {
                const charge = event.data.object as Stripe.Charge
                const paymentIntentId =
                    typeof charge.payment_intent === "string"
                        ? charge.payment_intent
                        : charge.payment_intent?.id
                if (!paymentIntentId) {
                    return NextResponse.json({ ok: true, skipped: "no payment_intent" })
                }
                await revokeFromStripeCharge(
                    charge.id,
                    paymentIntentId,
                    "refund",
                    charge.amount_refunded,
                )
                return NextResponse.json({ ok: true })
            }

            case "charge.dispute.created": {
                const dispute = event.data.object as Stripe.Dispute
                const chargeId =
                    typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id
                const stripe = getStripe()
                const charge = await stripe.charges.retrieve(chargeId)
                const paymentIntentId =
                    typeof charge.payment_intent === "string"
                        ? charge.payment_intent
                        : charge.payment_intent?.id

                captureMessage(
                    `Stripe dispute opened: charge=${chargeId} reason=${dispute.reason} amount=${dispute.amount}`,
                    "warning",
                )

                if (!paymentIntentId) {
                    return NextResponse.json({ ok: true, skipped: "no payment_intent" })
                }
                await revokeFromStripeCharge(chargeId, paymentIntentId, "dispute", dispute.amount)
                return NextResponse.json({ ok: true })
            }

            case "charge.dispute.closed": {
                const dispute = event.data.object as Stripe.Dispute
                captureMessage(
                    `Stripe dispute closed: ${dispute.id} status=${dispute.status}`,
                    "info",
                )
                return NextResponse.json({ ok: true })
            }

            default:
                return NextResponse.json({ ok: true, ignored: true })
        }
    } catch (err) {
        captureError(err, { event: event.type, eventId: event.id })
        console.error("[Stripe webhook] handler error:", err)
        const message = err instanceof Error ? err.message : "Handler failed"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
