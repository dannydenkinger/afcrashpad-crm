import type { MetadataRoute } from "next"

/**
 * Sitemap covering only the public marketing surface. App-side routes
 * (dashboard, pipeline, contacts, etc.) require auth and shouldn't be
 * indexed — they're also excluded by robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vesta-crm.com"
    const lastModified = new Date()

    const routes: Array<{
        path: string
        priority: number
        changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
    }> = [
        { path: "/", priority: 1.0, changeFrequency: "weekly" },
        { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
        { path: "/help", priority: 0.7, changeFrequency: "weekly" },
        { path: "/changelog", priority: 0.6, changeFrequency: "weekly" },
        { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
        { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
        { path: "/status", priority: 0.4, changeFrequency: "daily" },
    ]

    return routes.map(({ path, priority, changeFrequency }) => ({
        url: `${baseUrl}${path}`,
        lastModified,
        changeFrequency,
        priority,
    }))
}
