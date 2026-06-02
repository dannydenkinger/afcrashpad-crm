import { NextRequest, NextResponse } from "next/server"

const ALLOWED_HOSTS = new Set([
    "firebasestorage.app",
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
])

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url")

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
    }

    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }
    if (parsed.protocol !== "https:") {
        return NextResponse.json({ error: "Invalid URL" }, { status: 403 })
    }
    const host = parsed.hostname.toLowerCase()
    const hostAllowed = [...ALLOWED_HOSTS].some(
        (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    )
    if (!hostAllowed) {
        return NextResponse.json({ error: "Invalid URL" }, { status: 403 })
    }

    try {
        const response = await fetch(url)

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch PDF: ${response.status}` },
                { status: response.status }
            )
        }

        const arrayBuffer = await response.arrayBuffer()

        return new NextResponse(arrayBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Cache-Control": "public, max-age=3600",
            },
        })
    } catch (err) {
        console.error("PDF proxy error:", err)
        return NextResponse.json(
            { error: "Failed to proxy PDF" },
            { status: 500 }
        )
    }
}
