"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { updateNotificationPreferences, saveFcmToken } from "./users/actions"
import { toast } from "sonner"
import { Loader2, Mail, Smartphone, AlertCircle } from "lucide-react"
import { requestPushToken, isPushConfigured, PushNotConfiguredError } from "@/lib/firebase-messaging"

const EVENT_TYPES = [
    { key: "opportunity", label: "New Lead / Opportunity" },
    { key: "contact", label: "New Contact" },
    { key: "checkin", label: "Engagement starts (period start)" },
    { key: "checkout", label: "Engagement ends (period end)" },
    { key: "task", label: "Task Due" },
] as const

type Prefs = Record<string, boolean>

const defaultPrefs: Prefs = {
    emailEnabled: true,
    email_opportunity: true,
    email_contact: true,
    email_checkin: true,
    email_checkout: true,
    email_task: true,
    pushEnabled: false,
    push_opportunity: true,
    push_contact: true,
    push_checkin: true,
    push_checkout: true,
    push_task: true,
}

export function NotificationPreferences({ initialPrefs }: { initialPrefs: Prefs | null }) {
    const [prefs, setPrefs] = useState<Prefs>({ ...defaultPrefs, ...initialPrefs })
    const [saving, setSaving] = useState(false)
    const [requestingPush, setRequestingPush] = useState(false)

    const toggle = (key: string) => {
        setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const handleEnablePush = async () => {
        setRequestingPush(true)
        try {
            const token = await requestPushToken()
            if (!token) {
                toast.error("Push notifications were denied or are not supported in this browser.")
                return
            }
            await saveFcmToken(token)
            setPrefs(prev => ({ ...prev, pushEnabled: true }))
            toast.success("Push notifications enabled!")
        } catch (err) {
            if (err instanceof PushNotConfiguredError) {
                toast.error(err.message)
            } else {
                console.error("Push setup error:", err)
                toast.error("Failed to enable push notifications")
            }
        } finally {
            setRequestingPush(false)
        }
    }

    const pushConfigured = isPushConfigured()

    const handleSave = async () => {
        setSaving(true)
        try {
            await updateNotificationPreferences(prefs)
            toast.success("Notification preferences saved")
        } catch {
            toast.error("Failed to save preferences")
        } finally {
            setSaving(false)
        }
    }

    const emailEnabled = prefs.emailEnabled !== false
    const pushEnabled = prefs.pushEnabled === true

    return (
        <div className="space-y-6">
            {/* Email channel */}
            <div className="space-y-3">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <Label className="text-sm font-semibold">Email alerts</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Master toggle for all email notifications
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={emailEnabled}
                        onCheckedChange={() => toggle("emailEnabled")}
                    />
                </div>

                {emailEnabled && (
                    <div className="space-y-0.5">
                        {EVENT_TYPES.map(({ key, label }) => (
                            <div
                                key={key}
                                className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/30 transition-colors"
                            >
                                <Label className="text-sm">{label}</Label>
                                <Switch
                                    checked={prefs[`email_${key}`] !== false}
                                    onCheckedChange={() => toggle(`email_${key}`)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Push channel */}
            <div className="space-y-3">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <Label className="text-sm font-semibold">Push notifications</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Browser &amp; device push alerts (requires permission)
                            </p>
                        </div>
                    </div>
                    {pushEnabled ? (
                        <Switch
                            checked={true}
                            onCheckedChange={() => toggle("pushEnabled")}
                        />
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEnablePush}
                            disabled={requestingPush || !pushConfigured}
                            title={!pushConfigured ? "Push not configured for this deployment" : undefined}
                        >
                            {requestingPush && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            Enable
                        </Button>
                    )}
                </div>

                {!pushConfigured && !pushEnabled && (
                    <div className="flex items-start gap-2 px-1 text-[11px] text-muted-foreground">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>
                            Push notifications aren&apos;t configured for this deployment. The workspace owner needs to set{" "}
                            <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_FIREBASE_VAPID_KEY</code>{" "}
                            in environment variables.
                        </span>
                    </div>
                )}

                {pushEnabled && (
                    <div className="space-y-0.5">
                        {EVENT_TYPES.map(({ key, label }) => (
                            <div
                                key={key}
                                className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/30 transition-colors"
                            >
                                <Label className="text-sm">{label}</Label>
                                <Switch
                                    checked={prefs[`push_${key}`] !== false}
                                    onCheckedChange={() => toggle(`push_${key}`)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Save preferences
                </Button>
            </div>
        </div>
    )
}
