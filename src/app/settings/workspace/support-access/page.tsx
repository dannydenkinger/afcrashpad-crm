import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-guard"
import { listGrantsForWorkspace } from "@/lib/support/grants"
import { listSupportAuditForWorkspace } from "@/lib/support/audit"
import { SupportAccessClient } from "./SupportAccessClient"

export const dynamic = "force-dynamic"

export default async function SupportAccessPage() {
    const session = await getAuthSession()
    if (!session?.user?.email) redirect("/login")
    if (session.user.role !== "OWNER" && session.user.role !== "ADMIN") {
        redirect("/settings")
    }

    // If we somehow landed here from inside a support session, use
    // the original workspace's id so the agent doesn't accidentally
    // manage the wrong workspace's grants.
    const workspaceId =
        ((session.user as unknown as Record<string, unknown>).originalWorkspaceId as string) ||
        session.user.workspaceId

    const [grants, audit] = await Promise.all([
        listGrantsForWorkspace(workspaceId),
        listSupportAuditForWorkspace(workspaceId, 50),
    ])

    return (
        <div className="container mx-auto max-w-3xl py-6 px-4">
            <div className="pb-4 border-b mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">Support access</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Grant a time-bound, audited login to the AFCrashpad support team. They&apos;ll
                    act inside your workspace exactly as you would; every action is logged
                    below. Revoke any time.
                </p>
            </div>
            <SupportAccessClient
                initialGrants={grants}
                initialAudit={audit}
                isOwner={session.user.role === "OWNER"}
            />
        </div>
    )
}
