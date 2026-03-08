"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ArrowLeft,
    Save,
    Eye,
    EyeOff,
    Wand2,
    Clock,
    FileText,
    Globe,
    Send,
    Copy,
    Check,
    Pencil,
    ImagePlus,
    Loader2,
    X,
} from "lucide-react"
import { toast } from "sonner"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const ReactMarkdown = dynamic(() => import("react-markdown"), {
    loading: () => <Skeleton className="h-[200px] w-full rounded-xl" />,
    ssr: false,
})
import remarkGfm from "remark-gfm"
import FAQEditor from "./FAQEditor"
import KeyTakeawaysEditor from "./KeyTakeawaysEditor"
import SEOChecklist from "./SEOChecklist"
import SchemaGenerator from "./SchemaGenerator"
import WordPressPublisher from "./WordPressPublisher"
import { createArticle, updateArticle, calculateSEOScore } from "./actions"
import type { BlogArticle, ArticleType, ArticleStatus, ContentCluster, FAQ, SEOScoreBreakdown } from "./types"

interface ArticleEditorProps {
    article?: BlogArticle | null
    clusters?: ContentCluster[]
    onBack: () => void
    onSaved: (article: BlogArticle) => void
    onOpenAIDialog: () => void
}

export default function ArticleEditor({
    article,
    clusters = [],
    onBack,
    onSaved,
    onOpenAIDialog,
}: ArticleEditorProps) {
    // ── Saved article reference (updates after first save) ──
    const [savedArticle, setSavedArticle] = useState<BlogArticle | null>(
        article?.id ? article : null
    )

    // ── Form state ──
    const [title, setTitle] = useState(article?.title || "")
    const [slug, setSlug] = useState(article?.slug || "")
    const [content, setContent] = useState(article?.content || "")
    const [excerpt, setExcerpt] = useState(article?.excerpt || "")
    const [type, setType] = useState<ArticleType>(article?.type || "standalone")
    const [status, setStatus] = useState<ArticleStatus>(article?.status || "draft")
    const [metaTitle, setMetaTitle] = useState(article?.metaTitle || "")
    const [metaDescription, setMetaDescription] = useState(article?.metaDescription || "")
    const [focusKeyword, setFocusKeyword] = useState(article?.focusKeyword || "")
    const [secondaryKeywords, setSecondaryKeywords] = useState(article?.secondaryKeywords?.join(", ") || "")
    const [keyTakeaways, setKeyTakeaways] = useState<string[]>(article?.keyTakeaways || [])
    const [faqs, setFaqs] = useState<FAQ[]>(article?.faqs || [])
    const [schemaMarkup, setSchemaMarkup] = useState(article?.schemaMarkup || "")
    const [categories, setCategories] = useState(article?.categories?.join(", ") || "")
    const [tags, setTags] = useState(article?.tags?.join(", ") || "")
    const [clusterId, setClusterId] = useState(article?.clusterId || "")

    // ── Featured image state ──
    const [featuredImageData, setFeaturedImageData] = useState<string | null>(article?.featuredImageData || null)
    const [featuredImageMime, setFeaturedImageMime] = useState(article?.featuredImageMime || "image/png")
    const [featuredImageAlt, setFeaturedImageAlt] = useState(article?.featuredImageAlt || "")
    const [featuredImageCaption, setFeaturedImageCaption] = useState(article?.featuredImageCaption || "")
    const [featuredImageTitle, setFeaturedImageTitle] = useState(article?.featuredImageTitle || "")
    const [generatingImage, setGeneratingImage] = useState(false)

    // ── UI state ──
    const [saving, setSaving] = useState(false)
    const [seoBreakdown, setSeoBreakdown] = useState<SEOScoreBreakdown | null>(null)
    const [copied, setCopied] = useState(false)
    const [autoSlug, setAutoSlug] = useState(!article?.slug)
    const [previewMode, setPreviewMode] = useState(false)

    // ── Derived values ──
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length
    const readingTime = Math.max(1, Math.ceil(wordCount / 250))

    // ── Auto-generate slug from title ──
    useEffect(() => {
        if (autoSlug && title) {
            setSlug(
                title
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "")
            )
        }
    }, [title, autoSlug])

    // ── Calculate SEO score on debounce ──
    useEffect(() => {
        const timer = setTimeout(async () => {
            const articleData: Partial<BlogArticle> = {
                title,
                slug,
                content,
                excerpt,
                type,
                metaTitle,
                metaDescription,
                focusKeyword,
                secondaryKeywords: secondaryKeywords.split(",").map((k) => k.trim()).filter(Boolean),
                keyTakeaways,
                faqs,
                schemaMarkup,
                author: article?.author || "Author",
            }
            const breakdown = await calculateSEOScore(articleData)
            setSeoBreakdown(breakdown)
        }, 800)

        return () => clearTimeout(timer)
    }, [title, slug, content, metaTitle, metaDescription, focusKeyword, keyTakeaways, faqs, schemaMarkup, type])

    // ── Save handler ──
    const handleSave = async () => {
        setSaving(true)
        try {
            const data: Partial<BlogArticle> = {
                title,
                slug,
                content,
                excerpt,
                status,
                type,
                clusterId: clusterId || undefined,
                metaTitle,
                metaDescription,
                focusKeyword,
                secondaryKeywords: secondaryKeywords.split(",").map((k) => k.trim()).filter(Boolean),
                keyTakeaways,
                faqs,
                schemaMarkup,
                categories: categories.split(",").map((c) => c.trim()).filter(Boolean),
                tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
                featuredImageData: featuredImageData || undefined,
                featuredImageMime: featuredImageData ? featuredImageMime : undefined,
                featuredImageAlt: featuredImageAlt || undefined,
                featuredImageCaption: featuredImageCaption || undefined,
                featuredImageTitle: featuredImageTitle || undefined,
            }

            let result
            if (savedArticle?.id) {
                result = await updateArticle(savedArticle.id, data)
            } else {
                result = await createArticle(data)
            }

            if (result.success && result.data) {
                toast.success(savedArticle?.id ? "Article updated" : "Article created")
                setSavedArticle(result.data)
                onSaved(result.data)
            } else {
                toast.error(result.error || "Failed to save")
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to save")
        }
        setSaving(false)
    }

    const copyMarkdown = async () => {
        try {
            await navigator.clipboard.writeText(content)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
            toast.success("Markdown copied to clipboard")
        } catch {
            toast.error("Failed to copy")
        }
    }

    // ── Generate featured image ──
    const handleGenerateImage = async () => {
        if (!title.trim()) {
            toast.error("Add a title before generating an image")
            return
        }
        setGeneratingImage(true)
        try {
            const res = await fetch("/api/blog/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    focusKeyword,
                    excerpt,
                    type,
                }),
            })

            const data = await res.json()
            if (!res.ok || !data.success) {
                toast.error(data.error || "Image generation failed")
                return
            }

            setFeaturedImageData(data.imageData)
            setFeaturedImageMime(data.mimeType || "image/png")
            setFeaturedImageAlt(data.altText || "")
            setFeaturedImageCaption(data.caption || "")
            setFeaturedImageTitle(data.titleAttr || "")
            toast.success("Featured image generated!")
        } catch (error: any) {
            toast.error(error.message || "Failed to generate image")
        } finally {
            setGeneratingImage(false)
        }
    }

    const articleForSchema: Partial<BlogArticle> = {
        title,
        slug,
        content,
        excerpt,
        type,
        metaTitle,
        metaDescription,
        focusKeyword,
        keyTakeaways,
        faqs,
        schemaMarkup,
        author: savedArticle?.author || article?.author,
        wordCount,
        publishedAt: savedArticle?.publishedAt || article?.publishedAt,
        updatedAt: savedArticle?.updatedAt || article?.updatedAt,
        wpPublishedUrl: savedArticle?.wpPublishedUrl || article?.wpPublishedUrl,
    }

    return (
        <div className="space-y-6">
            {/* Top bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={onBack} className="h-8 gap-1">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                            {savedArticle?.id ? "Editing" : "New Article"}
                        </Badge>
                        <Select value={status} onValueChange={(v) => setStatus(v as ArticleStatus)}>
                            <SelectTrigger className={`h-6 w-auto text-[10px] font-semibold border-0 px-2 gap-1 ${
                                status === "published"
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : status === "review"
                                    ? "bg-amber-500/10 text-amber-500"
                                    : status === "archived"
                                    ? "bg-rose-500/10 text-rose-500"
                                    : "bg-muted text-muted-foreground"
                            }`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="review">Review</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground mr-2">
                        <FileText className="h-3 w-3" />
                        <span className="text-[10px] font-medium">{wordCount.toLocaleString()} words</span>
                        <Clock className="h-3 w-3 ml-1" />
                        <span className="text-[10px] font-medium">{readingTime} min read</span>
                    </div>
                    <div className="flex items-center bg-muted/50 rounded-md p-0.5">
                        <Button
                            variant={!previewMode ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-[10px] gap-1 px-2"
                            onClick={() => setPreviewMode(false)}
                        >
                            <Pencil className="h-3 w-3" />
                            Edit
                        </Button>
                        <Button
                            variant={previewMode ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-[10px] gap-1 px-2"
                            onClick={() => setPreviewMode(true)}
                        >
                            <Eye className="h-3 w-3" />
                            Preview
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={copyMarkdown}>
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        Copy MD
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={onOpenAIDialog}>
                        <Wand2 className="h-3 w-3" />
                        AI Generate
                    </Button>
                    <Button size="sm" className="h-8 text-xs gap-1" onClick={handleSave} disabled={saving}>
                        <Save className="h-3 w-3" />
                        {saving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>

            {/* Full-page website preview */}
            {previewMode ? (
                <div className="max-w-3xl mx-auto">
                    {/* Preview header bar */}
                    <div className="flex items-center justify-between mb-4 px-1">
                        <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground font-mono">
                                afcrashpad.com/blog/{slug || "article-slug"}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => setPreviewMode(false)}
                        >
                            <Pencil className="h-3 w-3" />
                            Back to Editor
                        </Button>
                    </div>

                    {/* Article preview card */}
                    <Card className="border-border/50 bg-card/50 overflow-hidden">
                        <CardContent className="p-0">
                            {/* Featured image */}
                            {featuredImageData && (
                                <div className="relative w-full aspect-video overflow-hidden">
                                    <Image
                                        src={`data:${featuredImageMime};base64,${featuredImageData}`}
                                        alt={featuredImageAlt || title || "Featured image"}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 100vw, 700px"
                                        unoptimized
                                    />
                                    {featuredImageCaption && (
                                        <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white/80 text-[10px] px-4 py-1.5 italic">
                                            {featuredImageCaption}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="px-8 py-8 sm:px-12 sm:py-10">
                                {/* Category / type badges */}
                                <div className="flex items-center gap-2 mb-4">
                                    {categories.split(",").map((c) => c.trim()).filter(Boolean).map((cat, i) => (
                                        <Badge key={i} variant="secondary" className="text-[10px] h-5 px-2 font-semibold uppercase tracking-wider">
                                            {cat}
                                        </Badge>
                                    ))}
                                    {type !== "standalone" && (
                                        <Badge variant="outline" className="text-[10px] h-5 px-2 capitalize">
                                            {type}
                                        </Badge>
                                    )}
                                </div>

                                {/* Title */}
                                <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-4 text-foreground">
                                    {title || "Untitled Article"}
                                </h1>

                                {/* Meta line */}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-6 pb-6 border-b border-border/30">
                                    <span>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                                    <span>&middot;</span>
                                    <span>{readingTime} min read</span>
                                    <span>&middot;</span>
                                    <span>{wordCount.toLocaleString()} words</span>
                                </div>

                                {/* Excerpt / intro */}
                                {excerpt && (
                                    <p className="text-sm text-muted-foreground italic leading-relaxed mb-6 pl-4 border-l-2 border-primary/40">
                                        {excerpt}
                                    </p>
                                )}

                                {/* Key Takeaways box */}
                                {keyTakeaways.length > 0 && (
                                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 mb-8">
                                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
                                            <Check className="h-4 w-4 text-primary" />
                                            Key Takeaways
                                        </h3>
                                        <ul className="space-y-2">
                                            {keyTakeaways.map((t, i) => (
                                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                                    <span className="text-primary mt-0.5 text-xs">&#10003;</span>
                                                    {t}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Article body */}
                                <div className="prose prose-invert max-w-none
                                    prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight
                                    prose-h2:text-2xl prose-h2:mb-4 prose-h2:mt-10 prose-h2:border-b prose-h2:border-border/30 prose-h2:pb-3
                                    prose-h3:text-xl prose-h3:mb-3 prose-h3:mt-8
                                    prose-h4:text-lg prose-h4:mb-2 prose-h4:mt-6
                                    prose-p:text-base prose-p:leading-7 prose-p:text-muted-foreground prose-p:mb-5
                                    prose-strong:text-foreground prose-strong:font-semibold
                                    prose-ul:text-base prose-ul:text-muted-foreground prose-ul:my-4 prose-ul:leading-7
                                    prose-ol:text-base prose-ol:text-muted-foreground prose-ol:my-4 prose-ol:leading-7
                                    prose-li:my-1.5
                                    prose-table:text-sm prose-table:border prose-table:border-border/50 prose-table:my-6
                                    prose-th:bg-muted/30 prose-th:px-4 prose-th:py-2.5 prose-th:text-left prose-th:font-semibold prose-th:text-foreground prose-th:border prose-th:border-border/50
                                    prose-td:px-4 prose-td:py-2.5 prose-td:text-muted-foreground prose-td:border prose-td:border-border/50
                                    prose-a:text-primary prose-a:underline prose-a:underline-offset-2
                                    prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-blockquote:italic prose-blockquote:my-6
                                    prose-code:text-primary prose-code:bg-muted/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
                                    prose-pre:bg-muted/30 prose-pre:border prose-pre:border-border/50 prose-pre:my-6
                                    prose-img:rounded-lg prose-img:border prose-img:border-border/50 prose-img:my-6
                                    prose-hr:border-border/30 prose-hr:my-8
                                ">
                                    {content ? (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {content}
                                        </ReactMarkdown>
                                    ) : (
                                        <p className="text-muted-foreground/50 text-base italic">No content yet. Switch to editor to start writing.</p>
                                    )}
                                </div>

                                {/* FAQs section */}
                                {faqs.length > 0 && (
                                    <div className="mt-10 pt-8 border-t border-border/30">
                                        <h2 className="text-xl font-bold mb-5 text-foreground">Frequently Asked Questions</h2>
                                        <div className="space-y-4">
                                            {faqs.map((faq, i) => (
                                                <div key={i} className="rounded-lg border border-border/50 bg-muted/20 p-4">
                                                    <h3 className="text-sm font-semibold mb-2 text-foreground">{faq.question}</h3>
                                                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tags footer */}
                                {tags && tags.split(",").filter((t) => t.trim()).length > 0 && (
                                    <div className="mt-8 pt-6 border-t border-border/30">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Tags:</span>
                                            {tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag, i) => (
                                                <Badge key={i} variant="outline" className="text-[10px] h-5 px-2">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* SEO preview card */}
                                {(metaTitle || metaDescription) && (
                                    <div className="mt-8 pt-6 border-t border-border/30">
                                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-3">Google Search Preview</p>
                                        <div className="rounded-lg border border-border/50 bg-background/50 p-4 space-y-1">
                                            <p className="text-sm text-blue-400 font-medium truncate">
                                                {metaTitle || title || "Page Title"}
                                            </p>
                                            <p className="text-[11px] text-emerald-500 font-mono truncate">
                                                afcrashpad.com/blog/{slug || "article-slug"}
                                            </p>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {metaDescription || excerpt || "No meta description set."}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main editor - 2/3 width */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Title & slug */}
                    <Card className="border-border/50 bg-card/50">
                        <CardContent className="pt-6 space-y-4">
                            <div>
                                <Label className="text-xs font-semibold">Title (H1)</Label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter article title..."
                                    className="mt-1 text-lg font-semibold"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-semibold">URL Slug</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Input
                                            value={slug}
                                            onChange={(e) => {
                                                setSlug(e.target.value)
                                                setAutoSlug(false)
                                            }}
                                            placeholder="article-url-slug"
                                            className="font-mono text-xs"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold">Article Type</Label>
                                    <Select value={type} onValueChange={(v) => {
                                        setType(v as ArticleType)
                                        // Clear cluster link if switching away from cluster/pillar
                                        if (v === "standalone") setClusterId("")
                                    }}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="standalone">Standalone</SelectItem>
                                            <SelectItem value="pillar">Pillar (2000+ words)</SelectItem>
                                            <SelectItem value="cluster">Cluster (1200-1500 words)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {/* Cluster selector — shown for cluster and pillar types */}
                            {(type === "cluster" || type === "pillar") && clusters.length > 0 && (
                                <div>
                                    <Label className="text-xs font-semibold">
                                        {type === "pillar" ? "Pillar for Cluster" : "Belongs to Cluster"}
                                    </Label>
                                    <Select value={clusterId || "none"} onValueChange={(v) => setClusterId(v === "none" ? "" : v)}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Select a content cluster..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {clusters.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name}
                                                    {c.targetKeywords.length > 0 && (
                                                        <span className="text-muted-foreground ml-1">
                                                            — {c.targetKeywords.slice(0, 2).join(", ")}
                                                        </span>
                                                    )}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {clusterId && (
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {type === "cluster"
                                                ? "This article will be linked to the selected cluster and its pillar page."
                                                : "This article will serve as the pillar (cornerstone) page for this cluster."}
                                        </p>
                                    )}
                                </div>
                            )}
                            <div>
                                <Label className="text-xs font-semibold">Excerpt</Label>
                                <Textarea
                                    value={excerpt}
                                    onChange={(e) => setExcerpt(e.target.value)}
                                    placeholder="Brief article summary for previews..."
                                    className="mt-1 text-xs"
                                    rows={2}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Content editor */}
                    <Card className="border-border/50 bg-card/50">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold">Content</CardTitle>
                                <Badge variant="outline" className="text-[10px]">
                                    {wordCount.toLocaleString()} words
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder={`Write your article in Markdown...\n\n## Section Heading\n\nParagraph text here. Keep paragraphs to 3 sentences max.\n\n- Bullet point\n- Another point\n\n| Column 1 | Column 2 |\n| --- | --- |\n| Data | Data |`}
                                className="font-mono text-xs min-h-[500px] resize-y leading-relaxed"
                                rows={25}
                            />
                        </CardContent>
                    </Card>

                    {/* Key Takeaways */}
                    <KeyTakeawaysEditor takeaways={keyTakeaways} onChange={setKeyTakeaways} />

                    {/* FAQ Editor */}
                    <FAQEditor faqs={faqs} onChange={setFaqs} />

                    {/* Schema Generator */}
                    <SchemaGenerator
                        article={articleForSchema}
                        schema={schemaMarkup}
                        onChange={setSchemaMarkup}
                    />
                </div>

                {/* Sidebar - 1/3 width */}
                <div className="space-y-6">
                    {/* SEO Checklist */}
                    <SEOChecklist breakdown={seoBreakdown} />

                    {/* SEO Meta Fields */}
                    <Card className="border-border/50 bg-card/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">SEO Meta</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <Label className="text-xs font-semibold">Focus Keyword</Label>
                                <Input
                                    value={focusKeyword}
                                    onChange={(e) => setFocusKeyword(e.target.value)}
                                    placeholder="e.g., air force crashpad"
                                    className="mt-1 text-xs"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold">Secondary Keywords</Label>
                                <Input
                                    value={secondaryKeywords}
                                    onChange={(e) => setSecondaryKeywords(e.target.value)}
                                    placeholder="Comma-separated keywords..."
                                    className="mt-1 text-xs"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">Separate with commas</p>
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold">Meta Title</Label>
                                    <span className={`text-[10px] ${(metaTitle.length >= 50 && metaTitle.length <= 60) ? "text-emerald-500" : "text-muted-foreground"}`}>
                                        {metaTitle.length}/60
                                    </span>
                                </div>
                                <Input
                                    value={metaTitle}
                                    onChange={(e) => setMetaTitle(e.target.value)}
                                    placeholder="SEO title (50-60 chars)..."
                                    className="mt-1 text-xs"
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold">Meta Description</Label>
                                    <span className={`text-[10px] ${(metaDescription.length >= 120 && metaDescription.length <= 160) ? "text-emerald-500" : "text-muted-foreground"}`}>
                                        {metaDescription.length}/160
                                    </span>
                                </div>
                                <Textarea
                                    value={metaDescription}
                                    onChange={(e) => setMetaDescription(e.target.value)}
                                    placeholder="SEO description (120-160 chars)..."
                                    className="mt-1 text-xs"
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Categories & Tags */}
                    <Card className="border-border/50 bg-card/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">Taxonomy</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <Label className="text-xs font-semibold">Categories</Label>
                                <Input
                                    value={categories}
                                    onChange={(e) => setCategories(e.target.value)}
                                    placeholder="Comma-separated categories..."
                                    className="mt-1 text-xs"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold">Tags</Label>
                                <Input
                                    value={tags}
                                    onChange={(e) => setTags(e.target.value)}
                                    placeholder="Comma-separated tags..."
                                    className="mt-1 text-xs"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Featured Image */}
                    <Card className="border-border/50 bg-card/50 overflow-hidden">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold">Featured Image</CardTitle>
                                {featuredImageData && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => {
                                            setFeaturedImageData(null)
                                            setFeaturedImageAlt("")
                                            setFeaturedImageCaption("")
                                            setFeaturedImageTitle("")
                                        }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 px-0 pb-0">
                            {featuredImageData ? (
                                <>
                                    {/* Image preview — full bleed */}
                                    <div className="relative overflow-hidden">
                                        <Image
                                            src={`data:${featuredImageMime};base64,${featuredImageData}`}
                                            alt={featuredImageAlt || "Featured image preview"}
                                            width={600}
                                            height={338}
                                            className="w-full h-auto object-cover"
                                            sizes="300px"
                                            unoptimized
                                        />
                                    </div>

                                    {/* Image meta fields */}
                                    <div className="px-6 pb-6 space-y-3">
                                    <div>
                                        <Label className="text-xs font-semibold">
                                            Alt Text
                                            <span className="text-muted-foreground font-normal ml-1">(SEO)</span>
                                        </Label>
                                        <Input
                                            value={featuredImageAlt}
                                            onChange={(e) => setFeaturedImageAlt(e.target.value)}
                                            placeholder="Descriptive alt text for accessibility & SEO..."
                                            className="mt-1 text-xs"
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {featuredImageAlt.length}/125 chars
                                        </p>
                                    </div>

                                    {/* Title attribute */}
                                    <div>
                                        <Label className="text-xs font-semibold">
                                            Title Attribute
                                        </Label>
                                        <Input
                                            value={featuredImageTitle}
                                            onChange={(e) => setFeaturedImageTitle(e.target.value)}
                                            placeholder="Image title for hover tooltip..."
                                            className="mt-1 text-xs"
                                        />
                                    </div>

                                    {/* Caption */}
                                    <div>
                                        <Label className="text-xs font-semibold">Caption</Label>
                                        <Textarea
                                            value={featuredImageCaption}
                                            onChange={(e) => setFeaturedImageCaption(e.target.value)}
                                            placeholder="Optional image caption..."
                                            className="mt-1 text-xs"
                                            rows={2}
                                        />
                                    </div>

                                    {/* Regenerate */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-8 text-xs gap-1"
                                        onClick={handleGenerateImage}
                                        disabled={generatingImage}
                                    >
                                        {generatingImage ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <ImagePlus className="h-3 w-3" />
                                        )}
                                        {generatingImage ? "Regenerating..." : "Regenerate Image"}
                                    </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4 px-6">
                                    <ImagePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                    <p className="text-[10px] text-muted-foreground mb-3">
                                        Generate a featured image with Nano Banana 2 AI
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs gap-1"
                                        onClick={handleGenerateImage}
                                        disabled={generatingImage || !title.trim()}
                                    >
                                        {generatingImage ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <ImagePlus className="h-3 w-3" />
                                        )}
                                        {generatingImage ? "Generating..." : "Generate Image"}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* WordPress Publisher */}
                    {savedArticle?.id && (
                        <WordPressPublisher
                            article={savedArticle}
                            imageBase64={featuredImageData || undefined}
                        />
                    )}
                </div>
            </div>
            )}
        </div>
    )
}
