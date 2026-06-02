"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { TokenInserter, insertAtCursor } from "@/components/email/TokenInserter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    FlaskConical,
    Loader2,
    Mail,
    Save,
    Send,
    TestTube,
    Users,
    X,
} from "lucide-react"
import {
    previewCampaignAudienceAction,
    saveCampaignAction,
    sendCampaignAction,
    sendCampaignTestAction,
} from "./actions"
import { PreflightChecks } from "./PreflightChecks"
import type { CampaignABTest } from "@/types"
import { EmailPreview } from "@/components/email/EmailPreview"

interface TemplateSummary {
    id: string
    name: string
    subject: string
    renderedHtml: string
}

type AudienceType = "all_contacts" | "by_tag" | "by_list"

interface ListSummary {
    id: string
    name: string
    contactCount: number
}

interface Props {
    initialCampaign?: {
        id: string
        name: string
        subject: string
        templateId: string | null
        renderedHtml: string
        audienceType: AudienceType
        audienceValue: string[] | null
        excludeListIds?: string[] | null
        abTest?: CampaignABTest | null
        scheduledAt?: string | null
    }
    templates: TemplateSummary[]
    lists?: ListSummary[]
    balance: number
    sesReady: boolean
}

export function CampaignBuilder({
    initialCampaign,
    templates,
    lists = [],
    balance,
    sesReady,
}: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [campaignId, setCampaignId] = useState<string | null>(
        initialCampaign?.id ?? null,
    )
    const [name, setName] = useState(initialCampaign?.name ?? "")
    const [subject, setSubject] = useState(initialCampaign?.subject ?? "")
    const [templateId, setTemplateId] = useState<string | null>(
        initialCampaign?.templateId ?? null,
    )
    const [html, setHtml] = useState(initialCampaign?.renderedHtml ?? "")
    const [audienceType, setAudienceType] = useState<AudienceType>(
        (initialCampaign?.audienceType as AudienceType) ?? "all_contacts",
    )
    const [audienceValue, setAudienceValue] = useState(
        (initialCampaign?.audienceValue ?? []).join(", "),
    )
    // For by_list: array of selected list IDs (multi-select)
    const [selectedListIds, setSelectedListIds] = useState<string[]>(
        initialCampaign?.audienceType === "by_list"
            ? (initialCampaign.audienceValue ?? [])
            : [],
    )
    const [excludeListIds, setExcludeListIds] = useState<string[]>(
        initialCampaign?.excludeListIds ?? [],
    )
    const [sendMode, setSendMode] = useState<"now" | "schedule">(
        initialCampaign?.scheduledAt ? "schedule" : "now",
    )
    const [scheduledAtLocal, setScheduledAtLocal] = useState<string>(() => {
        if (!initialCampaign?.scheduledAt) return ""
        // Convert ISO -> local datetime-local format (YYYY-MM-DDTHH:mm)
        const d = new Date(initialCampaign.scheduledAt)
        const pad = (n: number) => String(n).padStart(2, "0")
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    })

    const [abTest, setAbTest] = useState<CampaignABTest>(() =>
        initialCampaign?.abTest ?? {
            enabled: false,
            variants: ["", ""],
            metric: "opens",
            testPercentage: 20,
            testDurationHours: 4,
        },
    )

    // Dirty tracking — flips on whenever a tracked field changes
    const [isDirty, setIsDirty] = useState(false)
    const [savedAt, setSavedAt] = useState<Date | null>(initialCampaign ? new Date() : null)
    const skipFirstDirty = useRef(true)

    // Send-now confirmation modal
    const [confirmSend, setConfirmSend] = useState(false)

    // Audience preview — counted on demand (also after every audience change)
    const [audienceCount, setAudienceCount] = useState<number | null>(null)
    const [audiencePreviewLoading, setAudiencePreviewLoading] = useState(false)

    // Test email state
    const [showTestForm, setShowTestForm] = useState(false)
    const [testEmail, setTestEmail] = useState("")
    const [testSending, setTestSending] = useState(false)

    const subjectInputRef = useRef<HTMLInputElement | null>(null)
    const htmlTextareaRef = useRef<HTMLTextAreaElement | null>(null)

    // Mark dirty on any tracked field change (skip the very first effect run)
    useEffect(() => {
        if (skipFirstDirty.current) {
            skipFirstDirty.current = false
            return
        }
        setIsDirty(true)
    }, [
        name,
        subject,
        templateId,
        html,
        audienceType,
        audienceValue,
        selectedListIds,
        excludeListIds,
        sendMode,
        scheduledAtLocal,
        abTest,
    ])

    // Warn before navigating away with unsaved changes
    useEffect(() => {
        if (!isDirty) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ""
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [isDirty])

    const insertIntoSubject = (token: string) => {
        const { value, cursor } = insertAtCursor(subjectInputRef.current, token, subject)
        setSubject(value)
        requestAnimationFrame(() => {
            const el = subjectInputRef.current
            if (el) {
                el.focus()
                el.setSelectionRange(cursor, cursor)
            }
        })
    }

    const insertIntoHtml = (token: string) => {
        const { value, cursor } = insertAtCursor(htmlTextareaRef.current, token, html)
        setHtml(value)
        requestAnimationFrame(() => {
            const el = htmlTextareaRef.current
            if (el) {
                el.focus()
                el.setSelectionRange(cursor, cursor)
            }
        })
    }

    const handleTemplateChange = (value: string) => {
        const newId = value === "none" ? null : value
        setTemplateId(newId)
        if (newId) {
            const picked = templates.find((t) => t.id === newId)
            if (picked) {
                setHtml(picked.renderedHtml)
                if (!subject.trim()) setSubject(picked.subject)
            }
        }
    }

    const canSave =
        name.trim().length > 0 && subject.trim().length > 0 && html.trim().length > 0

    const audienceValueArr = audienceValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)

    const save = async (
        opts: { scheduledAt?: string | null } = {},
    ): Promise<string | null> => {
        if (!canSave) {
            toast.error("Name, subject, and HTML are required")
            return null
        }
        let audienceValueOut: string[] | null = null
        if (audienceType === "by_tag") audienceValueOut = audienceValueArr
        else if (audienceType === "by_list") audienceValueOut = selectedListIds

        const result = await saveCampaignAction({
            id: campaignId ?? undefined,
            name: name.trim(),
            subject: subject.trim(),
            templateId: templateId ?? null,
            renderedHtml: html,
            audienceType,
            audienceValue: audienceValueOut,
            excludeListIds: excludeListIds.length > 0 ? excludeListIds : null,
            abTest: abTest.enabled ? abTest : null,
            scheduledAt: opts.scheduledAt ?? null,
        })
        if (!result.success || !result.campaign) {
            toast.error(result.error || "Failed to save campaign")
            return null
        }
        setCampaignId(result.campaign.id)
        setSavedAt(new Date())
        setIsDirty(false)
        return result.campaign.id
    }

    /** Save in-place — does NOT navigate. Used by Cmd+S and the in-place Save button. */
    const saveInPlace = useCallback(() => {
        startTransition(async () => {
            const id = await save()
            if (id) toast.success("Saved")
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name, subject, templateId, html, audienceType, audienceValue, selectedListIds, excludeListIds, abTest, scheduledAtLocal, sendMode])

    const handleSaveDraft = () => {
        startTransition(async () => {
            const id = await save()
            if (id) {
                toast.success("Draft saved")
                router.push(`/marketing/email/campaigns/${id}`)
            }
        })
    }

    // Cmd/Ctrl+S keyboard shortcut for quick save
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault()
                if (canSave && !isPending) saveInPlace()
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [canSave, isPending, saveInPlace])

    // Recipient-count preview — debounced so we don't hammer the server while
    // the user is typing tag names. Re-runs whenever audience inputs change.
    useEffect(() => {
        let cancelled = false
        const timer = setTimeout(async () => {
            // Don't query if the audience is incomplete
            if (audienceType === "by_tag" && audienceValueArr.length === 0) {
                setAudienceCount(0)
                return
            }
            if (audienceType === "by_list" && selectedListIds.length === 0) {
                setAudienceCount(0)
                return
            }
            setAudiencePreviewLoading(true)
            try {
                const result = await previewCampaignAudienceAction({
                    audienceType,
                    audienceValue:
                        audienceType === "by_tag"
                            ? audienceValueArr
                            : audienceType === "by_list"
                              ? selectedListIds
                              : null,
                    excludeListIds: excludeListIds.length > 0 ? excludeListIds : null,
                })
                if (cancelled) return
                if (result.success) setAudienceCount(result.count)
            } finally {
                if (!cancelled) setAudiencePreviewLoading(false)
            }
        }, 400)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audienceType, audienceValue, selectedListIds.join(","), excludeListIds.join(",")])

    const handleSendNow = () => {
        if (!sesReady) {
            toast.error("Verify a SES domain before sending")
            return
        }
        if (!canSave) {
            toast.error("Name, subject, and HTML are required")
            return
        }
        // Open the branded confirmation modal instead of browser confirm()
        setConfirmSend(true)
    }

    const performSend = () => {
        setConfirmSend(false)
        startTransition(async () => {
            const id = await save({ scheduledAt: null })
            if (!id) return
            const result = await sendCampaignAction(id)
            if (!result.success) {
                toast.error(result.error || "Send failed")
                return
            }
            toast.success(
                `Campaign sent. ${result.sent ?? 0} delivered, ${result.failed ?? 0} failed.`,
            )
            router.push(`/marketing/email/campaigns/${id}`)
        })
    }

    const handleSendTest = () => {
        if (!sesReady) {
            toast.error("Verify a SES domain before sending")
            return
        }
        if (!testEmail || !testEmail.includes("@")) {
            toast.error("Enter a valid email address")
            return
        }
        if (!subject.trim() || !html.trim()) {
            toast.error("Subject and body are required")
            return
        }
        setTestSending(true)
        ;(async () => {
            try {
                const result = await sendCampaignTestAction({
                    to: testEmail.trim(),
                    subject: subject.trim(),
                    html,
                })
                if (!result.success) {
                    toast.error(result.error || "Test send failed")
                    return
                }
                toast.success(`Test sent to ${testEmail.trim()}`)
                setShowTestForm(false)
                setTestEmail("")
            } finally {
                setTestSending(false)
            }
        })()
    }

    const handleSchedule = () => {
        if (!sesReady) {
            toast.error("Verify a SES domain before scheduling")
            return
        }
        if (!scheduledAtLocal) {
            toast.error("Pick a date and time")
            return
        }
        const when = new Date(scheduledAtLocal)
        if (isNaN(when.getTime())) {
            toast.error("Invalid date")
            return
        }
        if (when.getTime() < Date.now() + 60_000) {
            toast.error("Pick a time at least a minute in the future")
            return
        }
        startTransition(async () => {
            const id = await save({ scheduledAt: when.toISOString() })
            if (!id) return
            toast.success(`Scheduled for ${when.toLocaleString()}`)
            router.push(`/marketing/email/campaigns/${id}`)
        })
    }

    return (
        <div className="space-y-4">
            {/* Sticky toolbar — save state, audience preview, test send */}
            <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-background/85 backdrop-blur-md border-b flex items-center gap-3 flex-wrap">
                <SaveIndicator isDirty={isDirty} isSaving={isPending} savedAt={savedAt} />
                <div className="h-4 w-px bg-border" />
                <AudienceBadge
                    count={audienceCount}
                    loading={audiencePreviewLoading}
                    audienceType={audienceType}
                />
                <div className="flex-1" />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTestForm((s) => !s)}
                    disabled={isPending || !sesReady}
                    title={sesReady ? "Send a test email to yourself or a teammate" : "Verify SES first"}
                    className="gap-1.5"
                >
                    <TestTube className="w-3.5 h-3.5" />
                    Send test
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={saveInPlace}
                    disabled={isPending || !canSave || !isDirty}
                    title="Save (⌘S)"
                    className="gap-1.5"
                >
                    {isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Save className="w-3.5 h-3.5" />
                    )}
                    Save
                </Button>
            </div>
            {showTestForm && (
                <div className="rounded-md border bg-muted/30 p-3 flex items-center gap-2">
                    <TestTube className="w-4 h-4 text-primary shrink-0" />
                    <Input
                        type="email"
                        placeholder="you@example.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSendTest()
                        }}
                        disabled={testSending}
                        className="max-w-xs h-8 text-sm"
                    />
                    <Button
                        size="sm"
                        onClick={handleSendTest}
                        disabled={testSending || !testEmail.includes("@")}
                        className="h-8"
                    >
                        {testSending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                            <Send className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Send to this address
                    </Button>
                    <button
                        type="button"
                        onClick={() => setShowTestForm(false)}
                        className="ml-auto text-muted-foreground hover:text-foreground"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Campaign name</Label>
                            <Input
                                id="name"
                                placeholder="March newsletter"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isPending}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="subject">Subject line</Label>
                                <TokenInserter
                                    onInsert={insertIntoSubject}
                                    label="Token"
                                    disabled={isPending}
                                />
                            </div>
                            <Input
                                id="subject"
                                ref={subjectInputRef}
                                placeholder="What's new for {{first_name}}"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                disabled={isPending}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Template</Label>
                            <Select
                                value={templateId ?? "none"}
                                onValueChange={handleTemplateChange}
                                disabled={isPending}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a template or write HTML below" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No template (inline HTML)</SelectItem>
                                    {templates.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Picking a template fills the HTML below. You can still edit it.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="html">HTML body</Label>
                                <TokenInserter
                                    onInsert={insertIntoHtml}
                                    disabled={isPending}
                                />
                            </div>
                            <textarea
                                id="html"
                                ref={htmlTextareaRef}
                                className="w-full min-h-[240px] font-mono text-xs p-3 border rounded-md bg-background"
                                value={html}
                                onChange={(e) => setHtml(e.target.value)}
                                placeholder="<h1>Hello {{first_name}}</h1>..."
                                disabled={isPending}
                            />
                            <p className="text-xs text-muted-foreground">
                                CSS is auto-inlined at send time so Gmail/Outlook render correctly.
                                Personalization tokens (above) get filled per-recipient.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <EmailPreview html={html} height={460} />
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Audience</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Targeting</Label>
                            <Select
                                value={audienceType}
                                onValueChange={(v) => setAudienceType(v as AudienceType)}
                                disabled={isPending}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all_contacts">
                                        All contacts with email
                                    </SelectItem>
                                    <SelectItem value="by_list">By list</SelectItem>
                                    <SelectItem value="by_tag">By tag</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {audienceType === "by_tag" && (
                            <div className="space-y-2">
                                <Label>Tags (matches any, max 10)</Label>
                                <TagChipInput
                                    value={audienceValueArr}
                                    onChange={(tags) =>
                                        setAudienceValue(tags.join(", "))
                                    }
                                    disabled={isPending}
                                    max={10}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Contacts with <em>any</em> of these tags receive the email.
                                </p>
                            </div>
                        )}
                        {audienceType === "by_list" && (
                            <div className="space-y-2">
                                <Label>Include lists</Label>
                                {lists.length === 0 ? (
                                    <div className="text-xs text-muted-foreground p-3 border border-dashed rounded">
                                        No lists yet.{" "}
                                        <Link
                                            href="/marketing/email/lists/new"
                                            className="underline"
                                        >
                                            Create one
                                        </Link>
                                        .
                                    </div>
                                ) : (
                                    <div className="space-y-1 max-h-48 overflow-y-auto border rounded p-2">
                                        {lists.map((l) => (
                                            <label
                                                key={l.id}
                                                className="flex items-center gap-2 px-2 py-1 hover:bg-muted/40 rounded cursor-pointer text-sm"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedListIds.includes(l.id)}
                                                    onChange={(e) => {
                                                        setSelectedListIds((prev) =>
                                                            e.target.checked
                                                                ? [...prev, l.id]
                                                                : prev.filter((x) => x !== l.id),
                                                        )
                                                    }}
                                                    disabled={isPending}
                                                />
                                                <span className="flex-1 truncate">{l.name}</span>
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {l.contactCount}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Contacts in any of these lists receive the email (deduped).
                                </p>
                            </div>
                        )}

                        {lists.length > 0 && (
                            <div className="space-y-2 pt-3 border-t">
                                <Label className="text-xs">Exclude lists (optional)</Label>
                                <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                                    {lists.map((l) => (
                                        <label
                                            key={l.id}
                                            className="flex items-center gap-2 px-2 py-1 hover:bg-muted/40 rounded cursor-pointer text-sm"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={excludeListIds.includes(l.id)}
                                                onChange={(e) => {
                                                    setExcludeListIds((prev) =>
                                                        e.target.checked
                                                            ? [...prev, l.id]
                                                            : prev.filter((x) => x !== l.id),
                                                    )
                                                }}
                                                disabled={isPending}
                                            />
                                            <span className="flex-1 truncate">{l.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Contacts in these lists are removed from the audience even if
                                    they match above. Useful for &ldquo;send to A, except anyone in B&rdquo;.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <FlaskConical className="w-4 h-4 text-primary" />
                            A/B subject test
                        </CardTitle>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                                type="checkbox"
                                checked={abTest.enabled}
                                onChange={(e) =>
                                    setAbTest((prev) => ({
                                        ...prev,
                                        enabled: e.target.checked,
                                        variants: e.target.checked && !prev.variants[0]
                                            ? [subject, ""]
                                            : prev.variants,
                                    }))
                                }
                                disabled={isPending}
                            />
                            Enable
                        </label>
                    </CardHeader>
                    {abTest.enabled && (
                        <CardContent className="space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Subject A</Label>
                                <Input
                                    value={abTest.variants[0]}
                                    onChange={(e) =>
                                        setAbTest((p) => ({
                                            ...p,
                                            variants: [e.target.value, p.variants[1]],
                                        }))
                                    }
                                    placeholder="First subject line"
                                    disabled={isPending}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Subject B</Label>
                                <Input
                                    value={abTest.variants[1]}
                                    onChange={(e) =>
                                        setAbTest((p) => ({
                                            ...p,
                                            variants: [p.variants[0], e.target.value],
                                        }))
                                    }
                                    placeholder="Second subject line — try a different angle"
                                    disabled={isPending}
                                />
                            </div>

                            <label className="flex items-center gap-2 text-xs cursor-pointer pt-1 border-t">
                                <input
                                    type="checkbox"
                                    checked={!!abTest.bodyVariants}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            // Pre-fill A with current HTML, B blank
                                            setAbTest((p) => ({
                                                ...p,
                                                bodyVariants: [html || "", ""],
                                            }))
                                        } else {
                                            setAbTest((p) => {
                                                const next = { ...p }
                                                delete next.bodyVariants
                                                return next
                                            })
                                        }
                                    }}
                                    disabled={isPending}
                                />
                                Test the body too (not just subject)
                            </label>

                            {abTest.bodyVariants && (
                                <>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Body A (HTML)</Label>
                                        <textarea
                                            value={abTest.bodyVariants[0]}
                                            onChange={(e) =>
                                                setAbTest((p) => ({
                                                    ...p,
                                                    bodyVariants: [
                                                        e.target.value,
                                                        p.bodyVariants?.[1] ?? "",
                                                    ],
                                                }))
                                            }
                                            rows={4}
                                            placeholder="<p>Body for variant A…</p>"
                                            className="w-full px-2.5 py-2 text-xs font-mono border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/20"
                                            disabled={isPending}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Body B (HTML)</Label>
                                        <textarea
                                            value={abTest.bodyVariants[1]}
                                            onChange={(e) =>
                                                setAbTest((p) => ({
                                                    ...p,
                                                    bodyVariants: [
                                                        p.bodyVariants?.[0] ?? "",
                                                        e.target.value,
                                                    ],
                                                }))
                                            }
                                            rows={4}
                                            placeholder="<p>Body for variant B — try a different layout/copy…</p>"
                                            className="w-full px-2.5 py-2 text-xs font-mono border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/20"
                                            disabled={isPending}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/70 leading-snug">
                                        When body testing is on, the &ldquo;HTML body&rdquo; in
                                        Details is ignored for the test pool — variants A and B
                                        above are used. The winning body is what gets sent to
                                        the rest.
                                    </p>
                                </>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs">Test pool %</Label>
                                    <Input
                                        type="number"
                                        min={10}
                                        max={50}
                                        value={abTest.testPercentage}
                                        onChange={(e) =>
                                            setAbTest((p) => ({
                                                ...p,
                                                testPercentage: Math.max(
                                                    10,
                                                    Math.min(50, parseInt(e.target.value) || 20),
                                                ),
                                            }))
                                        }
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Wait (hrs)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={168}
                                        value={abTest.testDurationHours}
                                        onChange={(e) =>
                                            setAbTest((p) => ({
                                                ...p,
                                                testDurationHours: parseInt(e.target.value) || 4,
                                            }))
                                        }
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Pick by</Label>
                                    <Select
                                        value={abTest.metric}
                                        onValueChange={(v) =>
                                            setAbTest((p) => ({
                                                ...p,
                                                metric: v as "opens" | "clicks",
                                            }))
                                        }
                                        disabled={isPending}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="opens">Opens</SelectItem>
                                            <SelectItem value="clicks">Clicks</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 leading-snug">
                                {abTest.testPercentage}% of the audience gets split between
                                the two subjects. After {abTest.testDurationHours}h, the
                                winning subject (by {abTest.metric}) is sent to the rest.
                                Cron picks winners every 30 min.
                            </p>
                        </CardContent>
                    )}
                </Card>

                <PreflightChecks
                    name={name}
                    subject={subject}
                    html={html}
                    audienceCount={audienceCount}
                    sesReady={sesReady}
                    abEnabled={abTest.enabled}
                    abVariants={abTest.variants as [string, string]}
                />

                <Card>
                    <CardHeader>
                        <CardTitle>Send</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Credit balance</span>
                            <Badge variant="outline">{balance.toLocaleString()}</Badge>
                        </div>
                        {!sesReady && (
                            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 p-2 rounded">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>
                                    SES domain is not verified. You can save as a draft but not send.
                                </span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>When to send</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSendMode("now")}
                                    disabled={isPending}
                                    className={`text-left p-2.5 border rounded-md text-xs transition-colors ${
                                        sendMode === "now"
                                            ? "border-primary bg-primary/5"
                                            : "hover:bg-muted/50"
                                    }`}
                                >
                                    <div className="font-medium flex items-center gap-1.5">
                                        <Send className="w-3.5 h-3.5" />
                                        Send now
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSendMode("schedule")}
                                    disabled={isPending}
                                    className={`text-left p-2.5 border rounded-md text-xs transition-colors ${
                                        sendMode === "schedule"
                                            ? "border-primary bg-primary/5"
                                            : "hover:bg-muted/50"
                                    }`}
                                >
                                    <div className="font-medium flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        Schedule
                                    </div>
                                </button>
                            </div>
                            {sendMode === "schedule" && (
                                <ScheduleControls
                                    scheduledAtLocal={scheduledAtLocal}
                                    onChange={setScheduledAtLocal}
                                    disabled={isPending}
                                />
                            )}
                        </div>

                        <Button
                            onClick={handleSaveDraft}
                            disabled={isPending || !canSave}
                            variant="outline"
                            className="w-full"
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            Save draft
                        </Button>
                        {sendMode === "now" ? (
                            <Button
                                onClick={handleSendNow}
                                disabled={isPending || !canSave || !sesReady}
                                className="w-full"
                            >
                                {isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4 mr-2" />
                                )}
                                Save and send now
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSchedule}
                                disabled={isPending || !canSave || !sesReady || !scheduledAtLocal}
                                className="w-full"
                            >
                                {isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Clock className="w-4 h-4 mr-2" />
                                )}
                                Schedule send
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
        <SendConfirmDialog
            open={confirmSend}
            onOpenChange={setConfirmSend}
            onConfirm={performSend}
            audienceCount={audienceCount}
            audienceLoading={audiencePreviewLoading}
            audienceType={audienceType}
            balance={balance}
            campaignName={name}
            subject={subject}
            abEnabled={abTest.enabled}
        />
        </div>
    )
}

/**
 * Lightweight tag chip input. Loads workspace tags for autocomplete suggestions
 * but accepts arbitrary names too (since contact.tags is a free-form string array).
 */
function TagChipInput({
    value,
    onChange,
    disabled,
    max,
}: {
    value: string[]
    onChange: (next: string[]) => void
    disabled?: boolean
    max?: number
}) {
    const [draft, setDraft] = useState("")
    const [allTagNames, setAllTagNames] = useState<string[]>([])
    const inputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        // Lazy import to avoid circular client/server boundary issues
        import("@/app/settings/tags/actions").then((mod) =>
            mod.getTags().then((res) => {
                if (res.success) {
                    setAllTagNames(
                        (res.tags as Array<{ name: string }>)
                            .map((t) => t.name)
                            .filter(Boolean),
                    )
                }
            }),
        )
    }, [])

    const lower = draft.trim().toLowerCase()
    const suggestions = useMemo(() => {
        if (!lower) return []
        return allTagNames
            .filter(
                (n) =>
                    n.toLowerCase().includes(lower) &&
                    !value.some((v) => v.toLowerCase() === n.toLowerCase()),
            )
            .slice(0, 6)
    }, [allTagNames, lower, value])

    const addTag = (raw: string) => {
        const trimmed = raw.trim()
        if (!trimmed) return
        if (max && value.length >= max) return
        if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
            setDraft("")
            return
        }
        onChange([...value, trimmed])
        setDraft("")
    }

    const removeTag = (idx: number) => {
        onChange(value.filter((_, i) => i !== idx))
    }

    return (
        <div className="space-y-1.5">
            <div
                className={`min-h-9 flex flex-wrap gap-1 items-center px-2 py-1.5 border rounded-md bg-background focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary/50 ${
                    disabled ? "opacity-60" : ""
                }`}
                onClick={() => inputRef.current?.focus()}
            >
                {value.map((tag, i) => (
                    <span
                        key={`${tag}-${i}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                removeTag(i)
                            }}
                            disabled={disabled}
                            className="hover:bg-primary/20 rounded-full p-0.5"
                            title={`Remove ${tag}`}
                        >
                            <X className="w-2.5 h-2.5" />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault()
                            addTag(draft)
                        } else if (e.key === "Backspace" && !draft && value.length > 0) {
                            removeTag(value.length - 1)
                        }
                    }}
                    onBlur={() => addTag(draft)}
                    disabled={disabled || (max ? value.length >= max : false)}
                    placeholder={value.length === 0 ? "Type a tag and press Enter" : ""}
                    className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
                />
            </div>
            {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-muted-foreground self-center mr-1">
                        Suggestions:
                    </span>
                    {suggestions.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => addTag(s)}
                            disabled={disabled}
                            className="text-[11px] px-1.5 py-0.5 rounded border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                        >
                            + {s}
                        </button>
                    ))}
                </div>
            )}
            {max && value.length >= max && (
                <p className="text-[10px] text-amber-600">Max {max} tags reached.</p>
            )}
        </div>
    )
}

function AudienceBadge({
    count,
    loading,
    audienceType,
}: {
    count: number | null
    loading: boolean
    audienceType: AudienceType
}) {
    if (loading) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Counting recipients…
            </span>
        )
    }
    if (count === null) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                Audience not set
            </span>
        )
    }
    if (count === 0) {
        const hint =
            audienceType === "by_tag"
                ? "Add tags to target contacts"
                : audienceType === "by_list"
                  ? "Pick at least one list"
                  : "No contacts with email yet"
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                0 recipients — {hint}
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-xs">
            <Users className="w-3 h-3 text-emerald-600" />
            <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
            <span className="text-muted-foreground">
                recipient{count === 1 ? "" : "s"}
            </span>
        </span>
    )
}

function SaveIndicator({
    isDirty,
    isSaving,
    savedAt,
}: {
    isDirty: boolean
    isSaving: boolean
    savedAt: Date | null
}) {
    const [, setTick] = useState(0)
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 30_000)
        return () => clearInterval(id)
    }, [])

    if (isSaving) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving…
            </span>
        )
    }
    if (isDirty) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Unsaved changes
            </span>
        )
    }
    if (savedAt) {
        const diffMin = Math.floor((Date.now() - savedAt.getTime()) / 60_000)
        const label =
            diffMin < 1
                ? "Saved just now"
                : diffMin < 60
                  ? `Saved ${diffMin}m ago`
                  : `Saved ${Math.floor(diffMin / 60)}h ago`
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {label}
            </span>
        )
    }
    return null
}

function SendConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    audienceCount,
    audienceLoading,
    audienceType,
    balance,
    campaignName,
    subject,
    abEnabled,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
    audienceCount: number | null
    audienceLoading: boolean
    audienceType: AudienceType
    balance: number
    campaignName: string
    subject: string
    abEnabled: boolean
}) {
    const insufficientCredits =
        audienceCount !== null && audienceCount > balance
    const noAudience = audienceCount === 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-primary" />
                        Send campaign now?
                    </DialogTitle>
                    <DialogDescription>
                        This will start delivering the campaign immediately. You can&rsquo;t undo it.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                            <Mail className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{campaignName || "(untitled)"}</div>
                                <div className="text-xs text-muted-foreground truncate">{subject}</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                                <Users className="w-3 h-3" />
                                Recipients
                            </span>
                            <span className="font-medium tabular-nums">
                                {audienceLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin inline" />
                                ) : audienceCount === null ? (
                                    "—"
                                ) : (
                                    audienceCount.toLocaleString()
                                )}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Credits required</span>
                            <span className="font-medium tabular-nums">
                                {audienceCount === null
                                    ? "—"
                                    : audienceCount.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Credit balance</span>
                            <span
                                className={`font-medium tabular-nums ${
                                    insufficientCredits ? "text-red-600" : ""
                                }`}
                            >
                                {balance.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {abEnabled && (
                        <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-500/10 p-2 rounded">
                            <FlaskConical className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>
                                A/B test is on — only the test pool will receive emails right now.
                                The winning subject sends to the rest after the test window.
                            </span>
                        </div>
                    )}

                    {noAudience && !audienceLoading && (
                        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 p-2 rounded">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>
                                No recipients match this audience.{" "}
                                {audienceType === "by_tag"
                                    ? "Check that the tag names match contacts."
                                    : audienceType === "by_list"
                                      ? "Pick a list with members."
                                      : "Add some contacts first."}
                            </span>
                        </div>
                    )}

                    {insufficientCredits && (
                        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-500/10 p-2 rounded">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>
                                Not enough credits. Top up before sending — only the first{" "}
                                {balance.toLocaleString()} recipients would deliver.
                            </span>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={onConfirm} disabled={noAudience || audienceLoading}>
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        Send to {audienceCount?.toLocaleString() ?? "—"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function pad(n: number): string {
    return String(n).padStart(2, "0")
}

function toLocalInputValue(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface QuickPreset {
    label: string
    compute: () => Date
}

const QUICK_PRESETS: QuickPreset[] = [
    {
        label: "In 1 hour",
        compute: () => {
            const d = new Date()
            d.setHours(d.getHours() + 1, 0, 0, 0)
            return d
        },
    },
    {
        label: "Tomorrow 9am",
        compute: () => {
            const d = new Date()
            d.setDate(d.getDate() + 1)
            d.setHours(9, 0, 0, 0)
            return d
        },
    },
    {
        label: "Tomorrow 1pm",
        compute: () => {
            const d = new Date()
            d.setDate(d.getDate() + 1)
            d.setHours(13, 0, 0, 0)
            return d
        },
    },
    {
        label: "Next Monday 9am",
        compute: () => {
            const d = new Date()
            const day = d.getDay()
            const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7
            d.setDate(d.getDate() + daysUntilMonday)
            d.setHours(9, 0, 0, 0)
            return d
        },
    },
]

function ScheduleControls({
    scheduledAtLocal,
    onChange,
    disabled,
}: {
    scheduledAtLocal: string
    onChange: (v: string) => void
    disabled?: boolean
}) {
    // Tick every 30s so the relative time preview stays fresh.
    const [, setTick] = useState(0)
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 30_000)
        return () => clearInterval(id)
    }, [])

    const tz = useMemo(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone
        } catch {
            return "local"
        }
    }, [])

    const parsed = useMemo(() => {
        if (!scheduledAtLocal) return null
        const d = new Date(scheduledAtLocal)
        return isNaN(d.getTime()) ? null : d
    }, [scheduledAtLocal])

    const inPast = parsed && parsed.getTime() < Date.now()
    const tooSoon =
        parsed && parsed.getTime() < Date.now() + 60_000 && !inPast

    const relative = parsed ? formatRelativeFuture(parsed) : ""

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
                {QUICK_PRESETS.map((p) => (
                    <button
                        key={p.label}
                        type="button"
                        onClick={() => onChange(toLocalInputValue(p.compute()))}
                        disabled={disabled}
                        className="text-[11px] px-2 py-1.5 border rounded-md hover:bg-muted/50 hover:border-primary/30 transition-colors disabled:opacity-50 text-muted-foreground hover:text-foreground"
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            <Input
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
            <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                    Timezone: <span className="font-medium">{tz}</span>
                </span>
                {parsed && (
                    <span
                        className={
                            inPast
                                ? "text-red-600"
                                : tooSoon
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                        }
                    >
                        {inPast
                            ? "Time is in the past"
                            : tooSoon
                              ? "Schedule at least 1 minute out"
                              : `Fires ${relative}`}
                    </span>
                )}
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-snug">
                Cron checks every 5 min, so actual send may fire up to 5 minutes after the scheduled time.
            </p>
        </div>
    )
}

function formatRelativeFuture(d: Date): string {
    const diffMs = d.getTime() - Date.now()
    const diffMin = Math.round(diffMs / 60_000)
    if (diffMin < 60) return `in ${diffMin} min`
    const diffHr = Math.round(diffMin / 60)
    if (diffHr < 24) return `in ${diffHr}h ${diffMin % 60}m`
    const diffDay = Math.round(diffHr / 24)
    if (diffDay < 7) return `in ${diffDay} day${diffDay === 1 ? "" : "s"}`
    return `on ${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
}
