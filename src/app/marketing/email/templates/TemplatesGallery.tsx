"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ArrowRight, Search, Sparkles, X } from "lucide-react"
import { TemplateTile } from "./TemplateTile"
import { TemplatePreview } from "./TemplatePreview"

interface UserTemplate {
    id: string
    name: string
    subject: string
    description?: string
    renderedHtml: string
    updatedAt: string
}

interface StarterTemplate {
    slug: string
    name: string
    subject: string
    description: string
    category: string
    renderedHtml: string
}

type SortMode = "recent" | "name" | "subject"

export function TemplatesGallery({
    templates,
    starters,
}: {
    templates: UserTemplate[]
    starters: StarterTemplate[]
}) {
    const [search, setSearch] = useState("")
    const [sort, setSort] = useState<SortMode>("recent")
    const [starterCategory, setStarterCategory] = useState<string>("all")

    const lower = search.trim().toLowerCase()

    const filteredTemplates = useMemo(() => {
        const arr = !lower
            ? templates
            : templates.filter(
                  (t) =>
                      t.name.toLowerCase().includes(lower) ||
                      (t.subject ?? "").toLowerCase().includes(lower) ||
                      (t.description ?? "").toLowerCase().includes(lower),
              )
        const sorted = [...arr]
        if (sort === "recent") {
            sorted.sort((a, b) =>
                String(b.updatedAt).localeCompare(String(a.updatedAt)),
            )
        } else if (sort === "name") {
            sorted.sort((a, b) => a.name.localeCompare(b.name))
        } else {
            sorted.sort((a, b) =>
                (a.subject ?? "").localeCompare(b.subject ?? ""),
            )
        }
        return sorted
    }, [templates, lower, sort])

    const starterCategories = useMemo(() => {
        const set = new Set<string>()
        starters.forEach((s) => s.category && set.add(s.category))
        return Array.from(set).sort()
    }, [starters])

    const filteredStarters = useMemo(() => {
        let arr = starters
        if (starterCategory !== "all") {
            arr = arr.filter((s) => s.category === starterCategory)
        }
        if (lower) {
            arr = arr.filter(
                (s) =>
                    s.name.toLowerCase().includes(lower) ||
                    s.description.toLowerCase().includes(lower) ||
                    s.subject.toLowerCase().includes(lower),
            )
        }
        return arr
    }, [starters, starterCategory, lower])

    return (
        <div className="space-y-10">
            {/* Search + sort toolbar */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search templates by name, subject, or description"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 pr-8 h-9"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Clear search"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                {templates.length > 0 && (
                    <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                        <SelectTrigger className="w-[150px] h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="recent">Recently updated</SelectItem>
                            <SelectItem value="name">Name (A-Z)</SelectItem>
                            <SelectItem value="subject">Subject (A-Z)</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* User templates */}
            {templates.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Your templates
                        </h2>
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {filteredTemplates.length} of {templates.length}
                        </span>
                    </div>
                    {filteredTemplates.length === 0 ? (
                        <Card className="p-6 text-sm text-muted-foreground text-center">
                            No templates match &ldquo;{search}&rdquo;.
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTemplates.map((t) => (
                                <TemplateTile
                                    key={t.id}
                                    template={t}
                                />
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Starter templates */}
            <section className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Start from a template
                    </h2>
                    <div className="flex items-center gap-2">
                        {starterCategories.length > 1 && (
                            <Select value={starterCategory} onValueChange={setStarterCategory}>
                                <SelectTrigger className="w-[160px] h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All categories</SelectItem>
                                    {starterCategories.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {filteredStarters.length} of {starters.length}
                        </span>
                    </div>
                </div>
                {templates.length === 0 && !search && (
                    <Card className="p-6 text-sm text-muted-foreground">
                        You don&apos;t have any templates yet. Pick a starter below to get
                        going in seconds — every starter is fully editable.
                    </Card>
                )}
                {filteredStarters.length === 0 ? (
                    <Card className="p-6 text-sm text-muted-foreground text-center">
                        No starters match your filters.
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredStarters.map((s) => (
                            <Link
                                key={s.slug}
                                href={`/marketing/email/templates/new?starter=${s.slug}`}
                                className="group"
                            >
                                <Card className="h-full p-0 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40 transition-all duration-150">
                                    <TemplatePreview html={s.renderedHtml} height={180} />
                                    <div className="p-4 space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] uppercase tracking-wider font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                                                {s.category}
                                            </span>
                                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                        <div className="font-semibold text-sm">{s.name}</div>
                                        <div className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                                            {s.description}
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
