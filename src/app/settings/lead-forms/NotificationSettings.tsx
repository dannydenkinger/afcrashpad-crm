"use client"

import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { AtSign, Bell, Mail, Sparkles, Plus, X } from "lucide-react"
import type { LeadForm } from "./types"

interface Props {
    open: boolean
    onClose: () => void
    notifications: LeadForm["notifications"]
    onChange: (notifications: LeadForm["notifications"]) => void
}

const MERGE_TAGS: { tag: string; label: string; description: string }[] = [
    { tag: "{{name}}", label: "Name", description: "Submitter's name" },
    { tag: "{{email}}", label: "Email", description: "Submitter's email" },
    { tag: "{{phone}}", label: "Phone", description: "Submitter's phone" },
    { tag: "{{form_name}}", label: "Form name", description: "This form's name" },
]

const SUBJECT_PRESETS = [
    "Thanks for reaching out, {{name}}!",
    "We got your {{form_name}} submission",
    "Your message is on its way",
]

const BODY_TEMPLATE = `Hi {{name}},

Thank you for reaching out! We've received your message and will get back to you within one business day.

In the meantime, feel free to reply directly to this email if you have any other questions.

Best regards`

export function NotificationSettings({ open, onClose, notifications, onChange }: Props) {
    const config = notifications || {
        adminEmailEnabled: false,
        adminEmailAddresses: [],
        autoresponderEnabled: false,
        autoresponderSubject: "",
        autoresponderBody: "",
    }

    const update = (partial: Partial<NonNullable<LeadForm["notifications"]>>) =>
        onChange({ ...config, ...partial })

    // Refs to insert merge tags at the cursor position rather than just appending
    const subjectRef = useRef<HTMLInputElement | null>(null)
    const bodyRef = useRef<HTMLTextAreaElement | null>(null)
    const [activeField, setActiveField] = useState<"subject" | "body">("body")

    const insertTag = (tag: string) => {
        const target = activeField === "subject" ? subjectRef.current : bodyRef.current
        if (!target) {
            // Fallback: append to body
            update({ autoresponderBody: (config.autoresponderBody || "") + tag })
            return
        }
        const before = activeField === "subject"
            ? (config.autoresponderSubject || "").slice(0, target.selectionStart ?? 0)
            : (config.autoresponderBody || "").slice(0, target.selectionStart ?? 0)
        const after = activeField === "subject"
            ? (config.autoresponderSubject || "").slice(target.selectionEnd ?? 0)
            : (config.autoresponderBody || "").slice(target.selectionEnd ?? 0)
        const newValue = before + tag + after
        if (activeField === "subject") {
            update({ autoresponderSubject: newValue })
        } else {
            update({ autoresponderBody: newValue })
        }
        // Restore focus + cursor position right after the inserted tag
        setTimeout(() => {
            const t = activeField === "subject" ? subjectRef.current : bodyRef.current
            if (!t) return
            const pos = before.length + tag.length
            t.focus()
            t.setSelectionRange(pos, pos)
        }, 0)
    }

    const adminEmails = config.adminEmailAddresses || []

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent className="overflow-y-auto w-[420px] sm:w-[480px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        Notifications
                    </SheetTitle>
                    <SheetDescription>
                        Send yourself an alert when someone submits, and reply automatically
                        to keep submitters in the loop.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-5 mt-6">
                    {/* ── Admin Email ─────────────────────────────────────── */}
                    <section className="rounded-lg border bg-card overflow-hidden">
                        <div className="flex items-start gap-3 p-4">
                            <div className="w-9 h-9 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <AtSign className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">Notify your team</p>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                                    Get an email the moment someone submits this form.
                                </p>
                            </div>
                            <Switch
                                checked={config.adminEmailEnabled}
                                onCheckedChange={(v) => update({ adminEmailEnabled: v })}
                            />
                        </div>
                        {config.adminEmailEnabled && (
                            <div className="border-t p-4 bg-muted/20 space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Send to</Label>
                                    {adminEmails.length === 0 ? (
                                        <Input
                                            placeholder="email@company.com"
                                            className="h-8 text-sm"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === ",") {
                                                    e.preventDefault()
                                                    const value = (e.target as HTMLInputElement).value.trim().replace(/,$/, "")
                                                    if (value) {
                                                        update({ adminEmailAddresses: [value] })
                                                        ;(e.target as HTMLInputElement).value = ""
                                                    }
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value.trim()
                                                if (value) {
                                                    update({ adminEmailAddresses: [value] })
                                                    e.target.value = ""
                                                }
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <div className="flex flex-wrap gap-1.5">
                                                {adminEmails.map((email, idx) => (
                                                    <span
                                                        key={`${email}-${idx}`}
                                                        className="inline-flex items-center gap-1 text-xs bg-background border rounded-md px-2 py-1"
                                                    >
                                                        <span className="truncate max-w-[180px]" title={email}>{email}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => update({ adminEmailAddresses: adminEmails.filter((_, i) => i !== idx) })}
                                                            className="text-muted-foreground hover:text-destructive"
                                                            aria-label={`Remove ${email}`}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Input
                                                    placeholder="Add another address…"
                                                    className="h-7 text-xs"
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === ",") {
                                                            e.preventDefault()
                                                            const value = (e.target as HTMLInputElement).value.trim().replace(/,$/, "")
                                                            if (value && !adminEmails.includes(value)) {
                                                                update({ adminEmailAddresses: [...adminEmails, value] })
                                                                ;(e.target as HTMLInputElement).value = ""
                                                            }
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        const value = e.target.value.trim()
                                                        if (value && !adminEmails.includes(value)) {
                                                            update({ adminEmailAddresses: [...adminEmails, value] })
                                                            e.target.value = ""
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">
                                                Press Enter or comma to add another email.
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ── Auto-reply ──────────────────────────────────────── */}
                    <section className="rounded-lg border bg-card overflow-hidden">
                        <div className="flex items-start gap-3 p-4">
                            <div className="w-9 h-9 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                                <Mail className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">Auto-reply to submitter</p>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                                    Sends instantly so submitters know you got their message.
                                </p>
                            </div>
                            <Switch
                                checked={config.autoresponderEnabled}
                                onCheckedChange={(v) => update({ autoresponderEnabled: v })}
                            />
                        </div>
                        {config.autoresponderEnabled && (
                            <div className="border-t p-4 bg-muted/20 space-y-3">
                                {/* Subject */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Subject</Label>
                                    <Input
                                        ref={subjectRef}
                                        value={config.autoresponderSubject || ""}
                                        onChange={(e) => update({ autoresponderSubject: e.target.value })}
                                        onFocus={() => setActiveField("subject")}
                                        placeholder="Thanks for reaching out, {{name}}!"
                                        className="h-8 text-sm"
                                    />
                                    {!config.autoresponderSubject && (
                                        <div className="flex flex-wrap gap-1">
                                            {SUBJECT_PRESETS.map((preset) => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => update({ autoresponderSubject: preset })}
                                                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted-foreground/20 text-muted-foreground transition-colors"
                                                >
                                                    {preset.length > 32 ? preset.slice(0, 32) + "…" : preset}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Body */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs">Body</Label>
                                        {!config.autoresponderBody && (
                                            <button
                                                type="button"
                                                onClick={() => update({ autoresponderBody: BODY_TEMPLATE })}
                                                className="text-[10px] text-primary hover:underline flex items-center gap-1"
                                            >
                                                <Sparkles className="h-2.5 w-2.5" />
                                                Use sample copy
                                            </button>
                                        )}
                                    </div>
                                    <Textarea
                                        ref={bodyRef}
                                        value={config.autoresponderBody || ""}
                                        onChange={(e) => update({ autoresponderBody: e.target.value })}
                                        onFocus={() => setActiveField("body")}
                                        placeholder={BODY_TEMPLATE}
                                        rows={7}
                                        className="text-sm"
                                    />
                                </div>

                                {/* Merge tags — insert at cursor position */}
                                <div className="space-y-1.5 pt-1 border-t">
                                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                                        Insert merge tag
                                    </Label>
                                    <p className="text-[10px] text-muted-foreground">
                                        Tags get filled in per submission with the matching field value.
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {MERGE_TAGS.map(({ tag, label, description }) => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => insertTag(tag)}
                                                className="group inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded border bg-background hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors"
                                                title={description}
                                            >
                                                <Plus className="h-2.5 w-2.5 opacity-50 group-hover:opacity-100" />
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Help footer */}
                    <p className="text-[11px] text-muted-foreground leading-snug px-1">
                        Auto-replies and admin alerts use your workspace&apos;s connected email
                        provider (Gmail or SES). If neither is connected, notifications won&apos;t
                        send until you set one up in Settings → Integrations.
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    )
}
