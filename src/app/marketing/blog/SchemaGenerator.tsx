"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Code2, Wand2, Copy, Check } from "lucide-react"
import type { BlogArticle, FAQ } from "./types"

interface SchemaGeneratorProps {
    article: Partial<BlogArticle>
    schema: string
    onChange: (schema: string) => void
}

export default function SchemaGenerator({ article, schema, onChange }: SchemaGeneratorProps) {
    const [copied, setCopied] = useState(false)
    /**
     * Schema markup names the publisher (the workspace) — pull these from
     * per-workspace branding rather than env vars. Without this, schema
     * for a customer's blog post would say "Vesta CRM" + "example.com",
     * which is both wrong and a leak of operator identity into the
     * customer's SEO output.
     */
    const [branding, setBranding] = useState<{ companyName?: string; websiteUrl?: string } | null>(null)
    useEffect(() => {
        let cancelled = false
        import("@/app/settings/branding/actions").then(({ getBrandingSettings }) =>
            getBrandingSettings().then((b) => {
                if (cancelled) return
                if (b) setBranding({ companyName: b.companyName, websiteUrl: b.websiteUrl })
            }).catch(() => {})
        )
        return () => { cancelled = true }
    }, [])

    const generateArticleSchema = () => {
        const publisherName = branding?.companyName || "Your Company"
        const siteUrl = (branding?.websiteUrl || "").replace(/\/+$/, "")
        const schemaObj: Record<string, any> = {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.metaTitle || article.title || "",
            description: article.metaDescription || article.excerpt || "",
            author: {
                "@type": "Person",
                name: article.author || "Content Team",
            },
            publisher: {
                "@type": "Organization",
                name: publisherName,
                ...(siteUrl ? { url: siteUrl } : {}),
            },
            datePublished: article.publishedAt || new Date().toISOString(),
            dateModified: article.updatedAt || new Date().toISOString(),
            mainEntityOfPage: {
                "@type": "WebPage",
                "@id": article.wpPublishedUrl || (siteUrl ? `${siteUrl}/blog/${article.slug || ""}` : `/blog/${article.slug || ""}`),
            },
        }

        if (article.featuredImage) {
            schemaObj.image = article.featuredImage
        }

        if (article.wordCount) {
            schemaObj.wordCount = article.wordCount
        }

        // Add FAQ schema if FAQs exist
        if (article.faqs && article.faqs.length > 0) {
            const faqSchema = {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: article.faqs
                    .filter((faq: FAQ) => faq.question && faq.answer)
                    .map((faq: FAQ) => ({
                        "@type": "Question",
                        name: faq.question,
                        acceptedAnswer: {
                            "@type": "Answer",
                            text: faq.answer,
                        },
                    })),
            }

            // Return array of schemas
            onChange(JSON.stringify([schemaObj, faqSchema], null, 2))
            return
        }

        onChange(JSON.stringify(schemaObj, null, 2))
    }

    const copySchema = async () => {
        try {
            await navigator.clipboard.writeText(schema)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Fallback
        }
    }

    const isValidJSON = (str: string) => {
        if (!str) return true
        try {
            JSON.parse(str)
            return true
        } catch {
            return false
        }
    }

    const valid = isValidJSON(schema)

    return (
        <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Code2 className="h-4 w-4 text-purple-500" />
                        <CardTitle className="text-sm font-semibold">Schema Markup</CardTitle>
                        {schema && (
                            <Badge
                                variant="outline"
                                className={`text-[8px] h-4 ${valid ? "border-emerald-500/30 text-emerald-500" : "border-rose-500/30 text-rose-500"}`}
                            >
                                {valid ? "Valid JSON-LD" : "Invalid JSON"}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={generateArticleSchema}
                        >
                            <Wand2 className="h-3 w-3" />
                            Auto-Generate
                        </Button>
                        {schema && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={copySchema}
                            >
                                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copied ? "Copied" : "Copy"}
                            </Button>
                        )}
                    </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                    JSON-LD structured data for search engine rich results. Auto-generates Article + FAQPage schema.
                </p>
            </CardHeader>
            <CardContent>
                <Textarea
                    value={schema}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder='Click "Auto-Generate" to create schema markup from your article data...'
                    className={`font-mono text-[11px] min-h-[200px] resize-y ${!valid ? "border-rose-500/50" : ""}`}
                    rows={10}
                />
            </CardContent>
        </Card>
    )
}
