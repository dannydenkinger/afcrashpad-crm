import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://afcrashpad.com"
    return {
        rules: [
            {
                userAgent: "*",
                // Allow the public marketing pages; block everything app-side.
                allow: ["/", "/pricing", "/privacy", "/terms", "/help", "/changelog"],
                disallow: [
                    "/api/",
                    "/login",
                    "/register",
                    "/setup",
                    "/dashboard",
                    "/contacts",
                    "/pipeline",
                    "/calendar",
                    "/tasks",
                    "/communications",
                    "/marketing",
                    "/finance",
                    "/automations",
                    "/documents",
                    "/notifications",
                    "/search",
                    "/settings",
                    "/payout/",
                    "/sign/",
                    "/unsub/",
                    "/booking/",
                    "/forms/",
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
