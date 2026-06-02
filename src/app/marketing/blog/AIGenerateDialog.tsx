"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Wand2, Loader2, Sparkles, Network, Crown, Lock } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { getClusterContext } from "./actions"
import type { ArticleType, ContentCluster, AIGenerateResponse } from "./types"
import { useWorkspacePlan } from "@/hooks/useWorkspacePlan"

interface AIGenerateDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onGenerated: (data: AIGenerateResponse & { clusterId?: string }) => void
    defaultType?: ArticleType
    clusters?: ContentCluster[]
    preselectedClusterId?: string
}

export default function AIGenerateDialog({
    open,
    onOpenChange,
    onGenerated,
    defaultType = "standalone",
    clusters = [],
    preselectedClusterId,
}: AIGenerateDialogProps) {
    const [topic, setTopic] = useState("")
    const [focusKeyword, setFocusKeyword] = useState("")
    const [secondaryKeywords, setSecondaryKeywords] = useState("")
    const [type, setType] = useState<ArticleType>(defaultType)
    const [tone, setTone] = useState("")
    const [targetWordCount, setTargetWordCount] = useState("")
    const [additionalInstructions, setAdditionalInstructions] = useState("")
    const [generating, setGenerating] = useState(false)
    const { hasFeature, loading: planLoading } = useWorkspacePlan()
    const blogAIUnlocked = hasFeature("aiBlogGeneration")

    // Cluster context
    const [selectedClusterId, setSelectedClusterId] = useState(preselectedClusterId || "")
    const [clusterContextData, setClusterContextData] = useState<{
        clusterName: string
        keywords: string[]
        pillarTitle: string
        pillarExcerpt: string
        pillarKeyword: string
        pillarHeadings: string[]
        existingTopics: string[]
    } | null>(null)
    const [loadingContext, setLoadingContext] = useState(false)

    // Update type and cluster when preselected props change
    useEffect(() => {
        if (open) {
            setType(defaultType)
            if (preselectedClusterId) {
                setSelectedClusterId(preselectedClusterId)
                if (defaultType === "standalone") setType("cluster")
            }
        }
    }, [open, defaultType, preselectedClusterId])

    // Load cluster context when a cluster is selected
    useEffect(() => {
        if (!selectedClusterId) {
            setClusterContextData(null)
            return
        }

        const loadContext = async () => {
            setLoadingContext(true)
            try {
                const result = await getClusterContext(selectedClusterId)
                if (result.success && result.data) {
                    setClusterContextData(result.data)
                    // Auto-fill keywords from cluster if not already set
                    if (!secondaryKeywords && result.data.keywords.length > 0) {
                        setSecondaryKeywords(result.data.keywords.join(", "))
                    }
                    // Auto-fill focus keyword from pillar if available and not set
                    if (!focusKeyword && result.data.pillarKeyword) {
                        // Don't auto-fill the same keyword — suggest a related one
                    }
                }
            } catch (error) {
                console.error("Failed to load cluster context:", error)
            }
            setLoadingContext(false)
        }

        loadContext()
    }, [selectedClusterId])

    // Build cluster context string for the AI prompt
    const buildClusterContextString = (): string => {
        if (!clusterContextData) return ""

        const parts: string[] = []
        parts.push(`Cluster topic: "${clusterContextData.clusterName}"`)

        if (clusterContextData.pillarTitle) {
            parts.push(`Pillar article: "${clusterContextData.pillarTitle}"`)
        }
        if (clusterContextData.pillarExcerpt) {
            parts.push(`Pillar summary: ${clusterContextData.pillarExcerpt}`)
        }
        if (clusterContextData.pillarKeyword) {
            parts.push(`Pillar focus keyword: "${clusterContextData.pillarKeyword}"`)
        }
        if (clusterContextData.pillarHeadings.length > 0) {
            parts.push(`Pillar article sections:\n${clusterContextData.pillarHeadings.map((h) => `  - ${h}`).join("\n")}`)
        }
        if (clusterContextData.existingTopics.length > 0) {
            parts.push(`Existing cluster articles (avoid duplicate content):\n${clusterContextData.existingTopics.map((t) => `  - ${t}`).join("\n")}`)
        }
        if (clusterContextData.keywords.length > 0) {
            parts.push(`Cluster target keywords: ${clusterContextData.keywords.join(", ")}`)
        }

        parts.push("\nIMPORTANT: This is a CLUSTER article that supports the pillar page. It should:")
        parts.push("- Focus on a specific subtopic of the pillar's broader subject")
        parts.push("- Link back to the pillar article naturally using [Pillar Title](/blog/pillar-slug)")
        parts.push("- Not duplicate content already covered in the pillar or other cluster articles")
        parts.push("- Target a more specific long-tail keyword related to the pillar's keyword")

        return parts.join("\n")
    }

    const handleGenerate = async () => {
        if (!topic.trim()) {
            toast.error("Please enter a topic")
            return
        }
        if (!focusKeyword.trim()) {
            toast.error("Please enter a focus keyword")
            return
        }

        setGenerating(true)
        try {
            const clusterContext = buildClusterContextString()

            const response = await fetch("/api/blog/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: topic.trim(),
                    type,
                    focusKeyword: focusKeyword.trim(),
                    secondaryKeywords: secondaryKeywords
                        .split(",")
                        .map((k) => k.trim())
                        .filter(Boolean),
                    tone: tone || undefined,
                    targetWordCount: targetWordCount ? parseInt(targetWordCount) : undefined,
                    clusterContext: clusterContext || undefined,
                    additionalInstructions: additionalInstructions || undefined,
                }),
            })

            const data: AIGenerateResponse = await response.json()

            if (data.success) {
                toast.success("Article generated successfully!")
                onGenerated({
                    ...data,
                    clusterId: selectedClusterId || undefined,
                })
                onOpenChange(false)
                // Reset form
                setTopic("")
                setFocusKeyword("")
                setSecondaryKeywords("")
                setAdditionalInstructions("")
                setSelectedClusterId("")
                setClusterContextData(null)
            } else {
                toast.error(data.error || "Generation failed")
            }
        } catch (error: any) {
            toast.error(error.message || "Generation failed")
        }
        setGenerating(false)
    }

    // Max-only feature — show upgrade promo for Free + Pro workspaces
    if (!planLoading && !blogAIUnlocked) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-indigo-500" />
                            AI blog generation is a Max feature
                        </DialogTitle>
                        <DialogDescription>
                            Generate a full 1,500+ word SEO-optimized article in 60 seconds —
                            with E-E-A-T signals, internal linking, and proper structure.
                            Available exclusively on the Max plan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border bg-gradient-to-br from-indigo-500/5 to-indigo-500/10 p-4 space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                            <span>Standalone articles, pillar pages, or topic clusters</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                            <span>Auto-imports cluster context for internal linking</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                            <span>2026 SEO best practices — BLUF, E-E-A-T, structured data</span>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Maybe later
                        </Button>
                        <Link href="/settings/billing" onClick={() => onOpenChange(false)}>
                            <Button>
                                <Crown className="h-3.5 w-3.5 mr-1.5" />
                                Upgrade to Max
                            </Button>
                        </Link>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Article Generator
                    </DialogTitle>
                    <DialogDescription>
                        Generate an SEO-optimized article using Claude AI. The content follows 2026 SEO best practices including BLUF method, E-E-A-T signals, and proper formatting.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div>
                        <Label className="text-xs font-semibold">Topic / Title Idea *</Label>
                        <Input
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder='e.g., "Complete Guide to Air Force PCS Moves"'
                            className="mt-1"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-xs font-semibold">Focus Keyword *</Label>
                            <Input
                                value={focusKeyword}
                                onChange={(e) => setFocusKeyword(e.target.value)}
                                placeholder="e.g., air force PCS"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-semibold">Article Type</Label>
                            <Select value={type} onValueChange={(v) => setType(v as ArticleType)}>
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

                    {/* Cluster selector — shown when type is cluster or pillar and clusters exist */}
                    {(type === "cluster" || type === "pillar") && clusters.length > 0 && (
                        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                            <div className="flex items-center gap-2">
                                <Network className="h-3.5 w-3.5 text-primary" />
                                <Label className="text-xs font-semibold">Link to Content Cluster</Label>
                            </div>
                            <Select value={selectedClusterId || "none"} onValueChange={(v) => setSelectedClusterId(v === "none" ? "" : v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a cluster..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {clusters.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Show cluster context info */}
                            {loadingContext && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Loading cluster context...
                                </p>
                            )}
                            {clusterContextData && !loadingContext && (
                                <div className="space-y-1.5">
                                    {clusterContextData.pillarTitle && (
                                        <div className="flex items-center gap-1.5">
                                            <Crown className="h-3 w-3 text-primary" />
                                            <span className="text-[10px] text-muted-foreground">
                                                Pillar: <strong className="text-foreground">{clusterContextData.pillarTitle}</strong>
                                            </span>
                                        </div>
                                    )}
                                    {!clusterContextData.pillarTitle && (
                                        <p className="text-[10px] text-amber-500">
                                            No pillar article set for this cluster. Consider creating the pillar first.
                                        </p>
                                    )}
                                    {clusterContextData.existingTopics.length > 0 && (
                                        <div>
                                            <p className="text-[10px] text-muted-foreground mb-1">Existing articles:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {clusterContextData.existingTopics.map((t, i) => (
                                                    <Badge key={i} variant="secondary" className="text-[8px] h-4 px-1.5">
                                                        {t.length > 40 ? t.slice(0, 37) + "..." : t}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-emerald-500">
                                        Cluster context will be included in the AI prompt for better relevance.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <Label className="text-xs font-semibold">Secondary Keywords</Label>
                        <Input
                            value={secondaryKeywords}
                            onChange={(e) => setSecondaryKeywords(e.target.value)}
                            placeholder="Comma-separated: keyword one, keyword two, keyword three"
                            className="mt-1"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-xs font-semibold">Tone</Label>
                            <Input
                                value={tone}
                                onChange={(e) => setTone(e.target.value)}
                                placeholder="Professional, friendly..."
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-semibold">Target Word Count</Label>
                            <Input
                                value={targetWordCount}
                                onChange={(e) => setTargetWordCount(e.target.value)}
                                placeholder="Auto-detected"
                                type="number"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div>
                        <Label className="text-xs font-semibold">Additional Instructions</Label>
                        <Textarea
                            value={additionalInstructions}
                            onChange={(e) => setAdditionalInstructions(e.target.value)}
                            placeholder="Any specific requirements, angles, or data to include..."
                            className="mt-1"
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
                        Cancel
                    </Button>
                    <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                        {generating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating (~30s)...
                            </>
                        ) : (
                            <>
                                <Wand2 className="h-4 w-4" />
                                Generate Article
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
