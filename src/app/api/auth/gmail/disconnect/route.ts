import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"

/**
 * Removes the per-user Gmail integration record. Called from the
 * "Disconnect" button on the Integrations page. Doesn't revoke the OAuth
 * grant on Google's side — that's a one-click step in the user's Google
 * account, and re-running our OAuth flow will issue a fresh token anyway.
 */
export async function POST() {
    try {
        const session = await getAuthSession()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        const workspaceId = (session.user as { workspaceId?: string }).workspaceId
        const dbUserId = (session.user as { id?: string }).id
        if (!workspaceId || !dbUserId) {
            return new NextResponse("Missing workspace or user", { status: 400 })
        }

        const docId = `${workspaceId}_${dbUserId}`
        await adminDb.collection("gmail_integrations").doc(docId).delete()
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Gmail disconnect error:", error)
        return new NextResponse("Internal API Error", { status: 500 })
    }
}
