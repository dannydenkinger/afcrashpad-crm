"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Plus,
    FileText,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    Eye,
    Wand2,
    Network,
    BookOpen,
    TrendingUp,
    BarChart3,
    Filter,
    ArrowUpCircle,
    ArrowDownCircle,
    AlertCircle,
    X,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import ArticleEditor from "./ArticleEditor"
import ClusterManager from "./ClusterManager"
import AIGenerateDialog from "./AIGenerateDialog"
import { getArticles, getArticle, getClusters, deleteArticle, getBlogStats, ensureArticleInCluster, updateArticle, getBlogConnectionStatus } from "./actions"
import type { BlogArticle, ContentCluster, BlogStats, AIGenerateResponse } from "./types"

type ViewMode = "list" | "editor" | "clusters"

export default function BlogDashboard() {
    const [view, setView] = useState<ViewMode>("list")
    const [articles, setArticles] = useState<BlogArticle[]>([])
    const [clusters, setClusters] = useState<ContentCluster[]>([])
    const [stats, setStats] = useState<BlogStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [wpConnected, setWpConnected] = useState<boolean | null>(null)
    const [wpBannerDismissed, setWpBannerDismissed] = useState(false)

    useEffect(() => {
        if (typeof window !== "undefined") {
            setWpBannerDismissed(window.localStorage.getItem("blog:wp-banner-dismissed") === "1")
        }
    }, [])

    function dismissWpBanner() {
        setWpBannerDismissed(true)
        if (typeof window !== "undefined") {
            window.localStorage.setItem("blog:wp-banner-dismissed", "1")
        }
    }

    // Editor state
    const [editingArticle, setEditingArticle] = useState<BlogArticle | null>(null)
    const [editorKey, setEditorKey] = useState(0) // Force remount editor when article identity changes
    const [showAIDialog, setShowAIDialog] = useState(false)
    const [aiDialogClusterId, setAiDialogClusterId] = useState<string | undefined>(undefined)

    // ── Load data ──
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [articlesRes, clustersRes, statsRes, connStatus] = await Promise.all([
                getArticles(),
                getClusters(),
                getBlogStats(),
                getBlogConnectionStatus().catch(() => ({ wordpress: false })),
            ])

            if (articlesRes.success && articlesRes.data) setArticles(articlesRes.data)
            if (clustersRes.success && clustersRes.data) setClusters(clustersRes.data)
            if (statsRes.success && statsRes.data) setStats(statsRes.data)
            setWpConnected(!!connStatus.wordpress)
        } catch (error) {
            console.error("Failed to load blog data:", error)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    // ── Handlers ──
    const handleNewArticle = () => {
        setEditingArticle(null)
        setEditorKey((k) => k + 1)
        setView("editor")
    }

    const handleEditArticle = async (id: string) => {
        const result = await getArticle(id)
        if (result.success && result.data) {
            setEditingArticle(result.data)
            setEditorKey((k) => k + 1)
            setView("editor")
        } else {
            toast.error(result.error || "Failed to load article")
        }
    }

    const handleDeleteArticle = async (id: string) => {
        const result = await deleteArticle(id)
        if (result.success) {
            toast.success("Article deleted")
            loadData()
        } else {
            toast.error(result.error || "Failed to delete")
        }
    }

    const handleCycleStatus = async (article: BlogArticle) => {
        const cycle: Record<string, string> = { draft: "review", review: "published", published: "archived", archived: "draft" }
        const nextStatus = cycle[article.status] || "draft"
        // Optimistic update
        setArticles(prev => prev.map(a => a.id === article.id ? { ...a, status: nextStatus as any } : a))
        const res = await updateArticle(article.id, { status: nextStatus as any })
        if (res.success) {
            toast.success(`Status changed to ${nextStatus}`)
        } else {
            toast.error("Failed to update status")
            setArticles(prev => prev.map(a => a.id === article.id ? { ...a, status: article.status } : a))
        }
    }

    const handleArticleSaved = async (article: BlogArticle) => {
        setEditingArticle(article)

        // If the article has a clusterId, ensure it's in the cluster's article list
        // Uses lightweight function that only adds to array — does NOT change article type
        if (article.clusterId && article.id) {
            try {
                await ensureArticleInCluster(article.clusterId, article.id)
            } catch (error) {
                // Non-fatal — the article was saved, just cluster linking may have failed
                console.error("Failed to link article to cluster:", error)
            }
        }

        loadData()
    }

    const handleAIGenerated = (data: AIGenerateResponse & { clusterId?: string }) => {
        // Pre-fill editor with generated content
        const generatedClusterId = data.clusterId || aiDialogClusterId
        setEditingArticle({
            id: "",
            title: data.title || "",
            slug: "",
            content: data.content || "",
            excerpt: data.excerpt || "",
            status: "draft",
            type: generatedClusterId ? "cluster" : "standalone",
            clusterId: generatedClusterId,
            metaTitle: data.metaTitle || "",
            metaDescription: data.metaDescription || "",
            focusKeyword: data.focusKeyword || "",
            secondaryKeywords: data.secondaryKeywords || [],
            keyTakeaways: data.keyTakeaways || [],
            faqs: data.faqs || [],
            schemaMarkup: data.schemaMarkup || "",
            seoScore: 0,
            seoChecks: [],
            author: "",
            authorId: "",
            categories: [],
            tags: [],
            wordCount: 0,
            readingTime: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } as BlogArticle)
        setEditorKey((k) => k + 1) // Force editor remount so useState picks up new article
        setAiDialogClusterId(undefined)
        setView("editor")
    }

    // ── Cluster workflow handlers ──
    const handleNewClusterArticle = (clusterId: string) => {
        // Open a blank editor pre-linked to the cluster
        setEditingArticle({
            id: "",
            title: "",
            slug: "",
            content: "",
            excerpt: "",
            status: "draft",
            type: "cluster",
            clusterId: clusterId,
            metaTitle: "",
            metaDescription: "",
            focusKeyword: "",
            secondaryKeywords: [],
            keyTakeaways: [],
            faqs: [],
            schemaMarkup: "",
            seoScore: 0,
            seoChecks: [],
            author: "",
            authorId: "",
            categories: [],
            tags: [],
            wordCount: 0,
            readingTime: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } as BlogArticle)
        setEditorKey((k) => k + 1)
        setView("editor")
    }

    const handleGenerateClusterArticle = (clusterId: string) => {
        setAiDialogClusterId(clusterId)
        setShowAIDialog(true)
    }

    // ── Filter articles ──
    const filteredArticles = articles.filter((a) => {
        const matchesSearch =
            searchQuery === "" ||
            a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.focusKeyword?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === "all" || a.status === statusFilter
        return matchesSearch && matchesStatus
    })

    // ── Status badge colors ──
    const statusConfig: Record<string, { class: string; label: string }> = {
        draft: { class: "bg-muted text-muted-foreground", label: "Draft" },
        review: { class: "bg-amber-500/10 text-amber-500 border-amber-500/20", label: "Review" },
        published: { class: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", label: "Published" },
        archived: { class: "bg-rose-500/10 text-rose-500 border-rose-500/20", label: "Archived" },
    }

    // ── Score color ──
    const scoreColor = (score: number) =>
        score >= 80 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-rose-500"

    // ── Render editor view ──
    if (view === "editor") {
        return (
            <>
                <ArticleEditor
                    key={editorKey}
                    article={editingArticle}
                    clusters={clusters}
                    onBack={() => {
                        setView("list")
                        setEditingArticle(null)
                        loadData()
                    }}
                    onSaved={handleArticleSaved}
                    onOpenAIDialog={() => setShowAIDialog(true)}
                />
                <AIGenerateDialog
                    open={showAIDialog}
                    onOpenChange={(open) => {
                        setShowAIDialog(open)
                        if (!open) setAiDialogClusterId(undefined)
                    }}
                    onGenerated={handleAIGenerated}
                    clusters={clusters}
                    preselectedClusterId={aiDialogClusterId}
                />
            </>
        )
    }

    // ── Render clusters view ──
    if (view === "clusters") {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => setView("list")} className="h-8 text-xs">
                        &larr; Back to Articles
                    </Button>
                </div>
                <ClusterManager
                    clusters={clusters}
                    articles={articles}
                    onRefresh={loadData}
                    onEditArticle={handleEditArticle}
                    onNewClusterArticle={handleNewClusterArticle}
                    onGenerateClusterArticle={handleGenerateClusterArticle}
                />
            </div>
        )
    }

    // ── Render list view (default) ──
    return (
        <div className="space-y-6">
            {wpConnected === false && !wpBannerDismissed && (
                <Card className="border-amber-500/40 bg-amber-500/5">
                    <CardContent className="pt-4 pb-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm">
                            <div className="font-medium">Connect WordPress to publish posts</div>
                            <p className="text-muted-foreground mt-1 text-xs">
                                You can write and save articles without it, but publishing to a live site needs WordPress credentials.
                            </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <Link href="/settings/integrations">
                                <Button size="sm">Connect</Button>
                            </Link>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={dismissWpBanner}
                                aria-label="Dismiss"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Total Articles
                        </CardTitle>
                        <BookOpen className="h-4 w-4 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalArticles || 0}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                            {stats?.publishedArticles || 0} published
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Avg SEO Score
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${scoreColor(stats?.avgSeoScore || 0)}`}>
                            {stats?.avgSeoScore || 0}
                            <span className="text-sm text-muted-foreground font-normal"> / 100</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Across all articles</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Total Words
                        </CardTitle>
                        <FileText className="h-4 w-4 text-blue-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {(stats?.totalWordCount || 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Content volume</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Clusters
                        </CardTitle>
                        <Network className="h-4 w-4 text-purple-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.clustersCount || 0}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                            <button
                                onClick={() => setView("clusters")}
                                className="text-primary hover:underline"
                            >
                                Manage clusters &rarr;
                            </button>
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Content Performance Summary */}
            {articles.length > 0 && (
                <Card className="border-none shadow-sm bg-card/40 backdrop-blur-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Content Performance
                        </CardTitle>
                        <CardDescription className="text-xs">Article quality and publishing velocity</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-3">
                            {articles
                                .filter(a => a.status === "published")
                                .sort((a, b) => b.seoScore - a.seoScore)
                                .slice(0, 5)
                                .map((article) => (
                                    <div
                                        key={article.id}
                                        className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                                        onClick={() => handleEditArticle(article.id)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                                                article.seoScore >= 80 ? "bg-emerald-500/10 text-emerald-600" :
                                                article.seoScore >= 60 ? "bg-amber-500/10 text-amber-600" :
                                                "bg-rose-500/10 text-rose-600"
                                            }`}>
                                                {article.seoScore}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium truncate">{article.title}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-muted-foreground">{article.wordCount.toLocaleString()} words</span>
                                                    <span className="text-[10px] text-muted-foreground">{article.readingTime} min read</span>
                                                    {article.publishedAt && (
                                                        <span className="text-[10px] text-muted-foreground">
                                                            Published {new Date(article.publishedAt).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {article.focusKeyword && (
                                                <Badge variant="outline" className="text-[9px] h-4 px-1.5">{article.focusKeyword}</Badge>
                                            )}
                                            {article.wpPublishedUrl && (
                                                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600">WP</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            {articles.filter(a => a.status === "published").length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-4">No published articles yet</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Actions bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search articles..."
                            className="pl-9 h-9 text-xs"
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1 text-xs">
                                <Filter className="h-3 w-3" />
                                {statusFilter === "all" ? "All Status" : statusConfig[statusFilter]?.label}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter("review")}>Review</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter("published")}>Published</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter("archived")}>Archived</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => setView("clusters")}>
                        <Network className="h-3 w-3" />
                        Clusters
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => setShowAIDialog(true)}>
                        <Wand2 className="h-3 w-3" />
                        AI Generate
                    </Button>
                    <Button size="sm" className="h-9 text-xs gap-1" onClick={handleNewArticle}>
                        <Plus className="h-3 w-3" />
                        New Article
                    </Button>
                </div>
            </div>

            {/* Articles Table */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-md">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="flex flex-col items-center gap-2">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                <p className="text-xs text-muted-foreground">Loading articles...</p>
                            </div>
                        </div>
                    ) : filteredArticles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4">
                            <FileText className="h-12 w-12 text-muted-foreground/20 mb-3" />
                            <h3 className="text-sm font-semibold mb-1">
                                {articles.length === 0 ? "No articles yet" : "No matching articles"}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-4 text-center max-w-sm">
                                {articles.length === 0
                                    ? "Create your first blog article or use AI to generate one."
                                    : "Try adjusting your search or filter."}
                            </p>
                            {articles.length === 0 && (
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowAIDialog(true)}>
                                        <Wand2 className="h-3 w-3" />
                                        AI Generate
                                    </Button>
                                    <Button size="sm" className="text-xs gap-1" onClick={handleNewArticle}>
                                        <Plus className="h-3 w-3" />
                                        Write Article
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Mobile card view */}
                            <div className="sm:hidden space-y-3 p-4">
                                {filteredArticles.map((article) => (
                                    <div
                                        key={`mobile-${article.id}`}
                                        className="p-3 rounded-xl border border-border/50 bg-card space-y-2.5 cursor-pointer active:bg-muted/30 transition-colors touch-manipulation"
                                        onClick={() => handleEditArticle(article.id)}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-sm font-semibold leading-tight line-clamp-2">
                                                    {article.title}
                                                </h4>
                                                {article.focusKeyword && (
                                                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                                        {article.focusKeyword}
                                                    </p>
                                                )}
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 touch-manipulation">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditArticle(article.id) }}>
                                                        <Pencil className="h-3 w-3 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    {article.wpPublishedUrl && (
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(article.wpPublishedUrl, "_blank") }}>
                                                            <Eye className="h-3 w-3 mr-2" />
                                                            View on WordPress
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteArticle(article.id) }}
                                                    >
                                                        <Trash2 className="h-3 w-3 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className="text-[9px] h-5 px-1.5 capitalize">
                                                {article.type}
                                            </Badge>
                                            <button
                                                className="inline-flex items-center"
                                                onClick={(e) => { e.stopPropagation(); handleCycleStatus(article) }}
                                            >
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[9px] h-5 px-1.5 ${statusConfig[article.status]?.class || ""}`}
                                                >
                                                    {statusConfig[article.status]?.label || article.status} ›
                                                </Badge>
                                            </button>
                                            <span className={`text-xs font-bold ${scoreColor(article.seoScore)}`}>
                                                SEO: {article.seoScore}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                                            <span>{article.wordCount.toLocaleString()} words</span>
                                            <span>{new Date(article.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop table view */}
                            <div className="hidden sm:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-[10px] uppercase tracking-wider font-bold">Title</TableHead>
                                        <TableHead className="text-[10px] uppercase tracking-wider font-bold w-[80px]">Type</TableHead>
                                        <TableHead className="text-[10px] uppercase tracking-wider font-bold w-[80px]">Status</TableHead>
                                        <TableHead className="text-[10px] uppercase tracking-wider font-bold w-[60px] text-center">SEO</TableHead>
                                        <TableHead className="text-[10px] uppercase tracking-wider font-bold w-[80px] text-right">Words</TableHead>
                                        <TableHead className="text-[10px] uppercase tracking-wider font-bold w-[100px] text-right">Updated</TableHead>
                                        <TableHead className="w-[40px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredArticles.map((article) => (
                                        <TableRow
                                            key={article.id}
                                            className="cursor-pointer"
                                            onClick={() => handleEditArticle(article.id)}
                                        >
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-semibold truncate max-w-[300px]">
                                                        {article.title}
                                                    </span>
                                                    {article.focusKeyword && (
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {article.focusKeyword}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[8px] h-4 px-1.5 capitalize">
                                                    {article.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <button
                                                    className="inline-flex items-center gap-1 group/status cursor-pointer"
                                                    title="Click to cycle status"
                                                    onClick={(e) => { e.stopPropagation(); handleCycleStatus(article) }}
                                                >
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[8px] h-4 px-1.5 ${statusConfig[article.status]?.class || ""}`}
                                                    >
                                                        {statusConfig[article.status]?.label || article.status}
                                                    </Badge>
                                                    <ArrowUpCircle className="h-3 w-3 text-muted-foreground/0 group-hover/status:text-muted-foreground transition-opacity" />
                                                </button>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`text-xs font-bold ${scoreColor(article.seoScore)}`}>
                                                    {article.seoScore}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-xs text-muted-foreground">
                                                    {article.wordCount.toLocaleString()}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-[10px] text-muted-foreground">
                                                    {new Date(article.updatedAt).toLocaleDateString()}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditArticle(article.id) }}>
                                                            <Pencil className="h-3 w-3 mr-2" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        {article.wpPublishedUrl && (
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(article.wpPublishedUrl, "_blank") }}>
                                                                <Eye className="h-3 w-3 mr-2" />
                                                                View on WordPress
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteArticle(article.id) }}
                                                        >
                                                            <Trash2 className="h-3 w-3 mr-2" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* AI Generate Dialog */}
            <AIGenerateDialog
                open={showAIDialog}
                onOpenChange={(open) => {
                    setShowAIDialog(open)
                    if (!open) setAiDialogClusterId(undefined)
                }}
                onGenerated={handleAIGenerated}
                clusters={clusters}
                preselectedClusterId={aiDialogClusterId}
            />
        </div>
    )
}
