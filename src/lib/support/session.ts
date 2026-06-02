import "server-only"
import { cookies } from "next/headers"
import { findGrantByToken, bumpGrantUsage, type SupportGrant } from "./grants"

export const SUPPORT_COOKIE = "vesta-support-session"

export interface ActiveSupportSession {
    grant: SupportGrant
    actAsWorkspaceId: string
    rawToken: string
}

/**
 * Resolve the active support session for the current request, if any.
 * Reads the support cookie + agent email and validates against the
 * grant doc. Returns null if no cookie, invalid token, mismatched
 * agent, or grant expired/revoked.
 */
export async function getActiveSupportSession(
    agentEmail: string | null | undefined,
): Promise<ActiveSupportSession | null> {
    if (!agentEmail) return null
    const jar = await cookies()
    const raw = jar.get(SUPPORT_COOKIE)?.value
    if (!raw) return null
    const found = await findGrantByToken(raw, agentEmail)
    if (!found) return null
    // Don't await — usage bump is non-blocking.
    bumpGrantUsage(found.grant.id).catch(() => {})
    return {
        grant: found.grant,
        actAsWorkspaceId: found.grant.workspaceId,
        rawToken: raw,
    }
}
