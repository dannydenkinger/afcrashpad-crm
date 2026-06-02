"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"
import {
    createIdentity,
    deleteIdentity,
    getIdentity,
    refreshStatus,
    updateFromAddress,
} from "@/lib/ses/identities"
import { grant as grantCredits, getBalance, InsufficientCreditsError } from "@/lib/credits/email-credits"
import { sendEmail, SesIdentityNotReadyError } from "@/lib/ses/sender"
import {
    CREDIT_PACKS,
    StripeNotConfiguredError,
    createCheckoutSession,
    isStripeConfigured,
} from "@/lib/billing/credit-topups"
import { headers } from "next/headers"

async function getAdminWorkspaceId(): Promise<string> {
    const session = await requireAdmin()
    return (session.user as { workspaceId: string }).workspaceId
}

async function getAdminContext(): Promise<{ workspaceId: string; userId: string }> {
    const session = await requireAdmin()
    const user = session.user as { id: string; workspaceId: string }
    return { workspaceId: user.workspaceId, userId: user.id }
}

const setupSchema = z.object({
    identity: z.string().min(3).max(253),
    fromAddress: z.string().email().optional(),
    fromName: z.string().max(100).optional(),
})

export async function setupSesIdentity(input: z.infer<typeof setupSchema>) {
    const workspaceId = await getAdminWorkspaceId()

    const parsed = setupSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    try {
        const config = await createIdentity(workspaceId, parsed.data.identity, {
            fromAddress: parsed.data.fromAddress,
            fromName: parsed.data.fromName,
        })
        revalidatePath("/settings/integrations/ses")
        return { success: true, config }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create SES identity"
        console.error("[SES] setupSesIdentity error:", err)
        return { success: false, error: message }
    }
}

export async function refreshSesStatus() {
    const workspaceId = await getAdminWorkspaceId()

    try {
        const config = await refreshStatus(workspaceId)
        revalidatePath("/settings/integrations/ses")
        return { success: true, config }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to refresh SES status"
        console.error("[SES] refreshSesStatus error:", err)
        return { success: false, error: message }
    }
}

export async function deleteSesIdentity() {
    const workspaceId = await getAdminWorkspaceId()

    try {
        await deleteIdentity(workspaceId)
        revalidatePath("/settings/integrations/ses")
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete SES identity"
        console.error("[SES] deleteSesIdentity error:", err)
        return { success: false, error: message }
    }
}

const fromSchema = z.object({
    fromAddress: z.string().email(),
    fromName: z.string().max(100).optional(),
})

export async function updateSesFromAddress(input: z.infer<typeof fromSchema>) {
    const workspaceId = await getAdminWorkspaceId()

    const parsed = fromSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    try {
        const config = await updateFromAddress(
            workspaceId,
            parsed.data.fromAddress,
            parsed.data.fromName,
        )
        revalidatePath("/settings/integrations/ses")
        return { success: true, config }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update from address"
        return { success: false, error: message }
    }
}

export async function getSesPageData() {
    const workspaceId = await getAdminWorkspaceId()
    const [identity, balance] = await Promise.all([
        getIdentity(workspaceId),
        getBalance(workspaceId),
    ])
    return { identity, balance }
}

const grantSchema = z.object({
    amount: z.number().int().positive().max(1_000_000),
    note: z.string().max(200).optional(),
})

const testSendSchema = z.object({
    to: z.string().email(),
    subject: z.string().min(1).max(200).default("Test from Vesta CRM"),
    message: z.string().min(1).max(5000).default("This is a test email from your CRM's SES integration."),
})

export async function sendTestEmail(input: z.infer<typeof testSendSchema>) {
    const workspaceId = await getAdminWorkspaceId()
    const parsed = testSendSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    const { to, subject, message } = parsed.data
    const html = `<!DOCTYPE html><html><body style="font-family: sans-serif; color: #111;"><p>${message.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p><hr><p style="font-size:12px;color:#888;">Sent via Amazon SES integration on Vesta CRM.</p></body></html>`
    const text = `${message}\n\n--\nSent via Amazon SES integration on Vesta CRM.`

    try {
        const result = await sendEmail({
            workspaceId,
            to,
            subject,
            html,
            text,
        })
        revalidatePath("/settings/integrations/ses")
        return {
            success: result.ok,
            error: result.error,
            messageId: result.messageId,
            balanceAfter: result.balanceAfter,
            emailLogId: result.emailLogId,
        }
    } catch (err) {
        if (err instanceof SesIdentityNotReadyError) {
            return { success: false, error: `SES identity is not ready (${err.status}). Verify the domain first.` }
        }
        if (err instanceof InsufficientCreditsError) {
            return { success: false, error: `Insufficient credits (${err.available} available). Grant credits first.` }
        }
        const message = err instanceof Error ? err.message : "Failed to send"
        console.error("[SES] sendTestEmail error:", err)
        return { success: false, error: message }
    }
}

export async function getCreditPacks() {
    return {
        configured: isStripeConfigured(),
        packs: CREDIT_PACKS.map((p) => ({
            sku: p.sku,
            label: p.label,
            credits: p.credits,
            priceDisplay: formatMoney(p.amountCents, p.currency),
        })),
    }
}

const topupSchema = z.object({ packSku: z.string().min(1) })

export async function startCreditTopup(input: z.infer<typeof topupSchema>) {
    const { workspaceId, userId } = await getAdminContext()
    const parsed = topupSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid pack" }

    try {
        const hdrs = await headers()
        const origin =
            process.env.NEXT_PUBLIC_APP_URL ||
            hdrs.get("origin") ||
            hdrs.get("x-forwarded-host")?.replace(/^/, "https://")
        if (!origin) {
            return { success: false, error: "NEXT_PUBLIC_APP_URL is not set" }
        }

        const { url } = await createCheckoutSession({
            workspaceId,
            packSku: parsed.data.packSku,
            userId,
            origin,
        })
        return { success: true, url }
    } catch (err) {
        if (err instanceof StripeNotConfiguredError) {
            return { success: false, error: err.message }
        }
        const message = err instanceof Error ? err.message : "Failed to create checkout"
        console.error("[SES] startCreditTopup error:", err)
        return { success: false, error: message }
    }
}

function formatMoney(cents: number, currency: string): string {
    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
    })
    return formatter.format(cents / 100)
}

export async function grantTestCredits(input: z.infer<typeof grantSchema>) {
    const workspaceId = await getAdminWorkspaceId()

    const parsed = grantSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    try {
        const balanceAfter = await grantCredits(
            workspaceId,
            parsed.data.amount,
            parsed.data.note ?? "Manual grant from settings",
        )
        revalidatePath("/settings/integrations/ses")
        return { success: true, balanceAfter }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to grant credits"
        return { success: false, error: message }
    }
}
