"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { disconnectGoogleCalendar } from "./users/actions"
import { useState } from "react"
import { Loader2, CalendarSync, Apple, MessageSquare, CreditCard, ExternalLink, Copy, Check } from "lucide-react"
import { toast } from "sonner"

export function IntegrationsTab({
    isConnected,
    icsFeedUrl
}: {
    isConnected: boolean;
    icsFeedUrl: string;
}) {
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const [copied, setCopied] = useState(false)

    const handleDisconnect = async () => {
        setIsDisconnecting(true)
        try {
            await disconnectGoogleCalendar()
        } catch (error) {
            console.error(error)
        } finally {
            setIsDisconnecting(false)
        }
    }

    const handleCopy = async () => {
        await navigator.clipboard.writeText(icsFeedUrl)
        setCopied(true)
        toast.success("Feed URL copied to clipboard")
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="space-y-3">
            {/* Google Calendar */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-md bg-muted/50">
                        <CalendarSync className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold">Google Calendar</div>
                        <div className="text-xs text-muted-foreground">Two-way sync for opportunities and tasks.</div>
                    </div>
                </div>
                {isConnected ? (
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10 gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Connected
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDisconnect}
                            disabled={isDisconnecting}
                            className="h-8 text-xs text-muted-foreground hover:text-destructive"
                        >
                            {isDisconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
                        </Button>
                    </div>
                ) : (
                    <Button asChild size="sm" className="h-8">
                        <a href="/api/auth/google-calendar">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Connect
                        </a>
                    </Button>
                )}
            </div>

            {/* Apple Calendar */}
            <div className="p-4 border rounded-lg bg-card space-y-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-md bg-muted/50">
                        <Apple className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold">Apple Calendar</div>
                        <div className="text-xs text-muted-foreground">One-way sync. Subscribe to this feed on your Apple device.</div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Input readOnly value={icsFeedUrl} className="font-mono text-xs bg-muted/30 focus-visible:ring-0" />
                    <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5" onClick={handleCopy}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 shrink-0" asChild>
                        <a href={icsFeedUrl}>
                            Download
                        </a>
                    </Button>
                </div>
            </div>

            {/* Twilio SMS - Coming Soon */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card opacity-50">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-md bg-muted/50">
                        <MessageSquare className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-muted-foreground">Twilio SMS</div>
                        <div className="text-xs text-muted-foreground/70">Send automated text updates to contacts.</div>
                    </div>
                </div>
                <Badge variant="secondary" className="text-muted-foreground/60 text-[10px]">Coming Soon</Badge>
            </div>

            {/* Stripe Billing - Coming Soon */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card opacity-50">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-md bg-muted/50">
                        <CreditCard className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-muted-foreground">Stripe Billing</div>
                        <div className="text-xs text-muted-foreground/70">Collect deposits and invoice payments.</div>
                    </div>
                </div>
                <Badge variant="secondary" className="text-muted-foreground/60 text-[10px]">Coming Soon</Badge>
            </div>
        </div>
    )
}
