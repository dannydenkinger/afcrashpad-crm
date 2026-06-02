"use server"

import { z } from "zod"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import { requireOperator } from "@/lib/admin/guard"
import { logOperatorAction } from "@/lib/admin/operator-audit"
import { purgeWorkspace } from "@/lib/admin/purge-workspace"
import { grant as grantCredits } from "@/lib/credits/email-credits"
import { getStripe, isStripeConfigured } from "@/lib/billing/credit-topups"
import { revalidatePath } from "next/cache"
import { PLANS, type PlanTier } from "@/lib/billing/plans"

const workspaceIdSchema = z.string().min(1).max(128)

const setPlanSchema = z.object({
    workspaceId: workspaceIdSchema,
    tier: z.enum(["free", "pro", "max"]),
})

/**
 * Operator-issued comp upgrade. Bypasses Stripe — sets workspace.plan
 * directly. Used for granting beta testers paid features without
 * billing them. To revert, set tier back to "free".
 *
 * If the workspace has an active Stripe subscription, this DOES NOT
 * cancel it — operator should cancel separately via "cancelStripe".
 */
export async function setWorkspacePlanComp(input: z.infer<typeof setPlanSchema>) {
    const session = await requireOperator()
    const parsed = setPlanSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const ref = adminDb.collection("workspaces").doc(parsed.data.workspaceId)
    const before = (await ref.get()).data()?.plan as PlanTier | undefined

    await ref.update({
        plan: parsed.data.tier,
        planStatus: "active",
        planExpiresAt: null,
        updatedAt: new Date(),
    })

    await logOperatorAction({
        operatorEmail: session.user?.email ?? "unknown",
        workspaceId: parsed.data.workspaceId,
        action: "comp_plan_change",
        params: { from: before ?? "unknown", to: parsed.data.tier },
    })

    revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`)
    return { success: true }
}

const addCreditsSchema = z.object({
    workspaceId: workspaceIdSchema,
    amount: z.number().int().positive().max(1_000_000),
    note: z.string().max(200).optional(),
})

export async function addEmailCreditsOperator(input: z.infer<typeof addCreditsSchema>) {
    const session = await requireOperator()
    const parsed = addCreditsSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const note = parsed.data.note?.trim() || `operator grant by ${session.user?.email}`
    const refId = `operator:${session.user?.email}:${Date.now()}`
    const newBalance = await grantCredits(
        parsed.data.workspaceId,
        parsed.data.amount,
        note,
        refId,
    )

    await logOperatorAction({
        operatorEmail: session.user?.email ?? "unknown",
        workspaceId: parsed.data.workspaceId,
        action: "add_credits",
        params: { amount: parsed.data.amount, newBalance, note },
    })

    revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`)
    return { success: true, newBalance }
}

const cancelStripeSchema = z.object({
    workspaceId: workspaceIdSchema,
})

export async function cancelStripeSubscriptionOperator(
    input: z.infer<typeof cancelStripeSchema>,
) {
    const session = await requireOperator()
    const parsed = cancelStripeSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    if (!isStripeConfigured()) return { success: false, error: "Stripe not configured" }

    const wsSnap = await adminDb.collection("workspaces").doc(parsed.data.workspaceId).get()
    const subId = wsSnap.data()?.stripeSubscriptionId as string | undefined
    if (!subId) return { success: false, error: "No active subscription on this workspace" }

    try {
        const stripe = getStripe()
        await stripe.subscriptions.cancel(subId)
    } catch (err) {
        const message = err instanceof Error ? err.message : "Stripe cancel failed"
        return { success: false, error: message }
    }

    await logOperatorAction({
        operatorEmail: session.user?.email ?? "unknown",
        workspaceId: parsed.data.workspaceId,
        action: "cancel_stripe_subscription",
        params: { subId },
    })

    revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`)
    return { success: true }
}

const suspendSchema = z.object({
    workspaceId: workspaceIdSchema,
    suspended: z.boolean(),
    reason: z.string().max(200).optional(),
})

export async function setWorkspaceSuspended(input: z.infer<typeof suspendSchema>) {
    const session = await requireOperator()
    const parsed = suspendSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const ref = adminDb.collection("workspaces").doc(parsed.data.workspaceId)
    await ref.update({
        status: parsed.data.suspended ? "suspended" : "active",
        suspendedReason: parsed.data.suspended ? parsed.data.reason ?? null : FieldValue.delete(),
        suspendedAt: parsed.data.suspended ? new Date() : FieldValue.delete(),
        suspendedBy: parsed.data.suspended ? session.user?.email ?? null : FieldValue.delete(),
        updatedAt: new Date(),
    })

    await logOperatorAction({
        operatorEmail: session.user?.email ?? "unknown",
        workspaceId: parsed.data.workspaceId,
        action: parsed.data.suspended ? "suspend" : "unsuspend",
        params: parsed.data.suspended ? { reason: parsed.data.reason ?? null } : {},
    })

    revalidatePath(`/admin/workspaces/${parsed.data.workspaceId}`)
    return { success: true }
}

const purgeSchema = z.object({
    workspaceId: workspaceIdSchema,
    confirmName: z.string().min(1).max(200),
})

export async function forcePurgeWorkspaceNow(input: z.infer<typeof purgeSchema>) {
    const session = await requireOperator()
    const parsed = purgeSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const ref = adminDb.collection("workspaces").doc(parsed.data.workspaceId)
    const snap = await ref.get()
    if (!snap.exists) return { success: false, error: "Workspace not found" }
    const wsName = (snap.data()?.name as string) || ""
    if (parsed.data.confirmName.trim() !== wsName) {
        return {
            success: false,
            error: `Confirmation didn't match — type "${wsName}" exactly`,
        }
    }

    // Audit BEFORE purge — log row would also be deleted if we
    // logged after, since audit_logs is workspace-scoped and the
    // purge clears it. Operator audit lives in a separate
    // collection (operator_audit_log) so it survives.
    await logOperatorAction({
        operatorEmail: session.user?.email ?? "unknown",
        workspaceId: parsed.data.workspaceId,
        action: "force_purge_now",
        params: { wsName },
    })

    const result = await purgeWorkspace(parsed.data.workspaceId)
    return { success: true, result }
}
