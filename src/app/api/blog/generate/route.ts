import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import Anthropic from "@anthropic-ai/sdk"
import type { AIGenerateRequest } from "@/app/marketing/blog/types"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        // Rate limit: 10 generations per minute per user
        const { allowed } = rateLimit(`blog-gen:${session.user.id}`, 10)
        if (!allowed) {
            return NextResponse.json({ success: false, error: "Rate limit exceeded. Please wait a moment." }, { status: 429 })
        }

        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: "ANTHROPIC_API_KEY not configured" },
                { status: 500 }
            )
        }

        const body: AIGenerateRequest = await request.json()
        const { topic, type, focusKeyword, secondaryKeywords, tone, targetWordCount, clusterContext, additionalInstructions } = body

        const wordTarget = targetWordCount || (type === "pillar" ? 2200 : type === "cluster" ? 1400 : 1500)

        const systemPrompt = `You are the Authority Architect — an elite SEO content strategist. You write content that ranks on page 1 by combining genuine expertise with technical SEO precision.

Your content follows these rules:
1. BLUF METHOD: Lead with the answer. First paragraph directly answers the search query.
2. INFORMATION GAIN: Every section must add unique value not found in competing articles. Include specific data, examples, or insights.
3. E-E-A-T: Write from genuine experience. Include specific details, data points, and actionable advice that demonstrates expertise.
4. FORMATTING: Max 3 sentences per paragraph. Use bullet lists, numbered lists, and data tables frequently.
5. STRUCTURE: Use descriptive H2 subheadings (not generic ones). Each H2 should contain the topic keyword naturally.
6. INTERNAL LINKING: Reference related topics with placeholder links like [Topic Name](/blog/topic-slug).
7. NO FLUFF: Never start with "In today's world" or similar filler. Every sentence must earn its place.

Output format: Return a JSON object with these fields:
- title: The H1 title (include focus keyword naturally)
- metaTitle: SEO title tag (50-60 chars, keyword near front)
- metaDescription: Meta description (120-160 chars, includes keyword and CTA)
- excerpt: Brief summary (1-2 sentences)
- content: Full article in Markdown format
- keyTakeaways: Array of 3-5 key takeaway strings
- faqs: Array of objects with "question" and "answer" fields (3-5 FAQs)
- schemaMarkup: JSON-LD Article schema as a string

Important: Return ONLY the JSON object, no markdown code fences or other text.`

        let userPrompt = `Write a ${type === "pillar" ? "comprehensive pillar" : type === "cluster" ? "focused cluster" : "standalone"} article about: "${topic}"

Focus keyword: "${focusKeyword}"
${secondaryKeywords.length > 0 ? `Secondary keywords: ${secondaryKeywords.join(", ")}` : ""}
Target word count: ~${wordTarget} words
${tone ? `Tone: ${tone}` : "Tone: Professional but approachable, written for military service members"}
${clusterContext ? `\nContext from pillar article:\n${clusterContext}` : ""}
${additionalInstructions ? `\nAdditional instructions:\n${additionalInstructions}` : ""}

The article is for afcrashpad.com, a service providing crashpad housing for Air Force personnel during temporary duty (TDY) and permanent change of station (PCS).`

        const client = new Anthropic({ apiKey })

        const message = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8000,
            messages: [
                {
                    role: "user",
                    content: userPrompt,
                },
            ],
            system: systemPrompt,
        })

        // Extract text from response
        const responseText = message.content
            .filter((block): block is Anthropic.TextBlock => block.type === "text")
            .map((block) => block.text)
            .join("")

        // Parse the JSON response
        let parsed
        try {
            // Try to extract JSON from the response (handle potential markdown fences)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0])
            } else {
                throw new Error("No JSON found in response")
            }
        } catch (parseError) {
            console.error("Failed to parse AI response:", responseText.substring(0, 500))
            return NextResponse.json({
                success: false,
                error: "Failed to parse AI response. The generated content may be malformed.",
            })
        }

        return NextResponse.json({
            success: true,
            content: parsed.content,
            title: parsed.title,
            metaTitle: parsed.metaTitle,
            metaDescription: parsed.metaDescription,
            excerpt: parsed.excerpt,
            focusKeyword: focusKeyword,
            secondaryKeywords: secondaryKeywords,
            keyTakeaways: parsed.keyTakeaways || [],
            faqs: (parsed.faqs || []).map((faq: any) => ({
                id: crypto.randomUUID(),
                question: faq.question,
                answer: faq.answer,
            })),
            schemaMarkup: typeof parsed.schemaMarkup === "string"
                ? parsed.schemaMarkup
                : JSON.stringify(parsed.schemaMarkup, null, 2),
        })
    } catch (error: any) {
        console.error("Blog generate error:", error)
        return NextResponse.json(
            { success: false, error: error.message || "Generation failed" },
            { status: 500 }
        )
    }
}
