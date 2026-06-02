import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth-guard"
import { rateLimit } from "@/lib/rate-limit"

const GEMINI_MODEL = "gemini-3.1-flash-image-preview"
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export async function POST(request: NextRequest) {
    try {
        const session = await getAuthSession()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Rate limit: 5 image generations per minute per user
        const { allowed } = rateLimit(`img-gen:${session.user.id}`, 5)
        if (!allowed) {
            return NextResponse.json({ error: "Rate limit exceeded. Please wait." }, { status: 429 })
        }

        const apiKey = process.env.GOOGLE_GEMINI_API_KEY
        if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
            return NextResponse.json(
                { error: "Google Gemini API key not configured. Add GOOGLE_GEMINI_API_KEY to your .env.local file." },
                { status: 500 }
            )
        }

        const body = await request.json()
        const { title, focusKeyword, excerpt, type } = body

        if (!title) {
            return NextResponse.json({ error: "Article title is required" }, { status: 400 })
        }

        // Build an image generation prompt optimized for blog featured images
        const imagePrompt = buildImagePrompt(title, focusKeyword, excerpt, type)

        // Call Gemini API for image generation
        const geminiResponse = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: imagePrompt }],
                    },
                ],
                generationConfig: {
                    responseModalities: ["TEXT", "IMAGE"],
                },
            }),
        })

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text()
            console.error("Gemini API error:", errorBody)
            return NextResponse.json(
                { error: `Image generation failed (${geminiResponse.status}): ${errorBody.slice(0, 200)}` },
                { status: geminiResponse.status }
            )
        }

        const geminiData = await geminiResponse.json()

        // Extract image data from response
        const candidate = geminiData.candidates?.[0]
        if (!candidate?.content?.parts) {
            return NextResponse.json(
                { error: "No image generated. Try rephrasing the article title." },
                { status: 500 }
            )
        }

        let imageData: string | null = null
        let mimeType = "image/png"
        let geminiText = ""

        for (const part of candidate.content.parts) {
            // Gemini API returns camelCase (inlineData) in REST responses
            const inlineData = part.inlineData || part.inline_data
            if (inlineData) {
                imageData = inlineData.data
                mimeType = inlineData.mimeType || inlineData.mime_type || "image/png"
            }
            if (part.text) {
                geminiText = part.text
            }
        }

        if (!imageData) {
            return NextResponse.json(
                { error: "Image generation did not return image data. Try again." },
                { status: 500 }
            )
        }

        // Generate SEO-optimized alt text, caption, and title attribute
        const seoMeta = generateImageSEO(title, focusKeyword, excerpt)

        return NextResponse.json({
            success: true,
            imageData, // base64 encoded
            mimeType,
            altText: seoMeta.altText,
            caption: seoMeta.caption,
            titleAttr: seoMeta.titleAttr,
            geminiDescription: geminiText, // Optional text Gemini returned about the image
        })
    } catch (error: any) {
        console.error("generate-image error:", error)
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
    }
}

/**
 * Build a focused prompt for professional blog featured images.
 * Avoids text in images (hard for AI), focuses on visual metaphors.
 */
function buildImagePrompt(
    title: string,
    focusKeyword?: string,
    excerpt?: string,
    type?: string
): string {
    const context = excerpt || title

    return `Generate a stunning, edge-to-edge photorealistic blog featured image for: "${title}".

Style: Modern editorial photography, cinematic lighting, shallow depth of field, rich colors.
Composition: 16:9 landscape, subject fills the entire frame edge-to-edge with NO borders, NO margins, NO white space, NO padding around the image.
Topic context: ${context}
${focusKeyword ? `Visual theme: ${focusKeyword}` : ""}
${type === "pillar" ? "Mood: Authoritative, expansive, comprehensive — this is a cornerstone guide." : "Mood: Warm, inviting, professional."}

CRITICAL RULES:
- The image MUST fill the entire canvas completely — no borders or empty space on any edge
- Absolutely NO text, words, letters, numbers, watermarks, or logos anywhere in the image
- NO artificial frames, vignettes, or decorative borders
- High detail, sharp focus, professional color grading
- Suitable for a professional business blog`
}

/**
 * Generate SEO-optimized image metadata from article info.
 * No extra API call needed — we craft this from the article data.
 */
function generateImageSEO(
    title: string,
    focusKeyword?: string,
    excerpt?: string
): { altText: string; caption: string; titleAttr: string } {
    // Alt text: descriptive, includes keyword, under 125 chars
    const keyword = focusKeyword || ""
    const baseAlt = keyword
        ? `${keyword} - ${title}`
        : title

    const altText = baseAlt.length > 125
        ? baseAlt.slice(0, 122) + "..."
        : baseAlt

    // Caption: slightly more descriptive, can be longer
    const caption = excerpt
        ? excerpt.length > 200 ? excerpt.slice(0, 197) + "..." : excerpt
        : `Featured image for: ${title}`

    // Title attribute: concise version
    const titleAttr = title.length > 70
        ? title.slice(0, 67) + "..."
        : title

    return { altText, caption, titleAttr }
}
