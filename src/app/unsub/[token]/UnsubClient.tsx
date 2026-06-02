"use client"

import { useState, useTransition } from "react"
import { resubscribeAction } from "./actions"

export function UnsubClient({
    email,
    workspaceId,
    workspaceName,
    token,
}: {
    email: string
    workspaceId: string
    workspaceName: string
    token: string
}) {
    const [resubscribed, setResubscribed] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleResubscribe = () => {
        startTransition(async () => {
            const res = await resubscribeAction({ token })
            if (!res.success) {
                setError(res.error || "Failed to resubscribe")
                return
            }
            setResubscribed(true)
        })
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 space-y-5 text-center">
                {resubscribed ? (
                    <>
                        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl">
                            ✓
                        </div>
                        <h1 className="text-xl font-semibold text-slate-900">
                            You&apos;re re-subscribed
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            <span className="font-medium text-slate-900">{email}</span> will receive
                            emails from <span className="font-medium text-slate-900">{workspaceName}</span> again.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="w-14 h-14 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl">
                            ✓
                        </div>
                        <h1 className="text-xl font-semibold text-slate-900">
                            You&apos;ve been unsubscribed
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            <span className="font-medium text-slate-900">{email}</span> won&apos;t receive any
                            more emails from{" "}
                            <span className="font-medium text-slate-900">{workspaceName}</span>.
                        </p>

                        <div className="pt-3 border-t border-slate-100 space-y-3">
                            <p className="text-xs text-slate-400">Changed your mind?</p>
                            <button
                                type="button"
                                onClick={handleResubscribe}
                                disabled={isPending}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {isPending ? "Re-subscribing…" : "Re-subscribe"}
                            </button>
                            {error && (
                                <p className="text-xs text-red-600">{error}</p>
                            )}
                        </div>
                    </>
                )}

                <div className="pt-4 text-[10px] uppercase tracking-wider text-slate-300">
                    Workspace ID: <span className="font-mono">{workspaceId.slice(0, 8)}…</span>
                </div>
            </div>
        </div>
    )
}
