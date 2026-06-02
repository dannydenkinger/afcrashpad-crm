"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, CheckCircle2, DollarSign, CreditCard, Smartphone, Mail, MapPin } from "lucide-react"
import { getPayoutFormData, submitPayoutDetails } from "@/app/dashboard/referrals/actions"

type PayoutMethod = "zelle" | "venmo" | "paypal" | "check"

const PAYOUT_METHODS: { value: PayoutMethod; label: string; icon: React.ReactNode; placeholder: string; detailLabel: string }[] = [
    { value: "zelle", label: "Zelle", icon: <CreditCard className="h-5 w-5" />, placeholder: "Email or phone number linked to your Zelle account", detailLabel: "Zelle Email or Phone" },
    { value: "venmo", label: "Venmo", icon: <Smartphone className="h-5 w-5" />, placeholder: "@your-venmo-handle", detailLabel: "Venmo Handle" },
    { value: "paypal", label: "PayPal", icon: <Mail className="h-5 w-5" />, placeholder: "Email linked to your PayPal account", detailLabel: "PayPal Email" },
    { value: "check", label: "Check / Mail", icon: <MapPin className="h-5 w-5" />, placeholder: "Full mailing address for the check", detailLabel: "Mailing Address" },
]

export default function PayoutFormPage() {
    const params = useParams()
    const token = params.token as string

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [formData, setFormData] = useState<{
        referrerName: string
        referredName: string
        payoutAmount: number
        alreadySubmitted: boolean
        payoutMethod: string | null
        payoutDetails: string | null
    } | null>(null)

    const [selectedMethod, setSelectedMethod] = useState<PayoutMethod | null>(null)
    const [details, setDetails] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    useEffect(() => {
        async function load() {
            const res = await getPayoutFormData(token)
            if (res.success && res.data) {
                setFormData(res.data)
                if (res.data.alreadySubmitted) {
                    setSubmitted(true)
                    setSelectedMethod(res.data.payoutMethod as PayoutMethod)
                }
            } else {
                setError(res.error || "Invalid link")
            }
            setLoading(false)
        }
        load()
    }, [token])

    async function handleSubmit() {
        if (!selectedMethod || !details.trim()) return
        setSubmitting(true)
        const res = await submitPayoutDetails(token, selectedMethod, details)
        if (res.success) {
            setSubmitted(true)
        } else {
            setError(res.error || "Failed to submit")
        }
        setSubmitting(false)
    }

    if (loading) {
        return (
            <Card className="w-full max-w-md border-none shadow-2xl bg-card/80 backdrop-blur-md">
                <CardContent className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        )
    }

    if (error && !formData) {
        return (
            <Card className="w-full max-w-md border-none shadow-2xl bg-card/80 backdrop-blur-md">
                <CardContent className="text-center py-16">
                    <p className="text-muted-foreground">{error}</p>
                </CardContent>
            </Card>
        )
    }

    if (!formData) return null

    if (submitted) {
        return (
            <Card className="w-full max-w-md border-none shadow-2xl bg-card/80 backdrop-blur-md">
                <CardContent className="text-center py-16 space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mx-auto">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-bold">Payment Details Received!</h2>
                    <p className="text-muted-foreground text-sm">
                        Thank you, {formData.referrerName}! We've received your payout information
                        and will process your <strong className="text-foreground">${formData.payoutAmount}</strong> payment shortly.
                    </p>
                    <p className="text-xs text-muted-foreground">You can close this page now.</p>
                </CardContent>
            </Card>
        )
    }

    const selectedConfig = PAYOUT_METHODS.find(m => m.value === selectedMethod)

    return (
        <Card className="w-full max-w-md border-none shadow-2xl bg-card/80 backdrop-blur-md">
            <CardHeader className="text-center space-y-2 pb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mx-auto">
                    <DollarSign className="h-6 w-6 text-emerald-500" />
                </div>
                <CardTitle className="text-xl">Referral Payout</CardTitle>
                <CardDescription>
                    Hi {formData.referrerName}! Your referral of <strong className="text-foreground">{formData.referredName}</strong> qualified
                    for a <strong className="text-emerald-500">${formData.payoutAmount}</strong> payout.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
                {error && (
                    <p className="text-sm text-red-500 text-center">{error}</p>
                )}

                <div className="space-y-2">
                    <Label className="text-sm font-semibold">How would you like to be paid?</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {PAYOUT_METHODS.map(method => (
                            <button
                                key={method.value}
                                onClick={() => { setSelectedMethod(method.value); setDetails(""); setError(null) }}
                                className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 transition-all text-sm font-medium
                                    ${selectedMethod === method.value
                                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                                        : "border-border hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                {method.icon}
                                {method.label}
                            </button>
                        ))}
                    </div>
                </div>

                {selectedMethod && selectedConfig && (
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">{selectedConfig.detailLabel}</Label>
                        {selectedMethod === "check" ? (
                            <Textarea
                                value={details}
                                onChange={e => setDetails(e.target.value)}
                                placeholder={selectedConfig.placeholder}
                                className="min-h-[80px]"
                            />
                        ) : (
                            <Input
                                value={details}
                                onChange={e => setDetails(e.target.value)}
                                placeholder={selectedConfig.placeholder}
                            />
                        )}
                    </div>
                )}

                <Button
                    onClick={handleSubmit}
                    disabled={!selectedMethod || !details.trim() || submitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    size="lg"
                >
                    {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Submit Payment Details
                </Button>

                <p className="text-[10px] text-muted-foreground text-center">
                    Your information is secure and will only be used to process this payout.
                </p>
            </CardContent>
        </Card>
    )
}
