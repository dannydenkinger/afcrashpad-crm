/**
 * Public one-click unsubscribe page. No auth required — token is HMAC-signed
 * so we trust it once it verifies. Hits the suppression list immediately on
 * load (Mailchimp-style "you've been unsubscribed" page) and offers a
 * "re-subscribe" button so accidental unsubs aren't permanent.
 */

import { adminDb } from "@/lib/firebase-admin"
import { addSuppression } from "@/lib/email/suppressions"
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe"
import { UnsubClient } from "./UnsubClient"

export const dynamic = "force-dynamic"

interface PageProps {
    params: Promise<{ token: string }>
}

export default async function UnsubscribePage({ params }: PageProps) {
    const { token } = await params
    const parsed = verifyUnsubscribeToken(token)

    if (!parsed) {
        return <UnsubError message="This unsubscribe link is invalid or has been tampered with." />
    }

    // Fetch the workspace name so the page reads naturally ("You've
    // unsubscribed from Acme Inc." instead of a bare workspaceId).
    const wsDoc = await adminDb
        .collection("workspaces")
        .doc(parsed.workspaceId)
        .get()
    const workspaceName = (wsDoc.data()?.name as string) || "this sender"

    // Suppress immediately on page load. One click, no extra confirmation —
    // matches modern email-tool norms and ensures we honor RFC 8058 even if
    // the user closes the tab.
    try {
        await addSuppression({
            workspaceId: parsed.workspaceId,
            email: parsed.email,
            reason: "unsubscribe",
            source: "one-click-link",
            sourceCampaignId: parsed.campaignId,
        })
    } catch (err) {
        console.error("[unsub] suppression write failed:", err)
    }

    return (
        <UnsubClient
            email={parsed.email}
            workspaceId={parsed.workspaceId}
            workspaceName={workspaceName}
            token={token}
        />
    )
}

function UnsubError({ message }: { message: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center text-2xl">
                    !
                </div>
                <h1 className="text-xl font-semibold text-slate-900">Link issue</h1>
                <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
            </div>
        </div>
    )
}
