// Blog CMS Type Definitions

export type ArticleStatus = "draft" | "review" | "published" | "archived";
export type ArticleType = "pillar" | "cluster" | "standalone";

export interface BlogArticle {
    id: string;
    title: string;
    slug: string;
    content: string; // Markdown content
    excerpt: string;
    status: ArticleStatus;
    type: ArticleType;
    clusterId?: string; // Links cluster posts to their pillar

    // SEO fields
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    secondaryKeywords: string[];

    // Structured content
    keyTakeaways: string[];
    faqs: FAQ[];

    // Schema & technical
    schemaMarkup: string; // JSON-LD string
    canonicalUrl?: string;

    // WordPress
    wpPostId?: number;
    wpPublishedUrl?: string;
    wpLastSynced?: string;

    // Scoring
    seoScore: number;
    seoChecks: SEOCheck[];

    // Meta
    author: string;
    authorId: string;
    featuredImage?: string; // URL of the featured image
    featuredImageData?: string; // base64 encoded image data (persisted for regeneration/WP upload)
    featuredImageMime?: string; // MIME type of the featured image
    featuredImageAlt?: string; // SEO alt text
    featuredImageCaption?: string; // Image caption
    featuredImageTitle?: string; // Title attribute for accessibility
    wpFeaturedMediaId?: number; // WordPress media attachment ID
    categories: string[];
    tags: string[];
    wordCount: number;
    readingTime: number; // minutes

    scheduledPublishDate?: string; // ISO date for scheduled publishing

    // Content freshness tracking
    lastContentReviewDate?: string; // ISO date of last review
    contentFreshnessMonths?: number; // How many months before content is "stale" (default 6)

    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
}

export interface FAQ {
    id: string;
    question: string;
    answer: string;
}

export interface SEOCheck {
    id: string;
    category: "content" | "technical" | "eeat" | "formatting";
    label: string;
    passed: boolean;
    weight: number;
    details?: string;
}

export interface ContentCluster {
    id: string;
    name: string;
    description: string;
    pillarArticleId?: string;
    clusterArticleIds: string[];
    targetKeywords: string[];
    status: "planning" | "in_progress" | "complete";
    createdAt: string;
    updatedAt: string;
}

export interface WordPressConfig {
    siteUrl: string;
    username: string;
    appPassword: string;
}

export interface WPPublishResult {
    success: boolean;
    postId?: number;
    postUrl?: string;
    error?: string;
}

export interface AIGenerateRequest {
    topic: string;
    type: ArticleType;
    focusKeyword: string;
    secondaryKeywords: string[];
    tone?: string;
    targetWordCount?: number;
    clusterContext?: string; // Context from the pillar article for cluster posts
    additionalInstructions?: string;
}

export interface AIGenerateResponse {
    success: boolean;
    content?: string;
    title?: string;
    metaTitle?: string;
    metaDescription?: string;
    excerpt?: string;
    focusKeyword?: string;
    secondaryKeywords?: string[];
    keyTakeaways?: string[];
    faqs?: FAQ[];
    schemaMarkup?: string;
    error?: string;
}

// SEO Score breakdown by category
export interface SEOScoreBreakdown {
    content: { score: number; max: number; checks: SEOCheck[] };
    technical: { score: number; max: number; checks: SEOCheck[] };
    eeat: { score: number; max: number; checks: SEOCheck[] };
    formatting: { score: number; max: number; checks: SEOCheck[] };
    total: number;
}

// Dashboard summary stats
export interface BlogStats {
    totalArticles: number;
    publishedArticles: number;
    draftArticles: number;
    avgSeoScore: number;
    totalWordCount: number;
    clustersCount: number;
}
