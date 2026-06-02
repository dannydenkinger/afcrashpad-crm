"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    Layers,
    Loader2,
    Search,
    Sparkles,
    X,
} from "lucide-react"
import { applySnapshotAction, listSnapshotsAction } from "./snapshot-actions"

interface SnapshotInfo {
    slug: string
    name: string
    description: string
    category: string
    pipelineCount: number
    stageCount: number
    tagCount: number
    customFieldCount: number
    automationCount: number
    emailTemplateCount: number
}

export function SnapshotPicker() {
    const router = useRouter()
    const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([])
    const [currentSlug, setCurrentSlug] = useState<string>("generic")
    const [confirmSlug, setConfirmSlug] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    /** Currently selected category tab. "All" shows everything. */
    const [activeCategory, setActiveCategory] = useState<string>("All")
    /** Search query that filters by template name + description. */
    const [query, setQuery] = useState("")

    useEffect(() => {
        listSnapshotsAction()
            .then((res) => {
                setSnapshots(res.snapshots)
                setCurrentSlug(res.currentSlug)
            })
            .finally(() => setLoading(false))
    }, [])

    const handleApply = (slug: string) => {
        const snap = snapshots.find((s) => s.slug === slug)
        if (!snap) return
        setConfirmSlug(slug)
    }

    const performApply = () => {
        if (!confirmSlug) return
        const slug = confirmSlug
        setConfirmSlug(null)
        startTransition(async () => {
            const result = await applySnapshotAction(slug)
            if (!result.success) {
                toast.error(("error" in result && result.error) || "Failed to apply template")
                return
            }
            const parts: string[] = []
            if (result.pipelinesCreated)
                parts.push(
                    `${result.pipelinesCreated} pipeline${result.pipelinesCreated === 1 ? "" : "s"}`,
                )
            if (result.stagesCreated) parts.push(`${result.stagesCreated} stages`)
            if (result.tagsCreated) parts.push(`${result.tagsCreated} tags`)
            if (result.statusesCreated)
                parts.push(`${result.statusesCreated} statuses`)
            if (result.leadSourcesCreated)
                parts.push(`${result.leadSourcesCreated} lead sources`)
            if (result.customFieldsCreated)
                parts.push(`${result.customFieldsCreated} custom fields`)
            if (result.automationsCreated)
                parts.push(
                    `${result.automationsCreated} automation${result.automationsCreated === 1 ? "" : "s"}`,
                )
            if (result.emailTemplatesCreated)
                parts.push(
                    `${result.emailTemplatesCreated} email template${result.emailTemplatesCreated === 1 ? "" : "s"}`,
                )
            toast.success(
                parts.length > 0
                    ? `Applied "${result.snapshot}" — added ${parts.join(", ")}`
                    : `"${result.snapshot}" — already in sync, nothing new added`,
            )
            setCurrentSlug(slug)
            router.refresh()
        })
    }

    // ── Hooks below MUST stay above any early returns. React fingerprints
    //    each render by hook count + order; a `return` before a hook makes
    //    the second render appear to "add" hooks and crashes with #310.

    // Build category tabs from the actual snapshot data + the count of
    // templates per category so users can decide where to look first.
    const categories = useMemo(() => {
        const counts = new Map<string, number>()
        for (const s of snapshots) {
            counts.set(s.category, (counts.get(s.category) || 0) + 1)
        }
        return [{ name: "All", count: snapshots.length }, ...Array.from(counts).map(([name, count]) => ({ name, count }))]
    }, [snapshots])

    // Filter pipeline: category tab, then search query.
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        return snapshots.filter((s) => {
            if (activeCategory !== "All" && s.category !== activeCategory) return false
            if (!q) return true
            return (
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                s.category.toLowerCase().includes(q)
            )
        })
    }, [snapshots, activeCategory, query])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading templates…
            </div>
        )
    }

    const confirmSnapshot = confirmSlug ? snapshots.find((s) => s.slug === confirmSlug) : null

    return (
        <div className="space-y-3">
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 flex items-start gap-2">
                <Layers className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                <span>
                    Industry templates seed pipelines, tags, statuses, lead sources, and
                    custom fields tailored to a business type. Applying a template is{" "}
                    <strong>additive</strong> — your existing data stays put. Same-name
                    items are skipped.
                </span>
            </div>

            {/* Category tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b pb-2">
                {categories.map((c) => {
                    const active = c.name === activeCategory
                    return (
                        <button
                            key={c.name}
                            type="button"
                            onClick={() => setActiveCategory(c.name)}
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors ${
                                active
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            }`}
                        >
                            {c.name}
                            <span className={`text-[10px] tabular-nums ${active ? "text-primary/70" : "text-muted-foreground/70"}`}>
                                {c.count}
                            </span>
                        </button>
                    )
                })}
                <div className="relative ml-auto w-full sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
                    <Input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search templates…"
                        className="h-8 pl-8 pr-7 text-xs"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            aria-label="Clear search"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Active template callout — pinned visible regardless of filter so
                users always know what's currently applied even when searching. */}
            {(() => {
                const active = snapshots.find((s) => s.slug === currentSlug)
                if (!active) return null
                const inFilteredView = visible.some((v) => v.slug === currentSlug)
                if (inFilteredView) return null
                return (
                    <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-xs">
                                <span className="text-muted-foreground">Currently applied: </span>
                                <span className="font-medium">{active.name}</span>
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setActiveCategory("All"); setQuery("") }}
                            className="text-[11px] text-primary hover:underline"
                        >
                            Show
                        </button>
                    </div>
                )
            })()}

            {visible.length === 0 ? (
                <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                    No templates match. Clear the search or pick a different category.
                </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {visible.map((s) => {
                    const isActive = s.slug === currentSlug
                    return (
                        <div
                            key={s.slug}
                            className={`relative rounded-lg border p-4 transition-all ${
                                isActive
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/30 hover:bg-muted/30"
                            }`}
                        >
                            {isActive && (
                                <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Active
                                </span>
                            )}
                            <div className="flex items-start gap-2 mb-2">
                                <span className="text-[9px] uppercase tracking-wider font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                    {s.category}
                                </span>
                            </div>
                            <div className="font-semibold text-sm flex items-center gap-1.5">
                                {s.name}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-snug">
                                {s.description}
                            </p>
                            <div className="text-[10px] text-muted-foreground/80 mt-2 tabular-nums leading-relaxed">
                                <span className="block">
                                    {s.pipelineCount} pipeline{s.pipelineCount === 1 ? "" : "s"} ·{" "}
                                    {s.stageCount} stages · {s.tagCount} tags ·{" "}
                                    {s.customFieldCount} fields
                                </span>
                                {(s.automationCount > 0 || s.emailTemplateCount > 0) && (
                                    <span className="block text-primary/70">
                                        {s.automationCount > 0 && (
                                            <>
                                                {s.automationCount} automation
                                                {s.automationCount === 1 ? "" : "s"}
                                            </>
                                        )}
                                        {s.automationCount > 0 && s.emailTemplateCount > 0 && " · "}
                                        {s.emailTemplateCount > 0 && (
                                            <>
                                                {s.emailTemplateCount} email template
                                                {s.emailTemplateCount === 1 ? "" : "s"}
                                            </>
                                        )}
                                    </span>
                                )}
                            </div>
                            <Button
                                size="sm"
                                variant={isActive ? "outline" : "default"}
                                onClick={() => handleApply(s.slug)}
                                disabled={isPending}
                                className="mt-3 w-full gap-1.5"
                            >
                                {isPending ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Sparkles className="w-3.5 h-3.5" />
                                )}
                                {isActive ? "Re-apply (top up)" : "Apply template"}
                            </Button>
                        </div>
                    )
                })}
            </div>
            )}

            <Dialog open={confirmSlug !== null} onOpenChange={(v) => !v && setConfirmSlug(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            Apply &ldquo;{confirmSnapshot?.name}&rdquo;?
                        </DialogTitle>
                        <DialogDescription>
                            This will add the template&rsquo;s pipelines, tags, statuses, lead
                            sources, and custom fields to your workspace. Items with the same
                            name are skipped — nothing existing is overwritten or deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Pipelines</span>
                            <span className="font-medium tabular-nums">
                                up to {confirmSnapshot?.pipelineCount ?? 0}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Stages</span>
                            <span className="font-medium tabular-nums">
                                up to {confirmSnapshot?.stageCount ?? 0}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Tags</span>
                            <span className="font-medium tabular-nums">
                                up to {confirmSnapshot?.tagCount ?? 0}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Custom fields</span>
                            <span className="font-medium tabular-nums">
                                up to {confirmSnapshot?.customFieldCount ?? 0}
                            </span>
                        </div>
                        {(confirmSnapshot?.automationCount ?? 0) > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Automations (created off, you flip on)</span>
                                <span className="font-medium tabular-nums">
                                    up to {confirmSnapshot?.automationCount ?? 0}
                                </span>
                            </div>
                        )}
                        {(confirmSnapshot?.emailTemplateCount ?? 0) > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Email templates</span>
                                <span className="font-medium tabular-nums">
                                    up to {confirmSnapshot?.emailTemplateCount ?? 0}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 p-2 rounded">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                            Adding new pipeline stages with different probabilities won&rsquo;t
                            change any existing opportunity&rsquo;s stage. You may want to clean
                            up unused defaults afterward.
                        </span>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmSlug(null)}>
                            Cancel
                        </Button>
                        <Button onClick={performApply}>
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                            Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
