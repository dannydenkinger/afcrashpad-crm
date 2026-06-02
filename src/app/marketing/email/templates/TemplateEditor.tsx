"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import type { ProjectData } from "grapesjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
    Loader2,
    Save,
    Upload,
    Send,
    ArrowLeft,
    Settings2,
    Sparkles,
    Check,
    CircleDot,
} from "lucide-react"
import { TokenInserter, insertAtCursor } from "@/components/email/TokenInserter"
import { buildContactContext, renderTokens, renderTokensHtml } from "@/lib/templating/tokens"
import { saveTemplateAction, sendTemplateTestAction } from "../actions"
import { TemplatePreview } from "./TemplatePreview"
import { EmailPreview } from "@/components/email/EmailPreview"

// Lazy-load GrapesJS — heavy bundle (~300 KB).
const GrapesEmailEditor = dynamic(
    () =>
        import("@/components/email/GrapesEmailEditor").then((m) => m.GrapesEmailEditor),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading editor…
            </div>
        ),
    },
)

interface StarterOption {
    slug: string
    name: string
    subject: string
    description: string
    category?: string
    renderedHtml: string
}

interface Props {
    initial?: {
        id: string
        name: string
        subject: string
        description?: string
        renderedHtml: string
        designJson: Record<string, unknown> | null
    }
    starterTemplates?: StarterOption[]
    /** When set, pre-fills the editor with this starter on mount. */
    preselectedStarter?: StarterOption
    workspaceName?: string
}

export function TemplateEditor({
    initial,
    starterTemplates,
    preselectedStarter,
    workspaceName,
}: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [templateId, setTemplateId] = useState<string | null>(initial?.id ?? null)
    const [name, setName] = useState(initial?.name ?? preselectedStarter?.name ?? "")
    const [subject, setSubject] = useState(
        initial?.subject ?? preselectedStarter?.subject ?? "",
    )
    const [description, setDescription] = useState(initial?.description ?? "")
    const [html, setHtml] = useState(
        initial?.renderedHtml ?? preselectedStarter?.renderedHtml ?? "",
    )
    const [designJson, setDesignJson] = useState<ProjectData | null>(
        (initial?.designJson as ProjectData | null) ?? null,
    )

    // Seed used for first-mount and force-remounts (file imports / starters).
    const [canvasSeed, setCanvasSeed] = useState<string>(
        initial?.renderedHtml ?? preselectedStarter?.renderedHtml ?? "",
    )
    const [canvasSeedKey, setCanvasSeedKey] = useState(0)

    // Save state — drives the "Saved / Saving / Unsaved" indicator
    const [isDirty, setIsDirty] = useState(false)
    const [savedAt, setSavedAt] = useState<Date | null>(initial ? new Date() : null)

    const subjectInputRef = useRef<HTMLInputElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [settingsOpen, setSettingsOpen] = useState(false)

    const [testTo, setTestTo] = useState("")
    const [isSendingTest, setIsSendingTest] = useState(false)

    const [previewName, setPreviewName] = useState("Jane Doe")
    const [previewEmail, setPreviewEmail] = useState("jane@example.com")
    const previewContext = buildContactContext(
        { name: previewName, email: previewEmail, phone: "+1 555 555 0100" },
        { name: workspaceName ?? "Your Company" },
    )
    const previewSubject = renderTokens(subject, previewContext)
    const previewHtml = renderTokensHtml(html, previewContext)

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

    const handleEditorChange = (nextHtml: string, project: ProjectData) => {
        setHtml(nextHtml)
        setDesignJson(project)
        setIsDirty(true)
    }

    // Mark dirty whenever the user edits any template-level field.
    const markDirty = () => setIsDirty(true)

    const handleHtmlFileChosen = async (file: File) => {
        if (!file) return
        const lower = file.name.toLowerCase()
        if (!lower.endsWith(".html") && !lower.endsWith(".htm") && !file.type.includes("html")) {
            toast.error("Pick an .html file (the file you got from Claude / Figma export / etc.)")
            return
        }
        if (file.size > 1_000_000) {
            toast.error("HTML file is too large (max 1 MB)")
            return
        }
        try {
            const text = await file.text()
            if (html.trim() && !confirm("This will replace your current design. Continue?")) {
                return
            }
            setCanvasSeed(text)
            setCanvasSeedKey((n) => n + 1)
            setDesignJson(null)
            toast.success(`Imported ${file.name}`)
            setSettingsOpen(false)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to read file")
        }
    }

    const handleUseStarter = (s: StarterOption) => {
        if (
            (name.trim() || subject.trim() || html.trim()) &&
            !confirm("This will replace your current draft. Continue?")
        ) {
            return
        }
        setName(s.name)
        setSubject(s.subject)
        setCanvasSeed(s.renderedHtml)
        setCanvasSeedKey((n) => n + 1)
        setDesignJson(null)
        toast.success(`Loaded "${s.name}"`)
        setSettingsOpen(false)
    }

    const handleSendTest = () => {
        if (!testTo.trim()) {
            toast.error("Enter a recipient email")
            return
        }
        if (!subject.trim() || !html.trim()) {
            toast.error("Add a subject and design something first")
            return
        }
        setIsSendingTest(true)
        sendTemplateTestAction({
            to: testTo.trim(),
            subject: subject.trim(),
            html,
        })
            .then((res) => {
                if (!res.success) {
                    toast.error(res.error || "Send failed")
                    return
                }
                toast.success(
                    `Sent. ${res.balanceAfter !== undefined ? `Credits left: ${res.balanceAfter}` : ""}`,
                )
            })
            .catch((err) => {
                toast.error(err instanceof Error ? err.message : "Send failed")
            })
            .finally(() => setIsSendingTest(false))
    }

    const handleSave = () => {
        if (!name.trim()) {
            toast.error("Name is required")
            return
        }
        if (!html.trim()) {
            toast.error("Design something first")
            return
        }
        startTransition(async () => {
            const result = await saveTemplateAction({
                id: templateId ?? undefined,
                name: name.trim(),
                subject: subject.trim(),
                description: description.trim() || undefined,
                renderedHtml: html,
                designJson: (designJson as Record<string, unknown> | null) ?? null,
            })
            if (!result.success || !result.template) {
                toast.error(result.error || "Failed to save")
                return
            }
            setTemplateId(result.template.id)
            setIsDirty(false)
            setSavedAt(new Date())
            toast.success("Template saved")
            // For new templates, redirect to the edit URL so the back button works
            if (!initial) {
                router.push(`/marketing/email/templates/${result.template.id}`)
            }
        })
    }

    // Cmd/Ctrl+S to save from anywhere
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault()
                if (!isPending) handleSave()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
        // handleSave references stable refs / state; intentionally not in deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPending, name, subject, html, designJson, description])

    // Warn before navigating away with unsaved template changes
    useEffect(() => {
        if (!isDirty) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ""
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [isDirty])

    return (
        <div className="flex flex-col h-[calc(100dvh-72px)] bg-background">
            {/* Top toolbar — single row containing all template-level chrome.
                Keeps the editor pinned in a stable layout below it so GrapesJS's
                drop-position math doesn't drift on page scroll. */}
            <header className="h-14 border-b shrink-0 flex items-center px-3 gap-2 bg-card">
                <Link href="/marketing/email/templates">
                    <Button variant="ghost" size="icon" className="h-9 w-9" title="Back">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <Input
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value)
                        markDirty()
                    }}
                    placeholder="Untitled template"
                    className={`h-9 max-w-xs border-0 bg-transparent shadow-none focus-visible:bg-muted/40 font-medium ${!name.trim() ? "placeholder:text-amber-600/70" : ""}`}
                    disabled={isPending}
                />
                <Separator orientation="vertical" className="h-6" />
                <div className="flex-1 min-w-0 flex items-center gap-1">
                    <Input
                        ref={subjectInputRef}
                        value={subject}
                        onChange={(e) => {
                            setSubject(e.target.value)
                            markDirty()
                        }}
                        placeholder="Subject — what recipients see in their inbox"
                        className={`h-9 border-0 bg-transparent shadow-none focus-visible:bg-muted/40 ${!subject.trim() ? "placeholder:text-amber-600/70" : ""}`}
                        disabled={isPending}
                    />
                    {/* Personalization token count — quick reassurance that {{name}}
                        etc. are wired up. Hidden when subject is empty. */}
                    {subject && (() => {
                        const tokens = subject.match(/\{\{[^}]+\}\}/g) || []
                        if (tokens.length === 0) return null
                        return (
                            <span
                                className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0"
                                title={`Personalized with ${tokens.length} merge ${tokens.length === 1 ? "token" : "tokens"}`}
                            >
                                {tokens.length} token{tokens.length === 1 ? "" : "s"}
                            </span>
                        )
                    })()}
                    <TokenInserter
                        onInsert={insertIntoSubject}
                        size="sm"
                        label="Token"
                        disabled={isPending}
                    />
                </div>

                <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <Settings2 className="w-3.5 h-3.5" />
                            Settings
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="sm:max-w-md w-full flex flex-col p-0">
                        <SheetHeader className="px-5 py-4 border-b shrink-0">
                            <SheetTitle>Template settings</SheetTitle>
                            <SheetDescription>
                                Description, starter templates, preview, and test send.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <div className="p-5 space-y-6">
                                {/* Description */}
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description (internal note)</Label>
                                    <Input
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Short note about when to use this template"
                                        disabled={isPending}
                                    />
                                </div>

                                {/* Starter templates — only when creating new */}
                                {!initial && starterTemplates && starterTemplates.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            Start from a template
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Replaces your current design.
                                        </p>
                                        <div className="space-y-3">
                                            {Object.entries(
                                                starterTemplates.reduce<Record<string, StarterOption[]>>(
                                                    (acc, s) => {
                                                        const cat = s.category || "Other"
                                                        if (!acc[cat]) acc[cat] = []
                                                        acc[cat].push(s)
                                                        return acc
                                                    },
                                                    {},
                                                ),
                                            ).map(([category, items]) => (
                                                <div key={category} className="space-y-1.5">
                                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                                                        {category}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {items.map((s) => (
                                                            <button
                                                                key={s.slug}
                                                                type="button"
                                                                onClick={() => handleUseStarter(s)}
                                                                disabled={isPending}
                                                                className="text-left border rounded-md overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all disabled:opacity-50 group"
                                                            >
                                                                <TemplatePreview
                                                                    html={s.renderedHtml}
                                                                    height={120}
                                                                />
                                                                <div className="p-2 space-y-0.5">
                                                                    <div className="text-xs font-medium leading-tight group-hover:text-primary transition-colors">
                                                                        {s.name}
                                                                    </div>
                                                                    <div className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                                                                        {s.description}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Import .html */}
                                <div className="space-y-2">
                                    <Label>Import HTML</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Replace the canvas with HTML you exported from Claude, Figma,
                                        Stripo, etc. Replaces current design.
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".html,.htm,text/html"
                                        className="hidden"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0]
                                            if (f) handleHtmlFileChosen(f)
                                            e.target.value = ""
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isPending}
                                    >
                                        <Upload className="w-3.5 h-3.5 mr-2" />
                                        Choose .html file
                                    </Button>
                                </div>

                                <Separator />

                                {/* Preview as recipient */}
                                <div className="space-y-3">
                                    <Label>Preview as recipient</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label htmlFor="previewName" className="text-xs">
                                                Name
                                            </Label>
                                            <Input
                                                id="previewName"
                                                value={previewName}
                                                onChange={(e) => setPreviewName(e.target.value)}
                                                disabled={isPending}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="previewEmail" className="text-xs">
                                                Email
                                            </Label>
                                            <Input
                                                id="previewEmail"
                                                value={previewEmail}
                                                onChange={(e) => setPreviewEmail(e.target.value)}
                                                disabled={isPending}
                                            />
                                        </div>
                                    </div>
                                    {subject && (
                                        <div className="text-xs">
                                            <span className="text-muted-foreground">Subject: </span>
                                            <span className="font-medium">{previewSubject}</span>
                                        </div>
                                    )}
                                    <EmailPreview html={previewHtml} height={360} />
                                </div>

                                <Separator />

                                {/* Send a test */}
                                <div className="space-y-2">
                                    <Label>Send a test email</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Sends to one address with CSS inlined and tokens rendered. Deducts 1 credit.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="email"
                                            placeholder="you@example.com"
                                            value={testTo}
                                            onChange={(e) => setTestTo(e.target.value)}
                                            disabled={isSendingTest || isPending}
                                        />
                                        <Button
                                            type="button"
                                            onClick={handleSendTest}
                                            disabled={
                                                isSendingTest || isPending || !testTo.trim()
                                            }
                                            variant="outline"
                                        >
                                            {isSendingTest ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Send className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>

                <SaveIndicator
                    isDirty={isDirty}
                    isSaving={isPending}
                    savedAt={savedAt}
                />

                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    size="sm"
                    className="gap-1.5"
                    title="Save (⌘S)"
                >
                    {isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Save
                </Button>
            </header>

            {/* Editor fills the entire remaining area. The container has fixed
                height (set by the parent flex), so the iframe never moves —
                drop math stays accurate. */}
            <div className="flex-1 min-h-0">
                <GrapesEmailEditor
                    key={canvasSeedKey}
                    initialProject={canvasSeedKey === 0 ? designJson : null}
                    initialHtml={canvasSeed}
                    onChange={handleEditorChange}
                    onSave={handleSave}
                />
            </div>
        </div>
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
    const [tick, setTick] = useState(0)

    // Re-render every 30s so "Saved Xm ago" text stays current
    useEffect(() => {
        if (!savedAt) return
        const id = setInterval(() => setTick((t) => t + 1), 30_000)
        return () => clearInterval(id)
    }, [savedAt])

    if (isSaving) {
        return (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving…
            </div>
        )
    }
    if (isDirty) {
        return (
            <div className="text-xs text-amber-600 flex items-center gap-1.5">
                <CircleDot className="w-3 h-3" />
                Unsaved changes
            </div>
        )
    }
    if (savedAt) {
        return (
            <div
                key={tick}
                className="text-xs text-muted-foreground flex items-center gap-1.5"
            >
                <Check className="w-3 h-3 text-emerald-600" />
                Saved {formatRelative(savedAt)}
            </div>
        )
    }
    return null
}

function formatRelative(d: Date): string {
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
    if (seconds < 5) return "just now"
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
}
