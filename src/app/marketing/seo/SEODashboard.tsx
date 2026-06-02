"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Globe,
    Target,
    Users,
    Link2,
    Calendar,
    ChevronDown,
    RefreshCw,
    Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

const SiteOverview = dynamic(() => import("./SiteOverview"), {
    loading: () => <Skeleton className="h-[400px] w-full rounded-xl" />,
    ssr: false,
})
const KeywordTracker = dynamic(() => import("./KeywordTracker"), {
    loading: () => <Skeleton className="h-[400px] w-full rounded-xl" />,
    ssr: false,
})
const CompetitorTracker = dynamic(() => import("./CompetitorTracker"), {
    loading: () => <Skeleton className="h-[400px] w-full rounded-xl" />,
    ssr: false,
})
const BacklinkTracker = dynamic(() => import("./BacklinkTracker"), {
    loading: () => <Skeleton className="h-[400px] w-full rounded-xl" />,
    ssr: false,
})

import {
    fetchGSCData,
    getTrackedKeywords,
    getTrackedCompetitors,
    getBacklinkEntries,
    getSeoConnectionStatus,
} from "./actions"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, X } from "lucide-react"
import Link from "next/link"

import type {
    GSCSiteMetrics,
    PageSpeedMetrics,
    TrackedKeyword,
    TrackedCompetitor,
    BacklinkEntry,
} from "./types"

/**
 * The dashboard derives its display domain + PageSpeed URL from the
 * workspace's branding `websiteUrl` (Settings → Branding). We deliberately
 * do NOT fall back to env vars — that would hardcode the operator's site
 * for every workspace. When the workspace hasn't set a websiteUrl yet,
 * we surface a "Set your website in Branding" message instead.
 */
function deriveDomainAndUrl(websiteUrl?: string): { domain: string; siteUrl: string } {
    const trimmed = (websiteUrl || "").trim().replace(/\/+$/, "")
    if (!trimmed) return { domain: "", siteUrl: "" }
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    let host = withProto
    try { host = new URL(withProto).hostname } catch {}
    return { domain: host, siteUrl: withProto }
}

export default function SEODashboard() {
    const [activeTab, setActiveTab] = useState("overview")
    const [timeframe, setTimeframe] = useState("Last 28 Days")
    const [siteDomain, setSiteDomain] = useState<string>("")
    const [siteUrl, setSiteUrl] = useState<string>("")

    // Data states
    const [gscData, setGscData] = useState<GSCSiteMetrics | null>(null)
    const [pageSpeed, setPageSpeed] = useState<PageSpeedMetrics | null>(null)
    const [keywords, setKeywords] = useState<TrackedKeyword[]>([])
    const [competitors, setCompetitors] = useState<TrackedCompetitor[]>([])
    const [backlinkEntries, setBacklinkEntries] = useState<BacklinkEntry[]>([])

    // Loading states
    const [isLoadingGSC, setIsLoadingGSC] = useState(false)
    const [isLoadingPageSpeed, setIsLoadingPageSpeed] = useState(false)
    const [isLoadingInitial, setIsLoadingInitial] = useState(true)
    const [gscConnected, setGscConnected] = useState<boolean | null>(null)
    const [gscBannerDismissed, setGscBannerDismissed] = useState(false)

    useEffect(() => {
        if (typeof window !== "undefined") {
            setGscBannerDismissed(window.localStorage.getItem("seo:gsc-banner-dismissed") === "1")
        }
        // Pull the workspace's website URL once so the domain badge + the
        // PageSpeed audit target are workspace-scoped, not operator-scoped.
        let cancelled = false
        import("@/app/settings/branding/actions").then(({ getBrandingSettings }) =>
            getBrandingSettings().then((b) => {
                if (cancelled) return
                const { domain, siteUrl: url } = deriveDomainAndUrl(b?.websiteUrl)
                setSiteDomain(domain)
                setSiteUrl(url)
            }).catch(() => {})
        )
        return () => { cancelled = true }
    }, [])

    function dismissGscBanner() {
        setGscBannerDismissed(true)
        if (typeof window !== "undefined") {
            window.localStorage.setItem("seo:gsc-banner-dismissed", "1")
        }
    }

    // Load initial data
    useEffect(() => {
        let cancelled = false

        async function loadAll() {
            setIsLoadingInitial(true)
            setIsLoadingGSC(true)

            const days = timeframe === "Last 7 Days" ? 7 : timeframe === "Last 90 Days" ? 90 : 28

            try {
                // Load everything in parallel
                const [statusResult, gscResult, kwResult, compResult, blResult] = await Promise.all([
                    getSeoConnectionStatus().catch(() => ({ gsc: false })),
                    fetchGSCData(days).catch(() => ({ success: false as const })),
                    getTrackedKeywords().catch(() => ({ success: false as const })),
                    getTrackedCompetitors().catch(() => ({ success: false as const })),
                    getBacklinkEntries().catch(() => ({ success: false as const })),
                ])

                if (cancelled) return

                setGscConnected(!!statusResult.gsc)

                if (gscResult.success && "data" in gscResult && gscResult.data) {
                    setGscData(gscResult.data)
                }
                if (kwResult.success && "data" in kwResult && kwResult.data) {
                    setKeywords(kwResult.data)
                }
                if (compResult.success && "data" in compResult && compResult.data) {
                    setCompetitors(compResult.data)
                }
                if (blResult.success && "data" in blResult && blResult.data) {
                    setBacklinkEntries(blResult.data)
                }
            } catch (error) {
                console.error("SEO Dashboard load error:", error)
            } finally {
                if (!cancelled) {
                    setIsLoadingGSC(false)
                    setIsLoadingInitial(false)
                }
            }
        }

        loadAll()
        return () => { cancelled = true }
    }, [timeframe])

    async function handleRefreshPageSpeed() {
        if (!siteUrl) {
            toast.error("Set your website URL in Settings → Branding before running PageSpeed")
            return
        }
        setIsLoadingPageSpeed(true)
        try {
            const res = await fetch("/api/seo/pagespeed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: siteUrl, strategy: "mobile" }),
            })

            if (!res.ok) throw new Error("PageSpeed failed")

            const data: PageSpeedMetrics = await res.json()
            setPageSpeed(data)
            toast.success("PageSpeed audit complete")
        } catch {
            toast.error("Failed to run PageSpeed audit")
        } finally {
            setIsLoadingPageSpeed(false)
        }
    }

    return (
        <div className="relative">
            {isLoadingInitial && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-xs font-semibold text-muted-foreground">Loading SEO data...</p>
                    </div>
                </div>
            )}

            {/* Top Bar */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 gap-2">
                            <Calendar className="h-4 w-4" />
                            {timeframe}
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setTimeframe("Last 7 Days")}>Last 7 Days</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTimeframe("Last 28 Days")}>Last 28 Days</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTimeframe("Last 90 Days")}>Last 90 Days</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Badge variant="outline" className="text-[10px] h-7 px-2">
                    {siteDomain || "set website in branding"}
                </Badge>
            </div>

            {gscConnected === false && !gscBannerDismissed && (
                <Card className="border-amber-500/40 bg-amber-500/5 mb-6">
                    <CardContent className="pt-4 pb-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm">
                            <div className="font-medium">Connect Google Search Console for traffic & ranking data</div>
                            <p className="text-muted-foreground mt-1 text-xs">
                                Site Overview shows clicks, impressions, and top queries from GSC. Keywords, competitors, and backlinks work without it.
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
                                onClick={dismissGscBanner}
                                aria-label="Dismiss"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Section Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-muted/50 p-1 flex flex-wrap h-auto gap-1">
                    <TabsTrigger value="overview" className="flex items-center gap-2 px-4">
                        <Globe className="w-3.5 h-3.5" />
                        Site Overview
                    </TabsTrigger>
                    <TabsTrigger value="keywords" className="flex items-center gap-2 px-4">
                        <Target className="w-3.5 h-3.5" />
                        Keywords
                        {keywords.length > 0 && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-1">{keywords.length}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="competitors" className="flex items-center gap-2 px-4">
                        <Users className="w-3.5 h-3.5" />
                        Competitors
                        {competitors.length > 0 && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-1">{competitors.length}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="backlinks" className="flex items-center gap-2 px-4">
                        <Link2 className="w-3.5 h-3.5" />
                        Backlinks
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-0">
                    <SiteOverview
                        gscData={gscData}
                        pageSpeed={pageSpeed}
                        isLoadingGSC={isLoadingGSC}
                        isLoadingPageSpeed={isLoadingPageSpeed}
                        onRefreshPageSpeed={handleRefreshPageSpeed}
                    />
                </TabsContent>

                <TabsContent value="keywords" className="mt-0">
                    <KeywordTracker
                        keywords={keywords}
                        onKeywordsChange={setKeywords}
                        defaultDomain={siteDomain}
                    />
                </TabsContent>

                <TabsContent value="competitors" className="mt-0">
                    <CompetitorTracker
                        competitors={competitors}
                        onCompetitorsChange={setCompetitors}
                        ownPageSpeed={pageSpeed}
                    />
                </TabsContent>

                <TabsContent value="backlinks" className="mt-0">
                    <BacklinkTracker
                        entries={backlinkEntries}
                        onEntriesChange={setBacklinkEntries}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
