"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Sparkles, Loader2, X, Check, Lock } from "lucide-react"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { inlineWrite } from "@/lib/ai/inline-write-action"
import { useWorkspacePlan } from "@/hooks/useWorkspacePlan"
import { sanitizeHtml } from "@/lib/sanitize-html"

interface Props {
    /** Picks system prompt + output formatting. */
    feature: "inline_email_writer" | "inline_sms_writer" | "subject_line"
    /** Optional contact id — passed to the AI for personalization. */
    contactId?: string
    /** The existing draft, if any — AI will refine instead of rewrite. */
    existing?: string
    /** Called with the AI-generated text when the user accepts it. For
     *  subject_line the text is 3 newline-separated options; the caller
     *  picks one in their own UI (or we render a quick picker). */
    onAccept: (text: string) => void
    /** Visual variant — "icon" is a small button beside other inputs,
     *  "pill" is a full-width "✨ Write with AI" button. */
    variant?: "icon" | "pill"
    /** Optional className override for the trigger button. */
    triggerClassName?: string
    /** Disable the trigger (e.g. while parent is sending). */
    disabled?: boolean
}

const FEATURE_LABELS: Record<Props["feature"], { dialogTitle: string; placeholder: string; cta: string }> = {
    inline_email_writer: {
        dialogTitle: "Write email with AI",
        placeholder: "What should the email say? e.g. \"Follow up about Tuesday's quote, ask if they have questions, suggest a 15-min call.\"",
        cta: "Generate email",
    },
    inline_sms_writer: {
        dialogTitle: "Write SMS with AI",
        placeholder: "What should the text say? e.g. \"Quick reminder about tomorrow's appointment.\"",
        cta: "Generate SMS",
    },
    subject_line: {
        dialogTitle: "Generate subject lines",
        placeholder: "What's the email about? e.g. \"Q1 retainer renewal proposal.\"",
        cta: "Generate 3 options",
    },
}

export function WriteWithAIButton({
    feature,
    contactId,
    existing,
    onAccept,
    variant = "icon",
    triggerClassName,
    disabled,
}: Props) {
    const [open, setOpen] = useState(false)
    const [instruction, setInstruction] = useState("")
    const [generating, setGenerating] = useState(false)
    const [draft, setDraft] = useState<string | null>(null)
    /** For subject_line: which of the 3 options is selected. */
    const [pickedIndex, setPickedIndex] = useState<number | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const { hasFeature, loading: planLoading } = useWorkspacePlan()
    const aiUnlocked = hasFeature("aiInlineWrite")

    const meta = FEATURE_LABELS[feature]

    const handleGenerate = async () => {
        if (!instruction.trim()) {
            toast.error("Tell the AI what to write")
            return
        }
        setGenerating(true)
        const res = await inlineWrite({
            feature,
            instruction: instruction.trim(),
            contactId,
            existing,
        })
        setGenerating(false)
        if (!res.success || !res.text) {
            toast.error(res.error || "AI couldn't generate a draft")
            return
        }
        setDraft(res.text)
        if (feature === "subject_line") setPickedIndex(0)
    }

    const handleAccept = () => {
        if (!draft) return
        if (feature === "subject_line") {
            const lines = draft.split("\n").map((s) => s.trim()).filter(Boolean)
            const chosen = pickedIndex !== null ? lines[pickedIndex] : lines[0]
            onAccept(chosen || "")
        } else {
            onAccept(draft)
        }
        // Reset state for next open
        setDraft(null)
        setInstruction("")
        setPickedIndex(null)
        setOpen(false)
    }

    const handleClose = () => {
        setOpen(false)
        // Don't clear instruction immediately — give the user a chance to
        // re-open and tweak the same instruction. Drafts clear though.
        setDraft(null)
        setPickedIndex(null)
    }

    const subjectLines = draft && feature === "subject_line"
        ? draft.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3)
        : []

    // Free tier: clicking the trigger opens an upgrade promo instead
    // of the AI dialog. We don't hide the button entirely because seeing
    // it (with a lock icon) is a discoverability hint for upsell.
    const handleTriggerClick = () => {
        if (planLoading) return
        setOpen(true)
        if (aiUnlocked) {
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }

    return (
        <>
            {variant === "icon" ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={triggerClassName || `h-8 w-8 p-0 ${aiUnlocked ? "text-violet-500 hover:text-violet-600 hover:bg-violet-500/10" : "text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10"}`}
                    onClick={handleTriggerClick}
                    disabled={disabled || planLoading}
                    title={aiUnlocked ? "Write with AI" : "Write with AI · Pro"}
                >
                    {aiUnlocked ? <Sparkles className="h-4 w-4" /> : (
                        <span className="relative inline-flex items-center justify-center">
                            <Sparkles className="h-4 w-4" />
                            <Lock className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-px" />
                        </span>
                    )}
                </Button>
            ) : (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={triggerClassName || "gap-1.5 text-violet-600 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/10"}
                    onClick={handleTriggerClick}
                    disabled={disabled || planLoading}
                >
                    {aiUnlocked ? <Sparkles className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {aiUnlocked ? "Write with AI" : "Write with AI · Pro"}
                </Button>
            )}

            {/* Upgrade promo dialog for free workspaces */}
            <Dialog open={open && !aiUnlocked} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-violet-500" />
                            Write with AI is a Pro feature
                        </DialogTitle>
                        <DialogDescription>
                            Generate emails, SMS, and subject lines tailored to each contact —
                            in one click. Available on Pro and Max plans.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                            <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                            <span>Refines existing drafts or writes from scratch</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                            <span>Pulls in contact context (name, business, last touch)</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                            <span>Use your own Anthropic / OpenAI / Gemini key</span>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Maybe later
                        </Button>
                        <Link href="/settings/billing" onClick={() => setOpen(false)}>
                            <Button>
                                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                                Upgrade to Pro
                            </Button>
                        </Link>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={open && aiUnlocked} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-violet-500" />
                            {meta.dialogTitle}
                        </DialogTitle>
                        <DialogDescription>
                            Describe what you want — the AI writes the draft.{existing ? " It'll refine your existing text rather than start over." : ""}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <Input
                            ref={inputRef}
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder={meta.placeholder}
                            disabled={generating}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && instruction.trim() && !draft) {
                                    e.preventDefault()
                                    handleGenerate()
                                }
                            }}
                        />

                        {/* Draft preview area */}
                        {draft && feature === "subject_line" && (
                            <div className="rounded-md border bg-muted/30 p-2 space-y-1">
                                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 px-1">
                                    Pick a subject
                                </div>
                                {subjectLines.map((line, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setPickedIndex(idx)}
                                        className={`w-full text-left text-sm px-2 py-1.5 rounded transition-colors flex items-center gap-2 ${
                                            pickedIndex === idx
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "hover:bg-muted"
                                        }`}
                                    >
                                        {pickedIndex === idx ? (
                                            <Check className="h-3.5 w-3.5 shrink-0" />
                                        ) : (
                                            <span className="h-3.5 w-3.5 shrink-0 rounded-full border" />
                                        )}
                                        <span className="truncate">{line}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {draft && feature !== "subject_line" && (
                            <div className="rounded-md border bg-muted/30 p-2 max-h-[280px] overflow-y-auto">
                                {feature === "inline_email_writer" ? (
                                    <div
                                        className="text-sm prose prose-sm max-w-none dark:prose-invert"
                                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(draft) }}
                                    />
                                ) : (
                                    <p className="text-sm whitespace-pre-wrap">{draft}</p>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        {draft ? (
                            <>
                                <Button
                                    variant="ghost"
                                    onClick={() => { setDraft(null); setPickedIndex(null) }}
                                    disabled={generating}
                                >
                                    <X className="h-3.5 w-3.5 mr-1.5" />
                                    Try again
                                </Button>
                                <Button onClick={handleAccept} className="gap-1.5">
                                    <Check className="h-3.5 w-3.5" />
                                    Use this
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                                <Button
                                    onClick={handleGenerate}
                                    disabled={!instruction.trim() || generating}
                                    className="gap-1.5"
                                >
                                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                    {meta.cta}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
