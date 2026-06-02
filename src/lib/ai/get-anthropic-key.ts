import { tenantDb } from "@/lib/tenant-db"

/**
 * Resolve the Anthropic API key to use for a given workspace.
 *
 * Priority:
 *   1. Per-workspace key saved at settings/integrations.anthropic.apiKey
 *      (set by OWNER/ADMIN on the Integrations page).
 *   2. Process-wide ANTHROPIC_API_KEY (Vesta-operated fallback).
 *
 * Returning null means neither is configured — callers should surface a
 * "configure your AI key" error rather than crash.
 *
 * Per-workspace keys decouple cost/usage from Vesta's account: a customer
 * who pastes their own key gets billed by Anthropic directly and isn't
 * sharing rate-limit budget with other workspaces. The env-var fallback
 * stays in place so single-tenant deploys + dev environments still work.
 */
export async function getAnthropicKey(workspaceId: string | null | undefined): Promise<string | null> {
    if (workspaceId) {
        try {
            const db = tenantDb(workspaceId)
            const doc = await db.settingsDoc("integrations").get()
            const data = doc.exists ? doc.data() : null
            const wsKey = (data?.anthropic as { apiKey?: string } | undefined)?.apiKey
            if (wsKey && typeof wsKey === "string" && wsKey.trim()) {
                return wsKey.trim()
            }
        } catch {
            // Fall through to env-var fallback
        }
    }
    const envKey = process.env.ANTHROPIC_API_KEY
    return envKey && envKey.trim() ? envKey.trim() : null
}
