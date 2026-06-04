"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

/**
 * Quick settings search. Each entry maps a set of keywords to a real
 * settings route — selecting (or matching) one navigates there. Settings
 * is now a set of routed sub-pages, so we push the URL rather than clicking
 * a tab trigger.
 */
const SETTINGS_MAP: Record<string, { path: string; keywords: string[] }> = {
    "profile": { path: "/settings/profile", keywords: ["profile", "name", "email", "avatar", "account", "personal"] },
    "notifications": { path: "/settings/profile", keywords: ["notification", "push", "email alerts", "preferences"] },
    "branding": { path: "/settings/branding", keywords: ["branding", "logo", "color", "company name", "brand"] },
    "workspace": { path: "/settings/workspace", keywords: ["workspace", "lead sources", "tags", "status", "pipeline", "priority"] },
    "bases": { path: "/settings/bases", keywords: ["bases", "military bases", "base", "lodging", "zip code", "seasonal rate", "periods"] },
    "accommodations": { path: "/settings/workspace/statuses", keywords: ["accommodations", "special accommodations", "pets", "spouse", "dependents"] },
    "statuses": { path: "/settings/workspace/statuses", keywords: ["statuses", "custom statuses", "lifecycle", "lead", "active client"] },
    "users": { path: "/settings/team", keywords: ["users", "team", "roles", "permissions", "invite", "admin", "owner", "agent"] },
    "integrations": { path: "/settings/integrations/services", keywords: ["integrations", "google", "calendar", "ical", "sync", "api", "connect"] },
    "automations": { path: "/settings/automations", keywords: ["automations", "email template", "sequence", "scheduled", "workflow", "follow-up", "reminders"] },
    "custom-fields": { path: "/settings/workspace/fields", keywords: ["custom fields", "fields", "metadata", "properties"] },
    "api-keys": { path: "/settings/integrations/webhooks", keywords: ["api keys", "api", "token", "secret", "key", "webhooks"] },
    "reports": { path: "/settings/data", keywords: ["reports", "scheduled reports", "export", "analytics"] },
    "audit": { path: "/settings/team", keywords: ["audit", "log", "history", "changes", "security"] },
    "data": { path: "/settings/data", keywords: ["data", "export", "csv", "backup", "import"] },
}

export function SettingsSearch() {
    const [query, setQuery] = useState("")
    const router = useRouter()

    const handleSearch = useCallback((value: string) => {
        setQuery(value)
    }, [])

    const go = useCallback((path: string) => {
        setQuery("")
        router.push(path)
    }, [router])

    const matches = query.trim()
        ? Object.entries(SETTINGS_MAP).filter(([, config]) =>
            config.keywords.some(k => k.includes(query.toLowerCase()))
        )
        : []

    return (
        <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
                type="text"
                placeholder="Search settings..."
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && matches.length > 0) go(matches[0][1].path) }}
                className="w-full sm:w-72 h-9 pl-9 pr-8 text-sm rounded-md border bg-muted/20 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {query && (
                <button
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
            {query && matches.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full sm:w-72 bg-popover border rounded-md shadow-md py-1 max-h-48 overflow-y-auto">
                    {matches.map(([key, config]) => (
                        <button
                            key={key}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 capitalize"
                            onClick={() => go(config.path)}
                        >
                            {key.replace("-", " ")}
                            <span className="text-xs text-muted-foreground ml-2">
                                {config.keywords.slice(0, 3).join(", ")}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
