"use server"

import { getActiveSupportSession } from "@/lib/support/session"
import { getAuthSession } from "@/lib/auth-guard"

export interface SupportSessionInfo {
    grantId: string
    workspaceId: string
    expiresAt: string
    grantedByEmail: string
}

/**
 * Client-callable: returns the currently active support session for
 * the signed-in user, or null. The SupportSessionBanner uses this
 * to render the warning bar — needed because useSession() doesn't
 * see the server-side augmentation we apply in getAuthSession.
 */
export async function getActiveSupportInfo(): Promise<SupportSessionInfo | null> {
    const session = await getAuthSession()
    if (!session?.user?.email) return null
    const support = await getActiveSupportSession(session.user.email)
    if (!support) return null
    return {
        grantId: support.grant.id,
        workspaceId: support.grant.workspaceId,
        expiresAt: support.grant.expiresAt,
        grantedByEmail: support.grant.grantedByEmail,
    }
}
