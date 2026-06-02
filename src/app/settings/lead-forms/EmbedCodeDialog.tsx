"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, Check, Link2, Code, Sparkles } from "lucide-react"
import { toast } from "sonner"

interface Props {
    open: boolean
    onClose: () => void
    formId: string
    formName: string
}

export function EmbedCodeDialog({ open, onClose, formId, formName }: Props) {
    const [copiedLink, setCopiedLink] = useState(false)
    const [copiedEmbed, setCopiedEmbed] = useState(false)
    const [copiedPrefill, setCopiedPrefill] = useState(false)
    const [tab, setTab] = useState<"link" | "iframe" | "prefill">("link")

    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    const formUrl = `${baseUrl}/forms/${formId}`
    const iframeCode = `<iframe src="${formUrl}" width="100%" height="700" frameborder="0" style="border:none;max-width:600px;margin:0 auto;display:block;"></iframe>`
    const prefillExample = `${formUrl}?email=jane@example.com&first_name=Jane`

    const copy = (text: string, type: "link" | "embed" | "prefill") => {
        navigator.clipboard.writeText(text)
        toast.success("Copied!")
        if (type === "link") { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000) }
        else if (type === "embed") { setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000) }
        else { setCopiedPrefill(true); setTimeout(() => setCopiedPrefill(false), 2000) }
    }

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Share &ldquo;{formName}&rdquo;</DialogTitle>
                </DialogHeader>

                <div className="flex gap-1 bg-muted rounded-lg p-0.5 mb-4">
                    {[
                        { value: "link" as const, label: "Direct Link", icon: Link2 },
                        { value: "iframe" as const, label: "Embed Code", icon: Code },
                        { value: "prefill" as const, label: "Pre-fill", icon: Sparkles },
                    ].map(t => (
                        <button
                            key={t.value}
                            onClick={() => setTab(t.value)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                tab === t.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                            }`}
                        >
                            <t.icon className="h-3.5 w-3.5" />
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === "link" && (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">Share this link anywhere — social media, emails, QR codes, or text messages.</p>
                        <div className="flex gap-2">
                            <code className="flex-1 p-2.5 bg-muted rounded-lg text-sm font-mono break-all border select-all">
                                {formUrl}
                            </code>
                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => copy(formUrl, "link")}>
                                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                )}

                {tab === "iframe" && (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">Paste this code into your website to embed the form.</p>
                        <div className="relative">
                            <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto border select-all">
                                {iframeCode}
                            </pre>
                            <Button
                                variant="outline"
                                size="sm"
                                className="absolute top-2 right-2 h-7 text-xs"
                                onClick={() => copy(iframeCode, "embed")}
                            >
                                {copiedEmbed ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                {copiedEmbed ? "Copied!" : "Copy"}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Works with WordPress, Wix, Squarespace, Webflow, or any site that supports HTML embeds.</p>
                    </div>
                )}

                {tab === "prefill" && (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Pre-populate fields by adding them as URL parameters. Useful for personalized
                            email links, retargeting campaigns, or follow-ups.
                        </p>

                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Example
                            </p>
                            <div className="relative">
                                <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto border select-all whitespace-pre-wrap break-all">
                                    {prefillExample}
                                </pre>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="absolute top-2 right-2 h-7 text-xs"
                                    onClick={() => copy(prefillExample, "prefill")}
                                >
                                    {copiedPrefill ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                    {copiedPrefill ? "Copied!" : "Copy"}
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
                            <p className="font-semibold text-foreground">How parameter names work</p>
                            <ul className="space-y-1 text-muted-foreground leading-relaxed list-disc list-inside">
                                <li>
                                    Match a field by its <strong>label</strong> in lowercase, with non-alphanumeric
                                    characters replaced by <code className="bg-background px-1 rounded">_</code>
                                    {" — "}so a label of <em>&ldquo;Work email&rdquo;</em> becomes
                                    {" "}<code className="bg-background px-1 rounded">work_email</code>.
                                </li>
                                <li>
                                    Or use the field&apos;s <strong>internal id</strong> if you know it.
                                </li>
                                <li>
                                    URL-encode any spaces or special characters in the value.
                                </li>
                            </ul>
                        </div>

                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                            <strong>Heads up:</strong> URL params are visible to recipients — don&apos;t pre-fill
                            sensitive values like passwords or private IDs.
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
