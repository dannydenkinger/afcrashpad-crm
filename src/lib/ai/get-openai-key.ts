import { tenantDb } from "@/lib/tenant-db"

/**
 * Resolve the OpenAI API key for a workspace.
 *
 * Priority:
 *   1. Per-workspace key at settings/integrations.openai.apiKey
 *   2. Process-wide OPENAI_API_KEY env var (single-tenant fallback)
 *
 * Returns null when neither is configured. Mirrors getAnthropicKey so call
 * sites can offer either provider without branching on key resolution.
 */
export async function getOpenAIKey(workspaceId: string | null | undefined): Promise<string | null> {
    if (workspaceId) {
        try {
            const db = tenantDb(workspaceId)
            const doc = await db.settingsDoc("integrations").get()
            const data = doc.exists ? doc.data() : null
            const wsKey = (data?.openai as { apiKey?: string } | undefined)?.apiKey
            if (wsKey && typeof wsKey === "string" && wsKey.trim()) {
                return wsKey.trim()
            }
        } catch {
            // Fall through to env-var fallback
        }
    }
    const envKey = process.env.OPENAI_API_KEY
    return envKey && envKey.trim() ? envKey.trim() : null
}
