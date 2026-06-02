"use client"

import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Copy, Check, RefreshCw, Trash2, CreditCard } from "lucide-react"
import type { SesIdentityConfig } from "@/lib/ses/identities"
import {
    deleteSesIdentity,
    getCreditPacks,
    grantTestCredits,
    refreshSesStatus,
    sendTestEmail,
    setupSesIdentity,
    startCreditTopup,
    updateSesFromAddress,
} from "./actions"

interface Props {
    initialIdentity: SesIdentityConfig | null
    initialBalance: number
}

function StatusBadge({ status }: { status: string }) {
    const variant =
        status === "VERIFIED" ? "default" : status === "FAILED" ? "destructive" : "secondary"
    return <Badge variant={variant}>{status}</Badge>
}

function CopyField({ value }: { value: string }) {
    const [copied, setCopied] = useState(false)
    return (
        <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted px-2 py-1 rounded break-all">{value}</code>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={async () => {
                    await navigator.clipboard.writeText(value)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                }}
            >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
        </div>
    )
}

export function SesIntegrationCard({ initialIdentity, initialBalance }: Props) {
    const [identity, setIdentity] = useState<SesIdentityConfig | null>(initialIdentity)
    const [balance, setBalance] = useState<number>(initialBalance)
    const [isPending, startTransition] = useTransition()

    const [identityType, setIdentityTypeState] = useState<"DOMAIN" | "EMAIL_ADDRESS">("DOMAIN")
    const [domainInput, setDomainInput] = useState("")
    const [fromAddress, setFromAddress] = useState("")
    const [fromName, setFromName] = useState("")
    const [grantAmount, setGrantAmount] = useState("1000")
    const [testTo, setTestTo] = useState("")
    const [testSubject, setTestSubject] = useState("Test from Vesta CRM")
    const [testMessage, setTestMessage] = useState("Hello! This is a test email from your SES integration.")
    const [stripeConfigured, setStripeConfigured] = useState(false)
    const [packs, setPacks] = useState<{ sku: string; label: string; credits: number; priceDisplay: string }[]>([])

    useEffect(() => {
        let mounted = true
        getCreditPacks().then((res) => {
            if (!mounted) return
            setStripeConfigured(res.configured)
            setPacks(res.packs)
        }).catch(() => {})
        return () => {
            mounted = false
        }
    }, [])

    const handleBuy = (sku: string) => {
        startTransition(async () => {
            const result = await startCreditTopup({ packSku: sku })
            if (!result.success || !result.url) {
                toast.error(result.error || "Failed to start checkout")
                return
            }
            window.location.href = result.url
        })
    }

    const handleSetup = () => {
        const raw = domainInput.trim()
        if (!raw) {
            toast.error("Enter a value first")
            return
        }
        const hasAt = raw.includes("@")
        if (identityType === "DOMAIN" && hasAt) {
            toast.error(
                "You picked Domain but entered an email address. Remove everything before the @ (e.g. use \"acme.com\" instead of \"hi@acme.com\").",
            )
            return
        }
        if (identityType === "EMAIL_ADDRESS" && !hasAt) {
            toast.error("Email addresses must contain an @ sign (e.g. \"you@acme.com\").")
            return
        }
        startTransition(async () => {
            const result = await setupSesIdentity({
                identity: raw,
                fromAddress: fromAddress.trim() || undefined,
                fromName: fromName.trim() || undefined,
            })
            if (!result.success) {
                toast.error(result.error || "Failed to set up identity")
                return
            }
            setIdentity(result.config ?? null)
            toast.success(
                identityType === "DOMAIN"
                    ? "Domain created. Add the DNS records below to verify."
                    : "Verification email sent. Click the link in your inbox to verify.",
            )
        })
    }

    const handleRefresh = () => {
        startTransition(async () => {
            const result = await refreshSesStatus()
            if (!result.success) {
                toast.error(result.error || "Failed to refresh status")
                return
            }
            setIdentity(result.config ?? null)
            toast.success(`Status: ${result.config?.status ?? "UNKNOWN"}`)
        })
    }

    const handleDelete = () => {
        if (!confirm("Disconnect SES identity? You will need to re-verify DNS if you reconnect.")) {
            return
        }
        startTransition(async () => {
            const result = await deleteSesIdentity()
            if (!result.success) {
                toast.error(result.error || "Failed to delete")
                return
            }
            setIdentity(null)
            toast.success("SES identity removed")
        })
    }

    const handleUpdateFrom = () => {
        startTransition(async () => {
            const result = await updateSesFromAddress({
                fromAddress: fromAddress.trim(),
                fromName: fromName.trim() || undefined,
            })
            if (!result.success) {
                toast.error(result.error || "Failed to update")
                return
            }
            setIdentity(result.config ?? null)
            toast.success("From address updated")
        })
    }

    const handleTestSend = () => {
        if (!testTo.trim()) {
            toast.error("Enter a recipient address")
            return
        }
        startTransition(async () => {
            const result = await sendTestEmail({
                to: testTo.trim(),
                subject: testSubject.trim() || "Test from Vesta CRM",
                message: testMessage.trim() || "Hello!",
            })
            if (!result.success) {
                toast.error(result.error || "Send failed")
                return
            }
            setBalance(result.balanceAfter ?? balance)
            toast.success(`Sent. MessageId: ${result.messageId?.slice(0, 16)}...`)
        })
    }

    const handleGrant = () => {
        const amount = Number(grantAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error("Enter a positive amount")
            return
        }
        startTransition(async () => {
            const result = await grantTestCredits({ amount, note: "Test grant from settings" })
            if (!result.success) {
                toast.error(result.error || "Failed to grant credits")
                return
            }
            setBalance(result.balanceAfter ?? balance)
            toast.success(`Granted ${amount} credits. Balance: ${result.balanceAfter}`)
        })
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Email credits</CardTitle>
                    <Badge variant="outline" className="text-base px-3 py-1">
                        {balance.toLocaleString()} credits
                    </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        One credit is consumed per recipient.
                        {stripeConfigured ? " Buy packs below via Stripe, or grant credits manually for testing." : " Stripe isn't configured yet, so manual grant is the only option."}
                    </p>

                    {stripeConfigured && packs.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {packs.map((pack) => (
                                <Button
                                    key={pack.sku}
                                    onClick={() => handleBuy(pack.sku)}
                                    disabled={isPending}
                                    variant="outline"
                                    className="h-auto py-3 flex-col items-start gap-1"
                                >
                                    <span className="font-medium text-sm">{pack.label}</span>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <CreditCard className="w-3 h-3" />
                                        {pack.priceDisplay}
                                    </span>
                                </Button>
                            ))}
                        </div>
                    )}

                    <div className="pt-3 border-t">
                        <div className="text-xs text-muted-foreground mb-2">Manual grant (admin only)</div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min="1"
                                step="1"
                                value={grantAmount}
                                onChange={(e) => setGrantAmount(e.target.value)}
                                className="max-w-[200px]"
                                disabled={isPending}
                            />
                            <Button onClick={handleGrant} disabled={isPending} variant="secondary" size="sm">
                                Grant
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {!identity && (
                <Card>
                    <CardHeader>
                        <CardTitle>Set up email sending</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label>What are you verifying?</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIdentityTypeState("DOMAIN")}
                                    disabled={isPending}
                                    className={`text-left p-3 border rounded-md transition-colors ${
                                        identityType === "DOMAIN"
                                            ? "border-primary bg-primary/5"
                                            : "hover:bg-muted/50"
                                    }`}
                                >
                                    <div className="text-sm font-medium">A domain (recommended)</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Send from any address at <code>mail.yourdomain.com</code>. Requires DNS access.
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIdentityTypeState("EMAIL_ADDRESS")}
                                    disabled={isPending}
                                    className={`text-left p-3 border rounded-md transition-colors ${
                                        identityType === "EMAIL_ADDRESS"
                                            ? "border-primary bg-primary/5"
                                            : "hover:bg-muted/50"
                                    }`}
                                >
                                    <div className="text-sm font-medium">A single email address</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Quick test setup — AWS emails you a verification link. Only that one address can send.
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="identity">
                                {identityType === "DOMAIN" ? "Domain" : "Email address"}
                            </Label>
                            <Input
                                id="identity"
                                placeholder={
                                    identityType === "DOMAIN"
                                        ? "mail.yourdomain.com"
                                        : "you@yourdomain.com"
                                }
                                value={domainInput}
                                onChange={(e) => setDomainInput(e.target.value)}
                                disabled={isPending}
                            />
                            <p className="text-xs text-muted-foreground">
                                {identityType === "DOMAIN" ? (
                                    <>
                                        No <code>@</code> — enter just the domain. A subdomain like{" "}
                                        <code>mail.yourdomain.com</code> is safest (keeps SES DKIM records separate
                                        from your main email).
                                    </>
                                ) : (
                                    <>
                                        Include the full address with <code>@</code>. AWS will send a verification
                                        link to this inbox — you must click it before you can send.
                                    </>
                                )}
                            </p>
                        </div>

                        {identityType === "DOMAIN" && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fromAddress">Default from address</Label>
                                    <Input
                                        id="fromAddress"
                                        placeholder="hello@mail.yourdomain.com"
                                        value={fromAddress}
                                        onChange={(e) => setFromAddress(e.target.value)}
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fromName">From name</Label>
                                    <Input
                                        id="fromName"
                                        placeholder="Acme Team"
                                        value={fromName}
                                        onChange={(e) => setFromName(e.target.value)}
                                        disabled={isPending}
                                    />
                                </div>
                            </div>
                        )}
                        {identityType === "EMAIL_ADDRESS" && (
                            <div className="space-y-2">
                                <Label htmlFor="fromName">From name (optional)</Label>
                                <Input
                                    id="fromName"
                                    placeholder="Acme Team"
                                    value={fromName}
                                    onChange={(e) => setFromName(e.target.value)}
                                    disabled={isPending}
                                />
                            </div>
                        )}

                        <Button onClick={handleSetup} disabled={isPending || !domainInput.trim()}>
                            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {identityType === "DOMAIN" ? "Create domain identity" : "Send verification email"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {identity && (
                <>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-3">
                                {identity.identity}
                                <StatusBadge status={identity.status} />
                            </CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleRefresh}
                                    disabled={isPending}
                                    variant="outline"
                                    size="sm"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Check status
                                </Button>
                                <Button
                                    onClick={handleDelete}
                                    disabled={isPending}
                                    variant="ghost"
                                    size="sm"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {identity.status !== "VERIFIED" &&
                                identity.identityType === "DOMAIN" &&
                                identity.dkimTokens.length > 0 && (
                                    <div className="space-y-3">
                                        <p className="text-sm">
                                            Add these three <strong>CNAME</strong> records to your DNS, then click
                                            &ldquo;Check status&rdquo;. Propagation usually takes a few minutes.
                                        </p>
                                        {identity.dkimTokens.map((token) => (
                                            <div
                                                key={token}
                                                className="border rounded-md p-3 space-y-2 bg-muted/30"
                                            >
                                                <div>
                                                    <div className="text-xs text-muted-foreground mb-1">Name</div>
                                                    <CopyField
                                                        value={`${token}._domainkey.${identity.identity}`}
                                                    />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-muted-foreground mb-1">Value</div>
                                                    <CopyField value={`${token}.dkim.amazonses.com`} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                            {identity.status !== "VERIFIED" &&
                                identity.identityType === "DOMAIN" &&
                                identity.dkimTokens.length === 0 && (
                                    <p className="text-sm text-amber-600">
                                        DKIM records haven&apos;t been fetched yet. Click{" "}
                                        <strong>Check status</strong> above to pull them from AWS.
                                    </p>
                                )}

                            {identity.identityType === "DOMAIN" && (
                                <div className="space-y-3 pt-2 mt-2 border-t">
                                    <div>
                                        <p className="text-sm font-medium">SPF (recommended)</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Tells receiving servers AWS is authorized to send for this domain.
                                            If you already have an SPF record, add{" "}
                                            <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">
                                                include:amazonses.com
                                            </code>{" "}
                                            to it instead of creating a second one — only one SPF record per domain is allowed.
                                        </p>
                                    </div>
                                    <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                                        <div>
                                            <div className="text-xs text-muted-foreground mb-1">Type</div>
                                            <CopyField value="TXT" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground mb-1">Name</div>
                                            <CopyField value={identity.identity} />
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground mb-1">Value</div>
                                            <CopyField value="v=spf1 include:amazonses.com ~all" />
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium">DMARC (recommended)</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Tells receivers how to handle messages that fail SPF or DKIM, and where to send aggregate reports.
                                            Start with <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">p=none</code> (monitor only) until you&apos;re confident your sends are authenticated, then tighten to <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">p=quarantine</code> or <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">p=reject</code>.
                                        </p>
                                    </div>
                                    <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                                        <div>
                                            <div className="text-xs text-muted-foreground mb-1">Type</div>
                                            <CopyField value="TXT" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground mb-1">Name</div>
                                            <CopyField value={`_dmarc.${identity.identity}`} />
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground mb-1">Value</div>
                                            <CopyField
                                                value={`v=DMARC1; p=none; rua=mailto:dmarc@${identity.identity.replace(/^mail\./, "")}`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {identity.status !== "VERIFIED" &&
                                identity.identityType === "EMAIL_ADDRESS" && (
                                    <p className="text-sm">
                                        AWS sent a verification link to{" "}
                                        <strong>{identity.identity}</strong>. Click the link in that
                                        email, then press <strong>Check status</strong>.
                                    </p>
                                )}

                            {identity.status === "VERIFIED" && (
                                <p className="text-sm text-emerald-600">
                                    {identity.identityType === "DOMAIN" ? "Domain" : "Email address"} is
                                    verified. You can send from this identity.
                                </p>
                            )}

                            <div className="pt-4 border-t space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="fromAddress2">From address</Label>
                                        <Input
                                            id="fromAddress2"
                                            placeholder="hello@mail.example.com"
                                            value={fromAddress || identity.fromAddress || ""}
                                            onChange={(e) => setFromAddress(e.target.value)}
                                            disabled={isPending}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="fromName2">From name</Label>
                                        <Input
                                            id="fromName2"
                                            placeholder="Acme Team"
                                            value={fromName || identity.fromName || ""}
                                            onChange={(e) => setFromName(e.target.value)}
                                            disabled={isPending}
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={handleUpdateFrom}
                                    disabled={isPending || !fromAddress.trim()}
                                    variant="secondary"
                                    size="sm"
                                >
                                    Update from address
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {identity.status === "VERIFIED" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Send a test email</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Sends via SES and deducts 1 credit. A matching row will appear in{" "}
                                    <code>email_logs</code> and the contact timeline (if a contact matches).
                                </p>
                                <div className="space-y-2">
                                    <Label htmlFor="testTo">Recipient</Label>
                                    <Input
                                        id="testTo"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={testTo}
                                        onChange={(e) => setTestTo(e.target.value)}
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="testSubject">Subject</Label>
                                    <Input
                                        id="testSubject"
                                        value={testSubject}
                                        onChange={(e) => setTestSubject(e.target.value)}
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="testMessage">Message</Label>
                                    <textarea
                                        id="testMessage"
                                        className="w-full min-h-24 border rounded-md p-2 text-sm bg-background"
                                        value={testMessage}
                                        onChange={(e) => setTestMessage(e.target.value)}
                                        disabled={isPending}
                                    />
                                </div>
                                <Button onClick={handleTestSend} disabled={isPending || !testTo.trim()}>
                                    {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Send test email
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    )
}
