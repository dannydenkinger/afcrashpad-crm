"use client"

/**
 * Register the service worker for offline support.
 * Should be called once on app mount (e.g., from a top-level component).
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === "undefined") return null
    if (!("serviceWorker" in navigator)) return null

    // The caching service worker is a PRODUCTION-only feature. In development
    // its cache-first strategy for /_next/static serves STALE JS chunks, which
    // breaks soft navigations and forces a hard refresh on every page. So in
    // dev we don't register it — and we proactively unregister + purge any SW
    // and caches left over from a previous dev session so existing installs
    // self-heal without the user having to clear site data manually.
    if (process.env.NODE_ENV !== "production") {
        try {
            const regs = await navigator.serviceWorker.getRegistrations()
            await Promise.all(
                regs
                    .filter((r) => (r.active || r.waiting || r.installing)?.scriptURL?.endsWith("/sw.js"))
                    .map((r) => r.unregister()),
            )
            if ("caches" in window) {
                const keys = await caches.keys()
                await Promise.all(
                    keys.filter((k) => /^(vesta|afcrashpad)-/.test(k)).map((k) => caches.delete(k)),
                )
            }
        } catch {
            // best-effort cleanup; nothing to do if it fails
        }
        return null
    }

    try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
        })

        // Listen for sync-complete messages from service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data?.type === "sync-complete") {
                // Dispatch a custom event so pages can refresh their data
                window.dispatchEvent(new CustomEvent("crm:data-update"))
                console.log(
                    `[SW] Synced ${event.data.count} queued mutation(s)`
                )
            }
        })

        // Check for updates periodically (every 60 minutes)
        setInterval(() => {
            registration.update()
        }, 60 * 60 * 1000)

        return registration
    } catch (error) {
        console.error("[SW] Registration failed:", error)
        return null
    }
}

/**
 * Queue a mutation for offline replay.
 * Call this when a server action fails due to being offline.
 */
export function queueOfflineMutation(mutation: {
    url: string
    method: string
    headers: Record<string, string>
    body: string
}): void {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
        return
    }

    navigator.serviceWorker.controller.postMessage({
        type: "QUEUE_MUTATION",
        mutation,
    })

    // Request background sync if available
    if ("SyncManager" in window) {
        navigator.serviceWorker.ready.then((reg) => {
            ;(reg as any).sync?.register("sync-mutations")
        })
    }
}
