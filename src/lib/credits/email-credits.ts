import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import type { CreditLedgerReason } from "@/types"

export class InsufficientCreditsError extends Error {
    constructor(public workspaceId: string, public requested: number, public available: number) {
        super(`Insufficient email credits: requested ${requested}, available ${available}`)
        this.name = "InsufficientCreditsError"
    }
}

export async function getBalance(workspaceId: string): Promise<number> {
    if (!workspaceId) throw new Error("workspaceId required")
    const snap = await adminDb.collection("workspaces").doc(workspaceId).get()
    if (!snap.exists) throw new Error(`workspace ${workspaceId} not found`)
    const raw = snap.data()?.email_credit_balance
    return typeof raw === "number" ? raw : 0
}

interface MutateOptions {
    workspaceId: string
    delta: number
    reason: CreditLedgerReason
    refId?: string
    note?: string
    requireSufficient?: boolean
}

async function mutateBalance(opts: MutateOptions): Promise<number> {
    const { workspaceId, delta, reason, refId, note, requireSufficient } = opts
    if (!workspaceId) throw new Error("workspaceId required")
    if (!Number.isFinite(delta) || delta === 0) throw new Error("delta must be a non-zero finite number")

    const workspaceRef = adminDb.collection("workspaces").doc(workspaceId)
    const ledgerRef = adminDb.collection("credit_ledger").doc()

    const balanceAfter = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(workspaceRef)
        if (!snap.exists) throw new Error(`workspace ${workspaceId} not found`)
        const current = typeof snap.data()?.email_credit_balance === "number"
            ? (snap.data()!.email_credit_balance as number)
            : 0
        const next = current + delta
        if (requireSufficient && next < 0) {
            throw new InsufficientCreditsError(workspaceId, Math.abs(delta), current)
        }
        tx.update(workspaceRef, {
            email_credit_balance: next,
            updatedAt: new Date(),
        })
        tx.set(ledgerRef, {
            workspaceId,
            delta,
            balanceAfter: next,
            reason,
            refId: refId ?? null,
            note: note ?? null,
            createdAt: FieldValue.serverTimestamp(),
        })
        return next
    })

    return balanceAfter
}

export async function deduct(
    workspaceId: string,
    amount: number,
    refId: string,
    note?: string,
): Promise<number> {
    if (amount <= 0) throw new Error("deduct amount must be positive")
    return mutateBalance({
        workspaceId,
        delta: -amount,
        reason: "send",
        refId,
        note,
        requireSufficient: true,
    })
}

export async function refund(
    workspaceId: string,
    amount: number,
    refId: string,
    note?: string,
): Promise<number> {
    if (amount <= 0) throw new Error("refund amount must be positive")
    return mutateBalance({
        workspaceId,
        delta: amount,
        reason: "refund",
        refId,
        note,
    })
}

export async function grant(
    workspaceId: string,
    amount: number,
    note?: string,
    refId?: string,
): Promise<number> {
    if (amount <= 0) throw new Error("grant amount must be positive")
    return mutateBalance({
        workspaceId,
        delta: amount,
        reason: "grant",
        refId,
        note,
    })
}
