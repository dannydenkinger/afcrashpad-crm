/**
 * Server-only plan helpers. Imports firebase-admin so it can read the
 * workspace doc; keep this OUT of any client component bundle.
 *
 * Pure data + types live in ./plans (no firebase-admin import) so it's
 * safe to import from client components.
 */
import "server-only"
import { adminDb } from "@/lib/firebase-admin"
import {
    PLANS,
    PlanNotAllowedError,
    meetsPlan,
    type PlanTier,
    type PlanStatus,
    type WorkspacePlanState,
} from "./plans"

/**
 * Resolve a workspace's current plan tier and status. Workspaces with no
 * billing record default to "free / active". A plan that's `past_due`
 * for more than 14 days demotes to "free" so we don't silently keep
 * paid features running indefinitely on a card that's failed forever.
 */
export async function getWorkspacePlan(workspaceId: string): Promise<WorkspacePlanState> {
    if (!workspaceId) {
        return {
            tier: "free",
            status: "active",
            expiresAt: null,
            extraSeats: 0,
            stripeSubscriptionId: null,
        }
    }
    const snap = await adminDb.collection("workspaces").doc(workspaceId).get()
    const data = snap.data() || {}
    const rawTier = (data.plan as PlanTier | undefined) || "free"
    const tier: PlanTier = rawTier in PLANS ? rawTier : "free"
    const status: PlanStatus = (data.planStatus as PlanStatus | undefined) || "active"
    const expiresAt = data.planExpiresAt
        ? typeof data.planExpiresAt === "string"
            ? data.planExpiresAt
            : data.planExpiresAt?.toDate?.()?.toISOString() || null
        : null
    const extraSeats = typeof data.extraSeats === "number" ? data.extraSeats : 0
    const stripeSubscriptionId = data.stripeSubscriptionId || null

    // Soft-demote workspaces stuck in past_due for more than 14 days.
    if (status === "past_due" && expiresAt) {
        const overdueDays =
            (Date.now() - new Date(expiresAt).getTime()) / (1000 * 60 * 60 * 24)
        if (overdueDays > 14) {
            return {
                tier: "free",
                status: "past_due",
                expiresAt,
                extraSeats,
                stripeSubscriptionId,
            }
        }
    }

    // Canceled subscriptions become free immediately at period end.
    if (status === "canceled" && expiresAt && new Date(expiresAt).getTime() < Date.now()) {
        return { tier: "free", status: "canceled", expiresAt, extraSeats, stripeSubscriptionId }
    }

    return { tier, status, expiresAt, extraSeats, stripeSubscriptionId }
}

/**
 * Throws PlanNotAllowedError if the workspace's tier is below `required`.
 * Use inside server actions:
 *
 *     await requirePlan(workspaceId, "pro", "Automations")
 */
export async function requirePlan(
    workspaceId: string,
    required: PlanTier,
    featureLabel?: string,
): Promise<WorkspacePlanState> {
    const state = await getWorkspacePlan(workspaceId)
    if (!meetsPlan(state.tier, required)) {
        throw new PlanNotAllowedError(required, state.tier, featureLabel)
    }
    return state
}
