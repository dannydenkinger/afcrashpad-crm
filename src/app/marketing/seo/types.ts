// ─── SEO Dashboard Types ─────────────────────────────────────────────────────

// Google Search Console
export interface GSCQueryRow {
    query: string
    clicks: number
    impressions: number
    ctr: number       // 0–1 float
    position: number  // average position
}

export interface GSCDateRow {
    date: string       // "YYYY-MM-DD"
    clicks: number
    impressions: number
    ctr: number
    position: number
}

export interface GSCSiteMetrics {
    totalClicks: number
    totalImpressions: number
    avgCTR: number
    avgPosition: number
    dailyData: GSCDateRow[]
    topQueries: GSCQueryRow[]
}

// PageSpeed Insights
export interface PageSpeedMetrics {
    performanceScore: number     // 0–100
    seoScore: number             // 0–100
    accessibilityScore: number   // 0–100
    bestPracticesScore: number   // 0–100
    fcp: number    // First Contentful Paint (ms)
    lcp: number    // Largest Contentful Paint (ms)
    cls: number    // Cumulative Layout Shift
    tbt: number    // Total Blocking Time (ms)
    si: number     // Speed Index (ms)
    tti: number    // Time to Interactive (ms)
    fetchedAt: string // ISO timestamp
}

// Keyword Tracking (Firestore: seo_keywords)
export interface TrackedKeyword {
    id: string
    keyword: string
    domain: string          // domain to check (e.g. "yourdomain.com")
    position: number | null // current SERP position (null = not ranked)
    previousPosition: number | null
    searchVolume?: number
    lastChecked: string     // ISO timestamp
    history: KeywordHistoryEntry[]
    createdAt: string
}

export interface KeywordHistoryEntry {
    date: string     // ISO date
    position: number | null
}

// Competitor Tracking (Firestore: seo_competitors)
export interface TrackedCompetitor {
    id: string
    domain: string
    name: string
    pageSpeed: PageSpeedMetrics | null
    history: CompetitorHistoryEntry[]
    lastChecked: string
    createdAt: string
}

export interface CompetitorHistoryEntry {
    date: string
    performanceScore: number
    seoScore: number
    lcp: number
    cls: number
}

// Backlink Tracking — manual entry (Firestore: seo_backlink_entries)
export interface BacklinkEntry {
    id: string
    date: string           // ISO date
    totalBacklinks: number
    referringDomains: number
    domainRating: number | null   // manual entry
    notes: string
    createdAt: string
}

// SEO Snapshot — daily aggregated metrics (Firestore: seo_snapshots)
export interface SEOSnapshot {
    id: string
    date: string
    gscClicks: number
    gscImpressions: number
    gscAvgCTR: number
    gscAvgPosition: number
    pageSpeedPerformance: number | null
    pageSpeedSEO: number | null
    createdAt: string
}

// Serper API
export interface SerpResult {
    position: number
    title: string
    link: string
    snippet: string
    domain: string
}

export interface SerpResponse {
    keyword: string
    results: SerpResult[]
    foundPosition: number | null  // position of target domain, null if not found
    searchVolume?: number
}

// Server action return types
export interface ActionResult<T = void> {
    success: boolean
    data?: T
    error?: string
}
