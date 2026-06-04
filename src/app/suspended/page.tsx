import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { auth } from "@/auth"
import { adminDb } from "@/lib/firebase-admin"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"
export const metadata = { title: "Workspace suspended · AFCrashpad" }

function toIso(ts: unknown): string | null {
    if (!ts) return null
    if (typeof ts === "string") return ts
    if (ts instanceof Date) return ts.toISOString()
    const t = ts as { toDate?: () => Date }
    if (typeof t.toDate === "function") return t.toDate().toISOString()
    return null
}

export default async function SuspendedPage() {
    const session = await auth()
    if (!session?.user?.email) redirect("/login")

    let workspaceName = ""
    let reason: string | null = null
    let suspendedAt: string | null = null
    const workspaceId = (session.user as { workspaceId?: string }).workspaceId
    if (workspaceId) {
        const snap = await adminDb.collection("workspaces").doc(workspaceId).get()
        const data = snap.data() || {}
        // If the workspace ISN'T actually suspended any more, bounce
        // them back to the app.
        if ((data.status as string) !== "suspended") redirect("/dashboard")
        workspaceName = (data.name as string) || ""
        reason = (data.suspendedReason as string) || null
        suspendedAt = toIso(data.suspendedAt)
    }

    return (
        <div className="min-h-[100dvh] flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-4">
                <div className="mx-auto h-12 w-12 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <ShieldAlert className="h-6 w-6" />
                </div>
                <div className="space-y-1 text-center">
                    <h1 className="text-xl font-semibold">Workspace suspended</h1>
                    {workspaceName && (
                        <p className="text-sm text-muted-foreground">
                            {workspaceName} is currently locked.
                        </p>
                    )}
                </div>
                {reason && (
                    <div className="rounded-md border bg-background/40 p-3 text-xs">
                        <div className="font-semibold mb-1">Reason</div>
                        <p className="text-muted-foreground">{reason}</p>
                    </div>
                )}
                <p className="text-xs text-muted-foreground text-center">
                    {suspendedAt && (
                        <>
                            Suspended {new Date(suspendedAt).toLocaleString()}.{" "}
                        </>
                    )}
                    Reach out to support to reactivate.
                </p>
                <div className="flex justify-center gap-2">
                    <a
                        href="mailto:afcrashpad@gmail.com"
                        className="text-xs px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium"
                    >
                        Contact support
                    </a>
                    <Link
                        href="/api/auth/signout"
                        className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted"
                    >
                        Sign out
                    </Link>
                </div>
            </div>
        </div>
    )
}
