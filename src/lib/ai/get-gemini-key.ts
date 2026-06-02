import { tenantDb } from "@/lib/tenant-db"

/**
 * Resolve the Google Gemini API key for a workspace.
 *
 * Priority:
 *   1. Per-workspace key at settings/integrations.gemini.apiKey
 *   2. Process-wide GOOGLE_GEMINI_API_KEY env var (single-tenant fallback)
 *
 * Returns null when neither is configured. Mirrors getAnthropicKey /
 * getOpenAIKey so call sites can route to any provider without bespoke
 * key plumbing per provider.
 */
export async function getGeminiKey(workspaceId: string | null | undefined): Promise<string | null> {
    if (workspaceId) {
        try {
            const db = tenantDb(workspaceId)
            const doc = await db.settingsDoc("integrations").get()
            const data = doc.exists ? doc.data() : null
            const wsKey = (data?.gemini as { apiKey?: string } | undefined)?.apiKey
            if (wsKey && typeof wsKey === "string" && wsKey.trim()) {
                return wsKey.trim()
            }
        } catch {
            // Fall through to env-var fallback
        }
    }
    const envKey = process.env.GOOGLE_GEMINI_API_KEY
    return envKey && envKey.trim() ? envKey.trim() : null
}
