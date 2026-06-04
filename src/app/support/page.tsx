import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { isSupportAgentEmail } from "@/lib/support/grants"
import { SupportRedeemForm } from "./SupportRedeemForm"

export const dynamic = "force-dynamic"

export const metadata = { title: "Support session · AFCrashpad" }

export default async function SupportPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    if (!isSupportAgentEmail(session.user.email)) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center p-6">
                <div className="max-w-md text-center space-y-3">
                    <h1 className="text-xl font-semibold">Not a support agent</h1>
                    <p className="text-sm text-muted-foreground">
                        This page is restricted to allowlisted support agents. If you should
                        have access, ask the operator to add your email to
                        {" "}
                        <code className="text-xs">SUPPORT_AGENT_EMAILS</code>.
                    </p>
                </div>
            </div>
        )
    }

    const u = session.user as unknown as Record<string, unknown>
    const active = u.supportGrantId
        ? {
              workspaceId: u.actAsWorkspaceId as string,
              expiresAt: u.supportExpiresAt as string,
              grantedBy: u.supportGrantedByEmail as string,
          }
        : null

    return (
        <div className="min-h-[100dvh] flex items-center justify-center p-6">
            <div className="w-full max-w-md space-y-6">
                <header className="text-center">
                    <h1 className="text-2xl font-semibold tracking-tight">Support session</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Signed in as {session.user.email}
                    </p>
                </header>
                <SupportRedeemForm activeSession={active} />
            </div>
        </div>
    )
}
