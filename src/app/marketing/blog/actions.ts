"use server"

import { adminDb } from "@/lib/firebase-admin"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { FieldValue } from "firebase-admin/firestore"
import type {
    BlogArticle,
    ContentCluster,
    ArticleStatus,
    ArticleType,
    FAQ,
    SEOCheck,
    SEOScoreBreakdown,
    BlogStats,
    WPPublishResult,
} from "./types"

// ─── Helpers ────────────────────────────────────────────────────────────────

function tsToISO(v: unknown): string | null {
    if (!v) return null
    if (typeof v === "string") return v
    if ((v as any)?.toDate) return (v as any).toDate().toISOString()
    return null
}

function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
}

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

// Strip undefined values from an object (Firestore rejects undefined)
function stripUndefined<T extends Record<string, any>>(obj: T): T {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as T
}

function estimateReadingTime(wordCount: number): number {
    return Math.max(1, Math.ceil(wordCount / 250))
}

// ─── SEO Scoring Engine ─────────────────────────────────────────────────────

export async function calculateSEOScore(article: Partial<BlogArticle>): Promise<SEOScoreBreakdown> {
    const checks: SEOCheck[] = []
    const content = article.content || ""
    const title = article.title || ""
    const focusKw = (article.focusKeyword || "").toLowerCase()
    const wordCount = countWords(content)

    // ── Content checks (40 pts max) ──
    checks.push({
        id: "title-keyword",
        category: "content",
        label: "Focus keyword in title",
        passed: title.toLowerCase().includes(focusKw) && focusKw.length > 0,
        weight: 8,
        details: focusKw ? `Looking for "${focusKw}" in title` : "No focus keyword set",
    })

    checks.push({
        id: "meta-desc",
        category: "content",
        label: "Meta description 120-160 chars",
        passed: (article.metaDescription?.length || 0) >= 120 && (article.metaDescription?.length || 0) <= 160,
        weight: 6,
        details: `Current: ${article.metaDescription?.length || 0} chars`,
    })

    checks.push({
        id: "meta-keyword",
        category: "content",
        label: "Focus keyword in meta description",
        passed: (article.metaDescription || "").toLowerCase().includes(focusKw) && focusKw.length > 0,
        weight: 4,
    })

    const h2Count = (content.match(/^## /gm) || []).length
    checks.push({
        id: "subheadings",
        category: "content",
        label: "Has 3+ descriptive subheadings (H2)",
        passed: h2Count >= 3,
        weight: 6,
        details: `Found ${h2Count} H2 headings`,
    })

    checks.push({
        id: "bluf-intro",
        category: "content",
        label: "BLUF intro (first paragraph answers query)",
        passed: content.length > 100 && !content.startsWith("# "),
        weight: 6,
    })

    const minWords = article.type === "pillar" ? 2000 : 1200
    checks.push({
        id: "word-count",
        category: "content",
        label: `Word count meets minimum (${minWords}+)`,
        passed: wordCount >= minWords,
        weight: 6,
        details: `Current: ${wordCount} words`,
    })

    checks.push({
        id: "keyword-density",
        category: "content",
        label: "Focus keyword density 0.5-2.5%",
        passed: (() => {
            if (!focusKw || wordCount === 0) return false
            const regex = new RegExp(focusKw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
            const occurrences = (content.match(regex) || []).length
            const density = (occurrences / wordCount) * 100
            return density >= 0.5 && density <= 2.5
        })(),
        weight: 4,
    })

    // ── Technical checks (25 pts max) ──
    checks.push({
        id: "meta-title-length",
        category: "technical",
        label: "Meta title 50-60 chars",
        passed: (article.metaTitle?.length || 0) >= 50 && (article.metaTitle?.length || 0) <= 60,
        weight: 5,
        details: `Current: ${article.metaTitle?.length || 0} chars`,
    })

    checks.push({
        id: "slug-clean",
        category: "technical",
        label: "Clean URL slug",
        passed: /^[a-z0-9-]+$/.test(article.slug || ""),
        weight: 4,
    })

    checks.push({
        id: "schema-markup",
        category: "technical",
        label: "JSON-LD schema markup present",
        passed: (article.schemaMarkup?.length || 0) > 10,
        weight: 8,
    })

    checks.push({
        id: "internal-links",
        category: "technical",
        label: "Has internal links",
        passed: /\[.*?\]\(\/.*?\)/.test(content) || content.includes("afcrashpad.com"),
        weight: 4,
    })

    checks.push({
        id: "external-links",
        category: "technical",
        label: "Has external citation links",
        passed: /\[.*?\]\(https?:\/\/(?!.*afcrashpad).*?\)/.test(content),
        weight: 4,
    })

    // ── E-E-A-T checks (20 pts max) ──
    checks.push({
        id: "key-takeaways",
        category: "eeat",
        label: "Key takeaways box present",
        passed: (article.keyTakeaways?.length || 0) >= 3,
        weight: 5,
        details: `${article.keyTakeaways?.length || 0} takeaways`,
    })

    checks.push({
        id: "faq-section",
        category: "eeat",
        label: "FAQ section with 3+ questions",
        passed: (article.faqs?.length || 0) >= 3,
        weight: 5,
        details: `${article.faqs?.length || 0} FAQs`,
    })

    checks.push({
        id: "data-evidence",
        category: "eeat",
        label: "Contains data/statistics/evidence",
        passed: /\d+%|\d+\.\d+|\$\d|data shows|according to|study|research/i.test(content),
        weight: 5,
    })

    checks.push({
        id: "author-set",
        category: "eeat",
        label: "Author attribution set",
        passed: (article.author?.length || 0) > 0,
        weight: 5,
    })

    // ── Formatting checks (15 pts max) ──
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim() && !p.startsWith("#") && !p.startsWith("-") && !p.startsWith("|"))
    const longParagraphs = paragraphs.filter((p) => p.split(/[.!?]+/).filter(Boolean).length > 3)

    checks.push({
        id: "short-paragraphs",
        category: "formatting",
        label: "Max 3 sentences per paragraph",
        passed: longParagraphs.length === 0,
        weight: 4,
        details: longParagraphs.length > 0 ? `${longParagraphs.length} paragraphs are too long` : "All paragraphs are concise",
    })

    checks.push({
        id: "bullet-lists",
        category: "formatting",
        label: "Uses bullet/numbered lists",
        passed: /^[-*\d]\s/m.test(content),
        weight: 4,
    })

    checks.push({
        id: "table-present",
        category: "formatting",
        label: "Contains data table(s)",
        passed: content.includes("| ") && content.includes(" |"),
        weight: 4,
    })

    checks.push({
        id: "no-fluff-intro",
        category: "formatting",
        label: 'No fluff intro ("In today\'s world...")',
        passed: !/^(in today|in this article|have you ever|let me tell)/im.test(content),
        weight: 3,
    })

    // Calculate scores by category
    const categories = ["content", "technical", "eeat", "formatting"] as const
    const breakdown: SEOScoreBreakdown = {
        content: { score: 0, max: 0, checks: [] },
        technical: { score: 0, max: 0, checks: [] },
        eeat: { score: 0, max: 0, checks: [] },
        formatting: { score: 0, max: 0, checks: [] },
        total: 0,
    }

    for (const cat of categories) {
        const catChecks = checks.filter((c) => c.category === cat)
        breakdown[cat].checks = catChecks
        breakdown[cat].max = catChecks.reduce((sum, c) => sum + c.weight, 0)
        breakdown[cat].score = catChecks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0)
    }

    breakdown.total = categories.reduce((sum, cat) => sum + breakdown[cat].score, 0)

    return breakdown
}

// ─── Article CRUD ───────────────────────────────────────────────────────────

export async function getArticles(): Promise<{ success: boolean; data?: BlogArticle[]; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const snapshot = await adminDb
            .collection("blog_articles")
            .orderBy("updatedAt", "desc")
            .get()

        const articles: BlogArticle[] = snapshot.docs.map((doc) => {
            const d = doc.data()
            return {
                id: doc.id,
                ...d,
                createdAt: tsToISO(d.createdAt) || new Date().toISOString(),
                updatedAt: tsToISO(d.updatedAt) || new Date().toISOString(),
                publishedAt: tsToISO(d.publishedAt),
            } as BlogArticle
        })

        return { success: true, data: articles }
    } catch (error: any) {
        console.error("getArticles error:", error)
        return { success: false, error: error.message }
    }
}

export async function getArticle(id: string): Promise<{ success: boolean; data?: BlogArticle; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const doc = await adminDb.collection("blog_articles").doc(id).get()
        if (!doc.exists) return { success: false, error: "Article not found" }

        const d = doc.data()!
        return {
            success: true,
            data: {
                id: doc.id,
                ...d,
                createdAt: tsToISO(d.createdAt) || new Date().toISOString(),
                updatedAt: tsToISO(d.updatedAt) || new Date().toISOString(),
                publishedAt: tsToISO(d.publishedAt),
            } as BlogArticle,
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createArticle(
    data: Partial<BlogArticle>
): Promise<{ success: boolean; data?: BlogArticle; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const now = new Date().toISOString()
        const wordCount = countWords(data.content || "")
        const slug = data.slug || generateSlug(data.title || "untitled")

        const article: Omit<BlogArticle, "id"> = {
            title: data.title || "Untitled Article",
            slug,
            content: data.content || "",
            excerpt: data.excerpt || "",
            status: data.status || "draft",
            type: data.type || "standalone",
            clusterId: data.clusterId,
            metaTitle: data.metaTitle || "",
            metaDescription: data.metaDescription || "",
            focusKeyword: data.focusKeyword || "",
            secondaryKeywords: data.secondaryKeywords || [],
            keyTakeaways: data.keyTakeaways || [],
            faqs: data.faqs || [],
            schemaMarkup: data.schemaMarkup || "",
            canonicalUrl: data.canonicalUrl,
            seoScore: 0,
            seoChecks: [],
            author: (session.user as any).name || "",
            authorId: (session.user as any).id || "",
            featuredImage: data.featuredImage,
            categories: data.categories || [],
            tags: data.tags || [],
            wordCount,
            readingTime: estimateReadingTime(wordCount),
            createdAt: now,
            updatedAt: now,
        }

        // Calculate SEO score
        const scoreBreakdown = await calculateSEOScore(article as BlogArticle)
        article.seoScore = scoreBreakdown.total
        article.seoChecks = [
            ...scoreBreakdown.content.checks,
            ...scoreBreakdown.technical.checks,
            ...scoreBreakdown.eeat.checks,
            ...scoreBreakdown.formatting.checks,
        ]

        const cleanArticle = stripUndefined(article)
        const docRef = await adminDb.collection("blog_articles").add(cleanArticle)

        revalidatePath("/marketing")
        return {
            success: true,
            data: { id: docRef.id, ...cleanArticle } as BlogArticle,
        }
    } catch (error: any) {
        console.error("createArticle error:", error)
        return { success: false, error: error.message }
    }
}

export async function updateArticle(
    id: string,
    data: Partial<BlogArticle>
): Promise<{ success: boolean; data?: BlogArticle; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const now = new Date().toISOString()
        const wordCount = data.content ? countWords(data.content) : undefined

        const updateData: Record<string, any> = {
            ...data,
            updatedAt: now,
        }

        if (wordCount !== undefined) {
            updateData.wordCount = wordCount
            updateData.readingTime = estimateReadingTime(wordCount)
        }

        // Remove id from update data
        delete updateData.id

        // Recalculate SEO score if content-related fields changed
        if (data.content || data.title || data.metaTitle || data.metaDescription || data.focusKeyword || data.keyTakeaways || data.faqs || data.schemaMarkup) {
            const doc = await adminDb.collection("blog_articles").doc(id).get()
            const existing = doc.data() || {}
            const merged = { ...existing, ...updateData }
            const scoreBreakdown = await calculateSEOScore(merged as BlogArticle)
            updateData.seoScore = scoreBreakdown.total
            updateData.seoChecks = [
                ...scoreBreakdown.content.checks,
                ...scoreBreakdown.technical.checks,
                ...scoreBreakdown.eeat.checks,
                ...scoreBreakdown.formatting.checks,
            ]
        }

        const cleanUpdateData = stripUndefined(updateData)
        await adminDb.collection("blog_articles").doc(id).update(cleanUpdateData)

        // Get the updated article
        const updatedDoc = await adminDb.collection("blog_articles").doc(id).get()
        const d = updatedDoc.data()!

        revalidatePath("/marketing")
        return {
            success: true,
            data: {
                id: updatedDoc.id,
                ...d,
                createdAt: tsToISO(d.createdAt) || now,
                updatedAt: tsToISO(d.updatedAt) || now,
                publishedAt: tsToISO(d.publishedAt),
            } as BlogArticle,
        }
    } catch (error: any) {
        console.error("updateArticle error:", error)
        return { success: false, error: error.message }
    }
}

export async function deleteArticle(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        // Clean up cluster references before deleting
        const articleDoc = await adminDb.collection("blog_articles").doc(id).get()
        const articleData = articleDoc.data()

        if (articleData?.clusterId) {
            const clusterRef = adminDb.collection("blog_clusters").doc(articleData.clusterId)
            const clusterDoc = await clusterRef.get()
            if (clusterDoc.exists) {
                const updateData: Record<string, any> = {
                    clusterArticleIds: FieldValue.arrayRemove(id),
                    updatedAt: new Date().toISOString(),
                }
                // If this was the pillar article, remove that reference too
                if (clusterDoc.data()?.pillarArticleId === id) {
                    updateData.pillarArticleId = FieldValue.delete()
                }
                await clusterRef.update(updateData)
            }
        }

        await adminDb.collection("blog_articles").doc(id).delete()
        revalidatePath("/marketing")
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

// ─── Cluster CRUD ───────────────────────────────────────────────────────────

export async function getClusters(): Promise<{ success: boolean; data?: ContentCluster[]; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const snapshot = await adminDb
            .collection("blog_clusters")
            .orderBy("updatedAt", "desc")
            .get()

        const clusters: ContentCluster[] = snapshot.docs.map((doc) => {
            const d = doc.data()
            return {
                id: doc.id,
                ...d,
                createdAt: tsToISO(d.createdAt) || new Date().toISOString(),
                updatedAt: tsToISO(d.updatedAt) || new Date().toISOString(),
            } as ContentCluster
        })

        return { success: true, data: clusters }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createCluster(
    data: Partial<ContentCluster>
): Promise<{ success: boolean; data?: ContentCluster; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const now = new Date().toISOString()
        const cluster: Omit<ContentCluster, "id"> = {
            name: data.name || "New Cluster",
            description: data.description || "",
            pillarArticleId: data.pillarArticleId,
            clusterArticleIds: data.clusterArticleIds || [],
            targetKeywords: data.targetKeywords || [],
            status: data.status || "planning",
            createdAt: now,
            updatedAt: now,
        }

        const cleanCluster = stripUndefined(cluster)
        const docRef = await adminDb.collection("blog_clusters").add(cleanCluster)
        revalidatePath("/marketing")
        return { success: true, data: { id: docRef.id, ...cleanCluster } as ContentCluster }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateCluster(
    id: string,
    data: Partial<ContentCluster>
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const updateData: Record<string, any> = { ...data, updatedAt: new Date().toISOString() }
        delete updateData.id

        await adminDb.collection("blog_clusters").doc(id).update(updateData)
        revalidatePath("/marketing")
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteCluster(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        // Remove clusterId from any articles linked to this cluster
        const articlesSnap = await adminDb
            .collection("blog_articles")
            .where("clusterId", "==", id)
            .get()
        const batch = adminDb.batch()
        articlesSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { clusterId: FieldValue.delete(), updatedAt: new Date().toISOString() })
        })
        batch.delete(adminDb.collection("blog_clusters").doc(id))
        await batch.commit()

        revalidatePath("/marketing")
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

// ─── Cluster Workflow Actions ────────────────────────────────────────────────

/** Set an existing article as the pillar article for a cluster */
export async function setPillarArticle(
    clusterId: string,
    articleId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const now = new Date().toISOString()

        // Update the cluster with the pillar article ID
        await adminDb.collection("blog_clusters").doc(clusterId).update({
            pillarArticleId: articleId,
            updatedAt: now,
        })

        // Update the article to mark it as pillar type and link to cluster
        await adminDb.collection("blog_articles").doc(articleId).update({
            type: "pillar",
            clusterId: clusterId,
            updatedAt: now,
        })

        revalidatePath("/marketing")
        return { success: true }
    } catch (error: any) {
        console.error("setPillarArticle error:", error)
        return { success: false, error: error.message }
    }
}

/** Add an existing article to a cluster as a cluster post */
export async function addArticleToCluster(
    clusterId: string,
    articleId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const now = new Date().toISOString()

        // Add article ID to the cluster's article list
        await adminDb.collection("blog_clusters").doc(clusterId).update({
            clusterArticleIds: FieldValue.arrayUnion(articleId),
            updatedAt: now,
        })

        // Only change article type if it's currently standalone.
        // Preserve "pillar" type — don't overwrite it to "cluster".
        const articleDoc = await adminDb.collection("blog_articles").doc(articleId).get()
        const currentType = articleDoc.data()?.type
        const articleUpdate: Record<string, any> = {
            clusterId: clusterId,
            updatedAt: now,
        }
        if (!currentType || currentType === "standalone") {
            articleUpdate.type = "cluster"
        }

        await adminDb.collection("blog_articles").doc(articleId).update(articleUpdate)

        revalidatePath("/marketing")
        return { success: true }
    } catch (error: any) {
        console.error("addArticleToCluster error:", error)
        return { success: false, error: error.message }
    }
}

/** Lightweight: just ensure article ID is in cluster's list, without changing article type */
export async function ensureArticleInCluster(
    clusterId: string,
    articleId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        await adminDb.collection("blog_clusters").doc(clusterId).update({
            clusterArticleIds: FieldValue.arrayUnion(articleId),
            updatedAt: new Date().toISOString(),
        })

        return { success: true }
    } catch (error: any) {
        console.error("ensureArticleInCluster error:", error)
        return { success: false, error: error.message }
    }
}

/** Remove an article from a cluster */
export async function removeArticleFromCluster(
    clusterId: string,
    articleId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const now = new Date().toISOString()

        // Check if this article is the pillar
        const clusterDoc = await adminDb.collection("blog_clusters").doc(clusterId).get()
        const clusterData = clusterDoc.data()
        const updateData: Record<string, any> = {
            clusterArticleIds: FieldValue.arrayRemove(articleId),
            updatedAt: now,
        }
        if (clusterData?.pillarArticleId === articleId) {
            updateData.pillarArticleId = FieldValue.delete()
        }

        await adminDb.collection("blog_clusters").doc(clusterId).update(updateData)

        // Unlink the article from the cluster
        await adminDb.collection("blog_articles").doc(articleId).update({
            type: "standalone",
            clusterId: FieldValue.delete(),
            updatedAt: now,
        })

        revalidatePath("/marketing")
        return { success: true }
    } catch (error: any) {
        console.error("removeArticleFromCluster error:", error)
        return { success: false, error: error.message }
    }
}

/** Get pillar article context for AI-generating cluster posts */
export async function getClusterContext(
    clusterId: string
): Promise<{ success: boolean; data?: { clusterName: string; keywords: string[]; pillarTitle: string; pillarExcerpt: string; pillarKeyword: string; pillarHeadings: string[]; existingTopics: string[] }; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const clusterDoc = await adminDb.collection("blog_clusters").doc(clusterId).get()
        if (!clusterDoc.exists) return { success: false, error: "Cluster not found" }
        const cluster = clusterDoc.data() as ContentCluster

        let pillarTitle = ""
        let pillarExcerpt = ""
        let pillarKeyword = ""
        let pillarHeadings: string[] = []

        // Get pillar article context if it exists
        if (cluster.pillarArticleId) {
            const pillarDoc = await adminDb.collection("blog_articles").doc(cluster.pillarArticleId).get()
            if (pillarDoc.exists) {
                const pillar = pillarDoc.data() as BlogArticle
                pillarTitle = pillar.title || ""
                pillarExcerpt = pillar.excerpt || ""
                pillarKeyword = pillar.focusKeyword || ""
                // Extract H2 headings from the pillar content
                pillarHeadings = (pillar.content || "")
                    .split("\n")
                    .filter((line: string) => line.startsWith("## "))
                    .map((line: string) => line.replace(/^## /, ""))
            }
        }

        // Get existing cluster article titles to avoid overlap
        const existingTopics: string[] = []
        if (cluster.clusterArticleIds?.length > 0) {
            for (const artId of cluster.clusterArticleIds) {
                const artDoc = await adminDb.collection("blog_articles").doc(artId).get()
                if (artDoc.exists) {
                    existingTopics.push(artDoc.data()?.title || "")
                }
            }
        }

        return {
            success: true,
            data: {
                clusterName: cluster.name,
                keywords: cluster.targetKeywords || [],
                pillarTitle,
                pillarExcerpt,
                pillarKeyword,
                pillarHeadings,
                existingTopics,
            },
        }
    } catch (error: any) {
        console.error("getClusterContext error:", error)
        return { success: false, error: error.message }
    }
}

// ─── WordPress Image Upload ──────────────────────────────────────────────────

async function uploadImageToWP(
    wpUrl: string,
    authHeader: string,
    base64Data: string,
    slug: string,
    altText: string,
    caption?: string
): Promise<{ mediaId: number; mediaUrl: string }> {
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, "base64")
    const filename = `${slug}-featured.png`

    // Upload image to WordPress media library
    const uploadResponse = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
        method: "POST",
        headers: {
            Authorization: authHeader,
            "Content-Type": "image/png",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
        body: imageBuffer,
    })

    if (!uploadResponse.ok) {
        const errorBody = await uploadResponse.text()
        throw new Error(`Media upload failed (${uploadResponse.status}): ${errorBody.slice(0, 200)}`)
    }

    const media = await uploadResponse.json()

    // Update the media item with alt text and caption
    if (altText || caption) {
        await fetch(`${wpUrl}/wp-json/wp/v2/media/${media.id}`, {
            method: "PUT",
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                alt_text: altText || "",
                caption: caption || "",
            }),
        })
    }

    return {
        mediaId: media.id,
        mediaUrl: media.source_url,
    }
}

// ─── WordPress Publishing ───────────────────────────────────────────────────

export async function publishToWordPress(
    articleId: string,
    imageBase64?: string
): Promise<{ success: boolean; data?: WPPublishResult; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const wpUrl = process.env.WORDPRESS_URL
        const wpUser = process.env.WORDPRESS_USERNAME
        const wpPass = process.env.WORDPRESS_APP_PASSWORD

        if (!wpUrl || !wpUser || !wpPass) {
            return { success: false, error: "WordPress credentials not configured. Add WORDPRESS_URL, WORDPRESS_USERNAME, and WORDPRESS_APP_PASSWORD to your environment." }
        }

        // Get article
        const doc = await adminDb.collection("blog_articles").doc(articleId).get()
        if (!doc.exists) return { success: false, error: "Article not found" }
        const article = doc.data() as BlogArticle

        // Build full HTML with Key Takeaways, FAQ section, and schema markup
        const fullContent = buildFullArticleHTML({
            content: article.content,
            keyTakeaways: article.keyTakeaways,
            faqs: article.faqs,
            schemaMarkup: article.schemaMarkup,
        })

        const authHeader = "Basic " + Buffer.from(`${wpUser}:${wpPass}`).toString("base64")

        // ── Upload featured image if base64 data is provided ──
        let featuredMediaId = article.wpFeaturedMediaId || undefined

        if (imageBase64 && !featuredMediaId) {
            try {
                const uploadResult = await uploadImageToWP(
                    wpUrl,
                    authHeader,
                    imageBase64,
                    article.slug || "featured-image",
                    article.featuredImageAlt || article.title,
                    article.featuredImageCaption
                )
                if (uploadResult.mediaId) {
                    featuredMediaId = uploadResult.mediaId
                }
            } catch (imgErr: any) {
                console.error("Featured image upload failed:", imgErr.message)
                // Continue publishing even if image upload fails
            }
        }

        const wpPayload: Record<string, any> = {
            title: article.title,
            content: fullContent,
            excerpt: article.excerpt,
            status: "publish",
            slug: article.slug,
            meta: {
                _yoast_wpseo_title: article.metaTitle,
                _yoast_wpseo_metadesc: article.metaDescription,
                _yoast_wpseo_focuskw: article.focusKeyword,
            },
        }

        // Set featured image if we have a media ID
        if (featuredMediaId) {
            wpPayload.featured_media = featuredMediaId
        }

        let response: Response
        let postUrl: string

        if (article.wpPostId) {
            // Update existing post
            postUrl = `${wpUrl}/wp-json/wp/v2/posts/${article.wpPostId}`
            response = await fetch(postUrl, {
                method: "PUT",
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(wpPayload),
            })
        } else {
            // Create new post
            postUrl = `${wpUrl}/wp-json/wp/v2/posts`
            response = await fetch(postUrl, {
                method: "POST",
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(wpPayload),
            })
        }

        if (!response.ok) {
            const errorBody = await response.text()
            return { success: false, error: `WordPress API error (${response.status}): ${errorBody}` }
        }

        const wpPost = await response.json()

        // Update article with WP info
        const updatePayload: Record<string, any> = {
            wpPostId: wpPost.id,
            wpPublishedUrl: wpPost.link,
            wpLastSynced: new Date().toISOString(),
            status: "published",
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
        if (featuredMediaId) {
            updatePayload.wpFeaturedMediaId = featuredMediaId
        }
        await adminDb.collection("blog_articles").doc(articleId).update(updatePayload)

        revalidatePath("/marketing")
        return {
            success: true,
            data: {
                success: true,
                postId: wpPost.id,
                postUrl: wpPost.link,
            },
        }
    } catch (error: any) {
        console.error("publishToWordPress error:", error)
        return { success: false, error: error.message }
    }
}

// ─── Content Freshness ──────────────────────────────────────────────────────

export async function markArticleAsReviewed(articleId: string) {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        await adminDb.collection("blog_articles").doc(articleId).update({
            lastContentReviewDate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })

        revalidatePath("/marketing")
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to mark as reviewed" }
    }
}

export async function getStaleArticles(): Promise<{ success: boolean; articles?: { id: string; title: string; publishedAt: string; lastReview: string | null; monthsSinceReview: number }[] }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false }

        const snap = await adminDb.collection("blog_articles")
            .where("status", "==", "published")
            .get()

        const now = Date.now()
        const articles = snap.docs
            .map(doc => {
                const d = doc.data()
                const freshnessMonths = d.contentFreshnessMonths || 6
                const lastReview = d.lastContentReviewDate || d.publishedAt || d.createdAt
                const lastReviewDate = new Date(lastReview)
                const monthsSinceReview = Math.floor((now - lastReviewDate.getTime()) / (30 * 24 * 60 * 60 * 1000))

                if (monthsSinceReview < freshnessMonths) return null

                return {
                    id: doc.id,
                    title: d.title,
                    publishedAt: d.publishedAt || d.createdAt,
                    lastReview: d.lastContentReviewDate || null,
                    monthsSinceReview,
                }
            })
            .filter((a): a is NonNullable<typeof a> => a !== null)
            .sort((a, b) => b.monthsSinceReview - a.monthsSinceReview)

        return { success: true, articles }
    } catch (error) {
        return { success: false }
    }
}

// ─── Blog Stats ─────────────────────────────────────────────────────────────

export async function getBlogStats(): Promise<{ success: boolean; data?: BlogStats; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const articlesSnap = await adminDb.collection("blog_articles").get()
        const clustersSnap = await adminDb.collection("blog_clusters").get()

        let totalArticles = 0
        let publishedArticles = 0
        let draftArticles = 0
        let totalSeoScore = 0
        let totalWordCount = 0

        articlesSnap.docs.forEach((doc) => {
            const d = doc.data()
            totalArticles++
            if (d.status === "published") publishedArticles++
            if (d.status === "draft") draftArticles++
            totalSeoScore += d.seoScore || 0
            totalWordCount += d.wordCount || 0
        })

        return {
            success: true,
            data: {
                totalArticles,
                publishedArticles,
                draftArticles,
                avgSeoScore: totalArticles > 0 ? Math.round(totalSeoScore / totalArticles) : 0,
                totalWordCount,
                clustersCount: clustersSnap.size,
            },
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

// ─── Markdown to HTML (WordPress-optimized) ─────────────────────────────────

function markdownToBasicHTML(markdown: string): string {
    const lines = markdown.split("\n")
    const htmlParts: string[] = []
    let i = 0

    while (i < lines.length) {
        const line = lines[i]

        // Skip empty lines
        if (line.trim() === "") {
            i++
            continue
        }

        // Horizontal rule
        if (/^[-*_]{3,}\s*$/.test(line.trim())) {
            htmlParts.push("<hr />")
            i++
            continue
        }

        // Headers (no H1 — WordPress uses the post title as H1)
        const h3Match = line.match(/^### (.+)$/)
        if (h3Match) {
            htmlParts.push(`<h3 style="font-size:1.15em;margin-top:2em;margin-bottom:0.6em;">${inlineFormat(h3Match[1])}</h3>`)
            i++
            continue
        }
        const h2Match = line.match(/^## (.+)$/)
        if (h2Match) {
            htmlParts.push(`<h2 style="font-size:1.4em;margin-top:2.5em;margin-bottom:0.75em;">${inlineFormat(h2Match[1])}</h2>`)
            i++
            continue
        }
        const h1Match = line.match(/^# (.+)$/)
        if (h1Match) {
            // Render H1 in content as H2 since WP already uses the post title as H1
            htmlParts.push(`<h2 style="font-size:1.4em;margin-top:2.5em;margin-bottom:0.75em;">${inlineFormat(h1Match[1])}</h2>`)
            i++
            continue
        }

        // Table block
        if (line.trim().startsWith("|")) {
            const tableLines: string[] = []
            while (i < lines.length && lines[i].trim().startsWith("|")) {
                tableLines.push(lines[i].trim())
                i++
            }
            htmlParts.push(buildTable(tableLines))
            continue
        }

        // Unordered list block
        if (/^[-*] /.test(line)) {
            const items: string[] = []
            while (i < lines.length && /^[-*] /.test(lines[i])) {
                items.push(inlineFormat(lines[i].replace(/^[-*] /, "")))
                i++
            }
            htmlParts.push(
                `<ul style="margin:1em 0;padding-left:1.5em;">${items.map((item) => `<li style="margin-bottom:0.4em;">${item}</li>`).join("")}</ul>`
            )
            continue
        }

        // Ordered list block
        if (/^\d+\. /.test(line)) {
            const items: string[] = []
            while (i < lines.length && /^\d+\. /.test(lines[i])) {
                items.push(inlineFormat(lines[i].replace(/^\d+\. /, "")))
                i++
            }
            htmlParts.push(
                `<ol style="margin:1em 0;padding-left:1.5em;">${items.map((item) => `<li style="margin-bottom:0.4em;">${item}</li>`).join("")}</ol>`
            )
            continue
        }

        // Blockquote
        if (line.startsWith("> ")) {
            const quoteLines: string[] = []
            while (i < lines.length && lines[i].startsWith("> ")) {
                quoteLines.push(lines[i].replace(/^> /, ""))
                i++
            }
            htmlParts.push(
                `<blockquote style="border-left:4px solid currentColor;margin:1.5em 0;padding:0.8em 1.2em;opacity:0.85;">${quoteLines
                    .map((l) => inlineFormat(l))
                    .join("<br />")}</blockquote>`
            )
            continue
        }

        // Regular paragraph — collect consecutive non-blank, non-special lines
        const paraLines: string[] = []
        while (
            i < lines.length &&
            lines[i].trim() !== "" &&
            !/^#{1,3} /.test(lines[i]) &&
            !/^[-*] /.test(lines[i]) &&
            !/^\d+\. /.test(lines[i]) &&
            !lines[i].trim().startsWith("|") &&
            !lines[i].startsWith("> ") &&
            !/^[-*_]{3,}\s*$/.test(lines[i].trim())
        ) {
            paraLines.push(lines[i])
            i++
        }
        if (paraLines.length > 0) {
            htmlParts.push(
                `<p style="margin-bottom:1.2em;line-height:1.75;">${inlineFormat(paraLines.join(" "))}</p>`
            )
        }
    }

    return htmlParts.join("\n\n")
}

/** Inline formatting: bold, italic, links, inline code */
function inlineFormat(text: string): string {
    return text
        .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, '<code style="padding:2px 6px;border-radius:3px;font-size:0.9em;">$1</code>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
}

/** Build an HTML table from markdown table lines */
function buildTable(tableLines: string[]): string {
    if (tableLines.length === 0) return ""

    const parseCells = (line: string) =>
        line.split("|").filter(Boolean).map((c) => c.trim())

    // First row is header, second row is separator (skip it), rest are data
    const headerCells = parseCells(tableLines[0])
    const dataRows = tableLines.slice(2).filter((l) => l.trim() !== "") // skip separator row

    let table = `<table style="width:100%;border-collapse:collapse;margin:1.5em 0;">`
    table += "<thead><tr>"
    for (const cell of headerCells) {
        table += `<th style="border:1px solid rgba(128,128,128,0.3);padding:10px 14px;text-align:left;font-weight:600;">${inlineFormat(cell)}</th>`
    }
    table += "</tr></thead>"

    if (dataRows.length > 0) {
        table += "<tbody>"
        for (const row of dataRows) {
            const cells = parseCells(row)
            table += "<tr>"
            for (const cell of cells) {
                table += `<td style="border:1px solid rgba(128,128,128,0.3);padding:10px 14px;">${inlineFormat(cell)}</td>`
            }
            table += "</tr>"
        }
        table += "</tbody>"
    }

    table += "</table>"
    return table
}

/** Render Key Takeaways as a styled HTML box */
function renderKeyTakeawaysHTML(takeaways: string[]): string {
    if (!takeaways || takeaways.length === 0) return ""

    const items = takeaways
        .map((t) => `<li style="margin-bottom:0.5em;padding-left:0.3em;">${inlineFormat(t)}</li>`)
        .join("")

    return `
<div style="border:2px solid currentColor;border-radius:10px;padding:1.5em 2em;margin:1.5em 0 2em 0;opacity:0.95;">
  <p style="font-size:1.1em;font-weight:700;margin:0 0 0.8em 0;">📋 Key Takeaways</p>
  <ul style="margin:0;padding-left:1.3em;">${items}</ul>
</div>`
}

/** Render FAQ section as structured HTML (also supports FAQ schema) */
function renderFAQsHTML(faqs: FAQ[]): string {
    if (!faqs || faqs.length === 0) return ""

    const qaPairs = faqs
        .map(
            (faq) => `
  <div style="margin-bottom:1.5em;border-bottom:1px solid rgba(128,128,128,0.3);padding-bottom:1.2em;">
    <p style="font-size:1.1em;font-weight:700;margin:0 0 0.5em 0;">${inlineFormat(faq.question)}</p>
    <p style="margin:0;line-height:1.7;">${inlineFormat(faq.answer)}</p>
  </div>`
        )
        .join("")

    return `
<div style="margin-top:3em;padding-top:1.5em;border-top:2px solid rgba(128,128,128,0.3);">
  <h2 style="font-size:1.4em;margin-bottom:1em;">Frequently Asked Questions</h2>
  ${qaPairs}
</div>`
}

/** Assemble full article HTML with Key Takeaways, content, FAQ, and schema */
function buildFullArticleHTML(article: {
    content: string
    keyTakeaways?: string[]
    faqs?: FAQ[]
    schemaMarkup?: string
}): string {
    const mainContent = markdownToBasicHTML(article.content)
    const takeawaysBlock = renderKeyTakeawaysHTML(article.keyTakeaways || [])
    const faqBlock = renderFAQsHTML(article.faqs || [])

    // Insert Key Takeaways after the first paragraph
    let assembledContent = ""
    const firstParagraphEnd = mainContent.indexOf("</p>")
    if (takeawaysBlock && firstParagraphEnd !== -1) {
        assembledContent =
            mainContent.slice(0, firstParagraphEnd + 4) +
            "\n\n" +
            takeawaysBlock +
            "\n\n" +
            mainContent.slice(firstParagraphEnd + 4)
    } else {
        assembledContent = takeawaysBlock + "\n\n" + mainContent
    }

    // Append FAQ section at the end
    if (faqBlock) {
        assembledContent += "\n\n" + faqBlock
    }

    // Append schema markup as JSON-LD script
    if (article.schemaMarkup) {
        assembledContent += `\n\n<script type="application/ld+json">\n${article.schemaMarkup}\n</script>`
    }

    return assembledContent
}

// ─── Export for clipboard ───────────────────────────────────────────────────

export async function getArticleExportData(id: string): Promise<{
    success: boolean;
    data?: { html: string; markdown: string; schema: string };
    error?: string;
}> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const doc = await adminDb.collection("blog_articles").doc(id).get()
        if (!doc.exists) return { success: false, error: "Article not found" }

        const article = doc.data() as BlogArticle
        const html = buildFullArticleHTML({
            content: article.content,
            keyTakeaways: article.keyTakeaways,
            faqs: article.faqs,
            schemaMarkup: article.schemaMarkup,
        })

        return {
            success: true,
            data: {
                html,
                markdown: article.content,
                schema: article.schemaMarkup || "",
            },
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
