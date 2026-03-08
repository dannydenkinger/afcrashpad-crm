import { NextRequest, NextResponse } from "next/server"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY

export async function POST(req: NextRequest) {
    try {
        // Rate limit: 10 requests per minute per IP
        const { allowed } = rateLimit(getRateLimitKey(req, "pagespeed"), 10)
        if (!allowed) {
            return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
        }

        const { url, strategy = "mobile" } = await req.json()

        if (!url) {
            return NextResponse.json(
                { error: "url is required" },
                { status: 400 }
            )
        }

        const apiUrl = new URL(
            "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
        )
        apiUrl.searchParams.set("url", url)
        apiUrl.searchParams.set("strategy", strategy)
        // Each category must be a separate param
        for (const cat of ["performance", "seo", "accessibility", "best-practices"]) {
            apiUrl.searchParams.append("category", cat)
        }
        if (PAGESPEED_API_KEY) {
            apiUrl.searchParams.set("key", PAGESPEED_API_KEY)
        }

        const response = await fetch(apiUrl.toString())

        if (!response.ok) {
            const errorText = await response.text()
            console.error("PageSpeed API error:", errorText)
            return NextResponse.json(
                { error: "PageSpeed API request failed" },
                { status: response.status }
            )
        }

        const data = await response.json()
        const categories = data.lighthouseResult?.categories || {}
        const audits = data.lighthouseResult?.audits || {}

        return NextResponse.json({
            performanceScore: Math.round(
                (categories.performance?.score || 0) * 100
            ),
            seoScore: Math.round((categories.seo?.score || 0) * 100),
            accessibilityScore: Math.round(
                (categories.accessibility?.score || 0) * 100
            ),
            bestPracticesScore: Math.round(
                (categories["best-practices"]?.score || 0) * 100
            ),
            fcp: audits["first-contentful-paint"]?.numericValue || 0,
            lcp: audits["largest-contentful-paint"]?.numericValue || 0,
            cls: audits["cumulative-layout-shift"]?.numericValue || 0,
            tbt: audits["total-blocking-time"]?.numericValue || 0,
            si: audits["speed-index"]?.numericValue || 0,
            tti: audits["interactive"]?.numericValue || 0,
            fetchedAt: new Date().toISOString(),
        })
    } catch (error) {
        console.error("PageSpeed check error:", error)
        return NextResponse.json(
            { error: "Failed to check PageSpeed" },
            { status: 500 }
        )
    }
}
