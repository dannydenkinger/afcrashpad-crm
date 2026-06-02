"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Save, Unplug } from "lucide-react"
import { disconnectTwilioAction, saveTwilioCredsAction } from "./actions"

export function TwilioForm({
    initialAccountSid,
    hasAuthToken,
    initialFromNumber,
}: {
    initialAccountSid: string
    hasAuthToken: boolean
    initialFromNumber: string
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [accountSid, setAccountSid] = useState(initialAccountSid)
    const [authToken, setAuthToken] = useState("")
    const [fromNumber, setFromNumber] = useState(initialFromNumber)

    const handleSave = () => {
        if (!hasAuthToken && !authToken.trim()) {
            toast.error("Auth token is required")
            return
        }
        startTransition(async () => {
            const res = await saveTwilioCredsAction({
                accountSid,
                authToken,
                fromNumber,
            })
            if (!res.success) {
                toast.error(res.error || "Failed to save")
                return
            }
            toast.success("Twilio credentials saved")
            setAuthToken("")
            router.refresh()
        })
    }

    const handleDisconnect = () => {
        if (!confirm("Disconnect Twilio? Automations using SMS actions will fail until reconnected.")) {
            return
        }
        startTransition(async () => {
            const res = await disconnectTwilioAction()
            if (!res.success) {
                toast.error(res.error || "Failed")
                return
            }
            toast.success("Disconnected")
            router.refresh()
        })
    }

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="sid" className="text-xs">Account SID</Label>
                <Input
                    id="sid"
                    value={accountSid}
                    onChange={(e) => setAccountSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="font-mono"
                    disabled={isPending}
                />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="token" className="text-xs">
                    Auth Token{" "}
                    {hasAuthToken && (
                        <span className="text-muted-foreground font-normal">
                            (••• stored — leave blank to keep)
                        </span>
                    )}
                </Label>
                <Input
                    id="token"
                    type="password"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder={hasAuthToken ? "•".repeat(32) : "Your Twilio auth token"}
                    className="font-mono"
                    disabled={isPending}
                />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="from" className="text-xs">From number (E.164)</Label>
                <Input
                    id="from"
                    value={fromNumber}
                    onChange={(e) => setFromNumber(e.target.value)}
                    placeholder="+14155551212"
                    className="font-mono"
                    disabled={isPending}
                />
                <p className="text-[11px] text-muted-foreground">
                    Must include country code with leading + (US example shown).
                </p>
            </div>

            <div className="flex items-center gap-2 justify-end pt-2 border-t">
                {hasAuthToken && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleDisconnect}
                        disabled={isPending}
                    >
                        <Unplug className="w-4 h-4 mr-2" />
                        Disconnect
                    </Button>
                )}
                <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    Save credentials
                </Button>
            </div>
        </div>
    )
}
