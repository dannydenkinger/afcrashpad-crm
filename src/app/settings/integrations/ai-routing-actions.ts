"use server"

import { z } from "zod"
import { tenantDb } from "@/lib/tenant-db"
import { requireAdmin, requireAuth } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import type { AIRoutingMap, AIProvider } from "@/lib/ai/types"

const PROVIDER_VALUES: AIProvider[] = ["anthropic", "openai", "gemini"]
const FEATURE_VALUES = [
    "assistant",
    "blog_generation",
    "automation_email",
    "automation_classify",
    "automation_score",
    "automation_summarize",
    "haro_reply",
    "inline_email_writer",
    "inline_sms_writer",
    "subject_line",
    "deal_summary",
    "next_step_suggestion",
] as const

const updateRouteSchema = z.object({
    feature: z.enum(FEATURE_VALUES),
    provider: z.enum(["anthropic", "openai", "gemini"]),
    model: z.string().max(120),
})

export async function getAIRouting(): Promise<{ success: boolean; routing?: AIRoutingMap; error?: string }> {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        if (!workspaceId) return { success: false, error: "No workspace" }
        const db = tenantDb(workspaceId)
        const doc = await db.settingsDoc("integrations").get()
        const data = doc.exists ? doc.data() : null
        const routing = (data?.ai_routing as AIRoutingMap | undefined) || {}
        return { success: true, routing }
    } catch (err) {
        console.error("[ai] getAIRouting error:", err)
        return { success: false, error: "Failed to load routing" }
    }
}

export async function updateAIRoute(input: { feature: string; provider: string; model: string }) {
    const parsed = updateRouteSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    if (!workspaceId) return { success: false, error: "No workspace" }

    try {
        const db = tenantDb(workspaceId)
        // Read-modify-write because we're updating a single key inside a map.
        const doc = await db.settingsDoc("integrations").get()
        const data = doc.exists ? doc.data() : {}
        const routing = (data?.ai_routing as AIRoutingMap | undefined) || {}
        routing[parsed.data.feature] = {
            provider: parsed.data.provider,
            model: parsed.data.model,
        }
        await db.settingsDoc("integrations").set(
            {
                ai_routing: routing,
                updatedAt: new Date().toISOString(),
            },
            { merge: true },
        )
        revalidatePath("/settings/integrations")
        return { success: true }
    } catch (err) {
        console.error("[ai] updateAIRoute error:", err)
        return { success: false, error: "Failed to save" }
    }
}

/** Reset a feature's routing to "use the default" by removing its entry. */
export async function resetAIRoute(feature: string) {
    const parsed = z.enum(FEATURE_VALUES).safeParse(feature)
    if (!parsed.success) return { success: false, error: "Invalid feature" }

    const session = await requireAdmin()
    const workspaceId = session.user.workspaceId
    if (!workspaceId) return { success: false, error: "No workspace" }

    try {
        const db = tenantDb(workspaceId)
        const doc = await db.settingsDoc("integrations").get()
        const data = doc.exists ? doc.data() : {}
        const routing = (data?.ai_routing as AIRoutingMap | undefined) || {}
        delete routing[parsed.data]
        await db.settingsDoc("integrations").set(
            {
                ai_routing: routing,
                updatedAt: new Date().toISOString(),
            },
            { merge: true },
        )
        revalidatePath("/settings/integrations")
        return { success: true }
    } catch (err) {
        console.error("[ai] resetAIRoute error:", err)
        return { success: false, error: "Failed to reset" }
    }
}

/** Aggregate AI usage for the current workspace over the last N days. */
export async function getAIUsageSummary(days: number = 30) {
    try {
        const session = await requireAuth()
        const workspaceId = session.user.workspaceId
        if (!workspaceId) return { success: false, error: "No workspace" }
        const cutoff = new Date(Date.now() - days * 86400 * 1000)

        const { adminDb } = await import("@/lib/firebase-admin")
        const snap = await adminDb
            .collection("workspaces")
            .doc(workspaceId)
            .collection("ai_usage_logs")
            .where("createdAt", ">=", cutoff)
            .get()

        const byFeature: Record<string, { calls: number; inputTokens: number; outputTokens: number }> = {}
        let totalCalls = 0
        let totalInput = 0
        let totalOutput = 0
        for (const d of snap.docs) {
            const r = d.data()
            const f = (r.feature as string) || "unknown"
            if (!byFeature[f]) byFeature[f] = { calls: 0, inputTokens: 0, outputTokens: 0 }
            byFeature[f].calls++
            byFeature[f].inputTokens += Number(r.inputTokens) || 0
            byFeature[f].outputTokens += Number(r.outputTokens) || 0
            totalCalls++
            totalInput += Number(r.inputTokens) || 0
            totalOutput += Number(r.outputTokens) || 0
        }

        return {
            success: true,
            totalCalls,
            totalInputTokens: totalInput,
            totalOutputTokens: totalOutput,
            byFeature,
        }
    } catch (err) {
        console.error("[ai] getAIUsageSummary error:", err)
        return { success: false, error: "Failed to load usage" }
    }
}
