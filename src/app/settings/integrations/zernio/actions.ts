"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-guard"
import { disconnect, refreshLinkedAccounts } from "@/lib/zernio/sub-accounts"
import { ZernioError } from "@/lib/zernio/client"

async function getWorkspaceId(): Promise<string> {
    const session = await requireAdmin()
    return (session.user as { workspaceId: string }).workspaceId
}

export async function refreshZernioConnection() {
    const workspaceId = await getWorkspaceId()
    try {
        const updated = await refreshLinkedAccounts(workspaceId)
        revalidatePath("/settings/integrations/zernio")
        revalidatePath("/marketing/social")
        return { success: true, connection: updated }
    } catch (err) {
        if (err instanceof ZernioError) {
            return { success: false, error: `Zernio ${err.status}: ${err.message}` }
        }
        const message = err instanceof Error ? err.message : "Failed to refresh"
        return { success: false, error: message }
    }
}

export async function disconnectZernio() {
    const workspaceId = await getWorkspaceId()
    try {
        await disconnect(workspaceId)
        revalidatePath("/settings/integrations/zernio")
        revalidatePath("/marketing/social")
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to disconnect"
        return { success: false, error: message }
    }
}
