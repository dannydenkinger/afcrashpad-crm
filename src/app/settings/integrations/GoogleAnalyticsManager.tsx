"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, ExternalLink, Check, BarChart3, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface Props {
    /** Whether Google OAuth has been completed for this workspace. */
    googleConnected: boolean
    /** Currently selected GA4 property ID, or null if none picked. */
    initialGa4PropertyId: string | null
    /** Currently selected Search Console site URL, or null if none picked. */
    initialGscSiteUrl: string | null
}

interface GA4Property {
    id: string
    displayName: string
}

interface GSCSite {
    siteUrl: string
    permissionLevel: string
}

/**
 * Inline picker for the Google Analytics property + Search Console site.
 *
 * The OAuth grant lives at /api/auth/google-services (workspace-wide); once
 * connected, this component fetches the list of GA4 properties / GSC sites
 * the connected account has access to and lets the admin pick which one to
 * read from. Selections are persisted in settings/integrations.google so
 * the marketing dashboards know which property/site to query.
 *
 * Saves are optimistic — we update local state immediately and surface a
 * toast if the server action fails.
 */
export function GoogleAnalyticsManager({
    googleConnected,
    initialGa4PropertyId,
    initialGscSiteUrl,
}: Props) {
    const [ga4Property, setGa4Property] = useState<string | null>(initialGa4PropertyId)
    const [gscSite, setGscSite] = useState<string | null>(initialGscSiteUrl)
    const [ga4List, setGa4List] = useState<GA4Property[]>([])
    const [gscList, setGscList] = useState<GSCSite[]>([])
    const [loadingGa4, setLoadingGa4] = useState(false)
    const [loadingGsc, setLoadingGsc] = useState(false)
    const [, startTransition] = useTransition()

    // Load GA4 properties + GSC sites once OAuth is in place.
    useEffect(() => {
        if (!googleConnected) return
        let cancelled = false
        setLoadingGa4(true)
        setLoadingGsc(true)
        ;(async () => {
            try {
                const actions = await import("@/app/setup/actions")
                const [gaRes, gscRes] = await Promise.all([
                    actions.listGA4Properties(),
                    actions.listGSCSites(),
                ])
                if (cancelled) return
                if (gaRes && Array.isArray(gaRes.properties)) setGa4List(gaRes.properties)
                if (gscRes && Array.isArray(gscRes.sites)) setGscList(gscRes.sites)
            } catch (err) {
                console.error("Failed to load Google services lists:", err)
            } finally {
                if (!cancelled) {
                    setLoadingGa4(false)
                    setLoadingGsc(false)
                }
            }
        })()
        return () => { cancelled = true }
    }, [googleConnected])

    const saveGa4 = (propertyId: string) => {
        setGa4Property(propertyId)
        startTransition(async () => {
            const { selectGA4Property } = await import("@/app/setup/actions")
            const res = await selectGA4Property(propertyId)
            if (res?.success) toast.success("Analytics property saved")
            else toast.error("Failed to save analytics property")
        })
    }

    const saveGsc = (siteUrl: string) => {
        setGscSite(siteUrl)
        startTransition(async () => {
            const { selectGSCSite } = await import("@/app/setup/actions")
            const res = await selectGSCSite(siteUrl)
            if (res?.success) toast.success("Search Console site saved")
            else toast.error("Failed to save Search Console site")
        })
    }

    if (!googleConnected) {
        return (
            <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                        <BarChart3 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">Google Analytics &amp; Search Console</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Connect a Google account that has access to your GA4 property and Search Console
                            site. Once connected, you&apos;ll pick which property and site to read from below.
                        </p>
                    </div>
                </div>
                <Button asChild size="sm" className="w-full sm:w-auto">
                    <a href="/api/auth/google-services">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Connect Google
                    </a>
                </Button>
            </div>
        )
    }

    return (
        <div className="rounded-xl border bg-card p-4 space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" /> Google connected
                    </span>
                </div>
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                    <a href="/api/auth/google-services">Reconnect</a>
                </Button>
            </div>

            {/* GA4 picker */}
            <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Google Analytics property</span>
                </div>
                {loadingGa4 ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading properties…
                    </div>
                ) : ga4List.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        No GA4 properties found on this Google account. Add the account as a viewer in
                        Google Analytics, then click <em>Reconnect</em>.
                    </p>
                ) : (
                    <Select value={ga4Property || ""} onValueChange={saveGa4}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Pick a property…" />
                        </SelectTrigger>
                        <SelectContent>
                            {ga4List.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.displayName} <span className="text-muted-foreground ml-1">({p.id})</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* GSC picker */}
            <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Search Console site</span>
                </div>
                {loadingGsc ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading sites…
                    </div>
                ) : gscList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        No Search Console sites found on this Google account. Verify your site at{" "}
                        <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            search.google.com/search-console
                        </a>{" "}
                        first, then reconnect.
                    </p>
                ) : (
                    <Select value={gscSite || ""} onValueChange={saveGsc}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Pick a site…" />
                        </SelectTrigger>
                        <SelectContent>
                            {gscList.map((s) => (
                                <SelectItem key={s.siteUrl} value={s.siteUrl}>
                                    {s.siteUrl}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <p className="text-[11px] text-muted-foreground">
                Both selections are saved per workspace and used by the marketing dashboard to pull traffic
                and ranking data.
            </p>
        </div>
    )
}
