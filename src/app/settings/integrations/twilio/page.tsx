import { requireAdmin } from "@/lib/auth-guard"
import { adminDb } from "@/lib/firebase-admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, MessageSquare } from "lucide-react"
import { TwilioForm } from "./TwilioForm"
import { BackLink } from "@/components/ui/BackLink"

export const dynamic = "force-dynamic"

export default async function TwilioIntegrationPage() {
    const session = await requireAdmin()
    const workspaceId = (session.user as { workspaceId: string }).workspaceId

    const wsDoc = await adminDb.collection("workspaces").doc(workspaceId).get()
    const ws = wsDoc.data() ?? {}
    const t = (ws.twilio as
        | {
              accountSid?: string
              authToken?: string
              fromNumber?: string
              webhookEnabled?: boolean
          }
        | undefined) ?? {}

    const configured =
        Boolean(t.accountSid) && Boolean(t.authToken) && Boolean(t.fromNumber)

    const replyWebhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.com"}/api/webhooks/twilio?ws=${workspaceId}`

    return (
        <div className="container mx-auto max-w-4xl py-10 px-4 space-y-6">
            <div>
                <BackLink href="/settings/integrations" label="Back to Integrations" />
                <h1 className="text-2xl font-semibold flex items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-primary" />
                    Twilio (SMS)
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Connect a Twilio account so automations and the Communications
                    inbox can send SMS to your contacts. Twilio is pay-as-you-go; you
                    pay them directly (~$0.0079/SMS in the US).
                </p>
            </div>

            <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-3 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-700 space-y-1">
                        <p>
                            <strong>You&apos;ll need:</strong> a Twilio account, a phone
                            number purchased through Twilio (~$1.15/mo), and your Account
                            SID + Auth Token from{" "}
                            <a
                                href="https://console.twilio.com"
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                            >
                                console.twilio.com
                            </a>
                            .
                        </p>
                        <p>
                            US/Canada A2P traffic also requires brand registration via
                            Twilio. Personal/internal use can skip this; commercial sends
                            cannot.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Credentials</CardTitle>
                </CardHeader>
                <CardContent>
                    <TwilioForm
                        initialAccountSid={t.accountSid ?? ""}
                        hasAuthToken={Boolean(t.authToken)}
                        initialFromNumber={t.fromNumber ?? ""}
                    />
                </CardContent>
            </Card>

            {configured && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Inbound replies (optional)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                            To receive SMS replies in AFCrashpad, set this URL as the &ldquo;A
                            message comes in&rdquo; webhook on your Twilio number:
                        </p>
                        <pre className="text-xs bg-muted p-3 rounded font-mono break-all">
                            {replyWebhookUrl}
                        </pre>
                        <p className="text-xs text-muted-foreground">
                            Configure under <strong>Phone Numbers → Manage → Active
                            numbers → [your number] → Messaging → A message comes in</strong>.
                            HTTP method: POST.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
