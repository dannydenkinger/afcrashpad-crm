import { NextRequest, NextResponse } from "next/server"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const SERPER_API_KEY = process.env.SERPER_API_KEY

export async function POST(req: NextRequest) {
    // Rate limit: 20 requests per minute per IP
    const { allowed } = rateLimit(getRateLimitKey(req, "serp"), 20)
    if (!allowed) {
        return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    if (!SERPER_API_KEY) {
        return NextResponse.json(
            { error: "SERPER_API_KEY not configured" },
            { status: 500 }
        )
    }

    try {
        const { keyword, domain } = await req.json()

        if (!keyword || !domain) {
            return NextResponse.json(
                { error: "keyword and domain are required" },
                { status: 400 }
            )
        }

        const response = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
                "X-API-KEY": SERPER_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                q: keyword,
                gl: "us",
                hl: "en",
                num: 100,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("Serper API error:", errorText)
            return NextResponse.json(
                { error: "Serper API request failed" },
                { status: response.status }
            )
        }

        const data = await response.json()

        const organicResults = (data.organic || []).map(
            (result: any, index: number) => {
                const url = new URL(result.link)
                return {
                    position: index + 1,
                    title: result.title,
                    link: result.link,
                    snippet: result.snippet || "",
                    domain: url.hostname.replace("www.", ""),
                }
            }
        )

        // Find target domain position
        const normalizedDomain = domain.replace("www.", "").toLowerCase()
        const foundResult = organicResults.find(
            (r: any) => r.domain.toLowerCase() === normalizedDomain
        )

        return NextResponse.json({
            keyword,
            results: organicResults.slice(0, 20), // top 20 for display
            foundPosition: foundResult ? foundResult.position : null,
            searchVolume: data.searchParameters?.searchVolume || undefined,
        })
    } catch (error) {
        console.error("SERP check error:", error)
        return NextResponse.json(
            { error: "Failed to check SERP position" },
            { status: 500 }
        )
    }
}
