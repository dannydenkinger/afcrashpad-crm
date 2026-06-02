"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import type { SocialConnection } from "@/types"
import { disconnectZernio, refreshZernioConnection } from "./actions"

interface Props {
    connection: SocialConnection | null
    configured: boolean
}

export function ZernioIntegrationCard({ connection, configured }: Props) {
    const [isPending, startTransition] = useTransition()
    const [current, setCurrent] = useState<SocialConnection | null>(connection)

    const handleConnect = () => {
        startTransition(async () => {
            try {
                const res = await fetch("/api/social/connect", { method: "POST" })
                const body = await res.json()
                if (!res.ok || !body.url) {
                    toast.error(body.error || "Failed to start connect flow")
                    return
                }
                window.location.href = body.url
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Network error")
            }
        })
    }

    const handleRefresh = () => {
        startTransition(async () => {
            const result = await refreshZernioConnection()
            if (!result.success) {
                toast.error(result.error || "Refresh failed")
                return
            }
            setCurrent(result.connection ?? null)
            toast.success("Accounts refreshed")
        })
    }

    const handleDisconnect = () => {
        if (!confirm("Disconnect all social accounts for this workspace?")) return
        startTransition(async () => {
            const result = await disconnectZernio()
            if (!result.success) {
                toast.error(result.error || "Disconnect failed")
                return
            }
            setCurrent(null)
            toast.success("Disconnected")
        })
    }

    if (!current) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Connect social accounts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Opens Zernio&apos;s hosted OAuth flow so this workspace can authorize its
                        own social accounts. We only store the resulting sub-account ID.
                    </p>
                    <Button onClick={handleConnect} disabled={isPending || !configured}>
                        {isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4 mr-2" />
                        )}
                        Connect accounts
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">
                    Connected accounts
                    <span className="text-xs text-muted-foreground font-normal ml-2">
                        {current.accounts.length} linked
                    </span>
                </CardTitle>
                <div className="flex gap-2">
                    <Button
                        onClick={handleRefresh}
                        disabled={isPending}
                        variant="outline"
                        size="sm"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button
                        onClick={handleConnect}
                        disabled={isPending || !configured}
                        variant="outline"
                        size="sm"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add more
                    </Button>
                    <Button
                        onClick={handleDisconnect}
                        disabled={isPending}
                        variant="ghost"
                        size="icon"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {current.accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                        Sub-account linked (<code>{current.zernioAccountId}</code>) but no specific
                        platforms detected yet. Try Refresh after completing the Zernio OAuth flow.
                    </p>
                ) : (
                    <div className="divide-y">
                        {current.accounts.map((a) => (
                            <div
                                key={a.externalId}
                                className="flex items-center justify-between py-2"
                            >
                                <div>
                                    <Badge variant="outline" className="capitalize mr-2">
                                        {a.platform}
                                    </Badge>
                                    <span className="text-sm">{a.handle}</span>
                                </div>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    Linked {new Date(a.connectedAt).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
