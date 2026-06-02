"use client"

import { useMemo } from "react"
import {
    AlertTriangle,
    CheckCircle2,
    Image as ImageIcon,
    Info,
    Link as LinkIcon,
    ShieldCheck,
    Sparkles,
    Type,
} from "lucide-react"

interface PreflightInput {
    name: string
    subject: string
    html: string
    audienceCount: number | null
    sesReady: boolean
    abEnabled: boolean
    abVariants?: [string, string]
}

type Severity = "ok" | "warn" | "info" | "error"

interface CheckResult {
    id: string
    severity: Severity
    title: string
    detail?: string
    Icon: React.ComponentType<{ className?: string }>
}

export function PreflightChecks({
    name,
    subject,
    html,
    audienceCount,
    sesReady,
    abEnabled,
    abVariants,
}: PreflightInput) {
    const checks = useMemo<CheckResult[]>(() => {
        const out: CheckResult[] = []

        // SES verification
        out.push({
            id: "ses",
            severity: sesReady ? "ok" : "error",
            title: sesReady ? "Sending domain verified" : "Sending domain NOT verified",
            detail: sesReady
                ? undefined
                : "Verify a domain in Settings → Integrations → Amazon SES before sending.",
            Icon: ShieldCheck,
        })

        // Audience size
        if (audienceCount === null || audienceCount === undefined) {
            out.push({
                id: "audience",
                severity: "info",
                title: "Audience not yet calculated",
                Icon: Info,
            })
        } else if (audienceCount === 0) {
            out.push({
                id: "audience",
                severity: "error",
                title: "No recipients in audience",
                detail: "Pick a list, add tags, or expand targeting.",
                Icon: AlertTriangle,
            })
        } else {
            out.push({
                id: "audience",
                severity: "ok",
                title: `${audienceCount.toLocaleString()} recipients targeted`,
                Icon: CheckCircle2,
            })
        }

        // Subject line
        const subj = subject.trim()
        if (!subj) {
            out.push({
                id: "subject-empty",
                severity: "error",
                title: "Subject line is empty",
                Icon: Type,
            })
        } else {
            if (subj.length > 80) {
                out.push({
                    id: "subject-long",
                    severity: "warn",
                    title: `Subject is long (${subj.length} chars)`,
                    detail: "Many inboxes truncate after ~50 characters on mobile.",
                    Icon: Type,
                })
            }
            // ALL CAPS / lots of punctuation = spam-y
            const letters = subj.replace(/[^A-Za-z]/g, "")
            const upper = subj.replace(/[^A-Z]/g, "")
            if (letters.length > 6 && upper.length / letters.length > 0.7) {
                out.push({
                    id: "subject-caps",
                    severity: "warn",
                    title: "Subject is mostly UPPERCASE",
                    detail: "Spam filters dock all-caps subjects. Mix case for better delivery.",
                    Icon: AlertTriangle,
                })
            }
            const exclam = (subj.match(/!/g) || []).length
            if (exclam >= 2) {
                out.push({
                    id: "subject-excl",
                    severity: "warn",
                    title: "Multiple exclamation marks in subject",
                    detail: "Reduces inbox placement — remove all but one.",
                    Icon: AlertTriangle,
                })
            }
            const spamWords = /\b(free|guarantee|act now|limited time|click here|earn \$|cash bonus)\b/i
            if (spamWords.test(subj)) {
                out.push({
                    id: "subject-spam",
                    severity: "warn",
                    title: "Subject contains spammy phrasing",
                    detail: "Phrases like 'Free', 'Click here', 'Limited time' get flagged by filters.",
                    Icon: AlertTriangle,
                })
            }
        }

        // Body
        const body = html.trim()
        if (!body) {
            out.push({
                id: "body-empty",
                severity: "error",
                title: "Body is empty",
                Icon: Type,
            })
        } else {
            // Token integrity — find unbalanced or unsupported tokens
            const tokenMatches = (subj + " " + body).match(/\{\{\s*([^}]*)\s*\}\}/g) ?? []
            const knownTokens = new Set([
                "first_name",
                "last_name",
                "name",
                "email",
                "company",
                "company_name",
                "unsubscribe_url",
                "phone",
            ])
            const unknown: string[] = []
            for (const raw of tokenMatches) {
                const inner = raw.replace(/[{}]/g, "").trim()
                if (!inner) continue
                const baseKey = inner.split(/[.|\s]/)[0]
                if (!knownTokens.has(baseKey) && !inner.startsWith("custom.")) {
                    unknown.push(inner)
                }
            }
            const uniqueUnknown = Array.from(new Set(unknown))
            if (uniqueUnknown.length > 0) {
                out.push({
                    id: "tokens-unknown",
                    severity: "warn",
                    title: `Unknown personalization token${uniqueUnknown.length === 1 ? "" : "s"}`,
                    detail: `${uniqueUnknown.slice(0, 3).join(", ")}${uniqueUnknown.length > 3 ? "…" : ""} — these stay literal in the sent email.`,
                    Icon: AlertTriangle,
                })
            }
            // Stray single braces — likely typo: {first_name} instead of {{first_name}}
            const strayMatches = body.match(/(?<![{])\{\s*[a-z_]+\s*\}(?!\})/gi)
            if (strayMatches && strayMatches.length > 0) {
                out.push({
                    id: "tokens-typo",
                    severity: "warn",
                    title: "Possible token typo",
                    detail: `Found ${strayMatches[0]} — tokens use double braces: {{first_name}}.`,
                    Icon: AlertTriangle,
                })
            }
            // Image alt text
            const imgs = body.match(/<img\b[^>]*>/gi) ?? []
            const missingAlt = imgs.filter((tag) => !/\balt\s*=\s*["'][^"']+["']/i.test(tag))
            if (missingAlt.length > 0) {
                out.push({
                    id: "img-alt",
                    severity: "warn",
                    title: `${missingAlt.length} image${missingAlt.length === 1 ? "" : "s"} missing alt text`,
                    detail: "Add descriptive alt text — Outlook blocks images by default and shows alt text instead.",
                    Icon: ImageIcon,
                })
            }
            // Link checks
            const anchorMatches = Array.from(body.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi))
            const hrefs = anchorMatches.map((m) => m[1])
            const brokenHrefs = hrefs.filter(
                (h) => h === "#" || h === "" || h.startsWith("javascript:"),
            )
            if (brokenHrefs.length > 0) {
                out.push({
                    id: "links-broken",
                    severity: "warn",
                    title: `${brokenHrefs.length} placeholder link${brokenHrefs.length === 1 ? "" : "s"}`,
                    detail: "Found <a href=\"#\"> or javascript: links — recipients will land nowhere.",
                    Icon: LinkIcon,
                })
            }
            // Unsubscribe link
            const hasUnsub =
                /unsubscribe/i.test(body) || /\{\{\s*unsubscribe_url\s*\}\}/i.test(body)
            if (!hasUnsub) {
                out.push({
                    id: "unsub",
                    severity: "warn",
                    title: "No unsubscribe link found",
                    detail:
                        "Required by CAN-SPAM/GDPR. Add a footer with {{unsubscribe_url}} or the word 'unsubscribe'.",
                    Icon: AlertTriangle,
                })
            }
            // Plain-text-only? Probably hand-written HTML
            if (!/<\/?\w+/.test(body)) {
                out.push({
                    id: "no-html",
                    severity: "info",
                    title: "Body has no HTML tags",
                    detail: "It will send as plain text — formatting won't render.",
                    Icon: Info,
                })
            }
            // Tracking pixel size: warn if HTML > 100 KB (Gmail clips at ~102 KB)
            const sizeKb = Math.round((body.length / 1024) * 10) / 10
            if (sizeKb > 100) {
                out.push({
                    id: "size",
                    severity: "warn",
                    title: `Body is ${sizeKb} KB`,
                    detail: "Gmail clips emails over ~102 KB and shows a 'view entire message' link.",
                    Icon: AlertTriangle,
                })
            }
        }

        // A/B configured
        if (abEnabled) {
            const a = (abVariants?.[0] ?? "").trim()
            const b = (abVariants?.[1] ?? "").trim()
            if (!a || !b) {
                out.push({
                    id: "ab-empty",
                    severity: "error",
                    title: "A/B test variants incomplete",
                    detail: "Both Subject A and Subject B must be filled in.",
                    Icon: AlertTriangle,
                })
            } else if (a.toLowerCase() === b.toLowerCase()) {
                out.push({
                    id: "ab-same",
                    severity: "warn",
                    title: "A/B variants are identical",
                    detail: "The test won't reveal anything — try different angles.",
                    Icon: AlertTriangle,
                })
            } else {
                out.push({
                    id: "ab-ok",
                    severity: "ok",
                    title: "A/B subjects look good",
                    Icon: Sparkles,
                })
            }
        }

        // Name
        if (!name.trim()) {
            out.push({
                id: "name",
                severity: "warn",
                title: "Campaign has no name",
                detail: "Pick a name so it's easy to find in reports later.",
                Icon: Info,
            })
        }

        return out
    }, [name, subject, html, audienceCount, sesReady, abEnabled, abVariants])

    const errors = checks.filter((c) => c.severity === "error").length
    const warnings = checks.filter((c) => c.severity === "warn").length
    const okCount = checks.filter((c) => c.severity === "ok").length
    const overall: Severity = errors > 0 ? "error" : warnings > 0 ? "warn" : "ok"

    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Pre-flight checks</h3>
                </div>
                <div
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        overall === "error"
                            ? "bg-red-500/10 text-red-700 dark:text-red-400"
                            : overall === "warn"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    }`}
                >
                    {overall === "error"
                        ? `${errors} blocker${errors === 1 ? "" : "s"}`
                        : overall === "warn"
                          ? `${warnings} warning${warnings === 1 ? "" : "s"}`
                          : `${okCount} pass`}
                </div>
            </div>
            <div className="divide-y">
                {checks.map((c) => (
                    <CheckRow key={c.id} check={c} />
                ))}
            </div>
        </div>
    )
}

function CheckRow({ check }: { check: CheckResult }) {
    const tone = {
        ok: {
            iconClass: "text-emerald-600 dark:text-emerald-400",
            ringClass: "bg-emerald-500/10",
        },
        warn: {
            iconClass: "text-amber-600 dark:text-amber-400",
            ringClass: "bg-amber-500/10",
        },
        info: {
            iconClass: "text-blue-600 dark:text-blue-400",
            ringClass: "bg-blue-500/10",
        },
        error: {
            iconClass: "text-red-600 dark:text-red-400",
            ringClass: "bg-red-500/10",
        },
    }[check.severity]
    const Icon = check.severity === "ok" ? CheckCircle2 : check.Icon
    return (
        <div className="px-4 py-2.5 flex items-start gap-3 text-sm">
            <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${tone.ringClass}`}
            >
                <Icon className={`w-3.5 h-3.5 ${tone.iconClass}`} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="font-medium leading-snug">{check.title}</div>
                {check.detail && (
                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {check.detail}
                    </div>
                )}
            </div>
        </div>
    )
}
