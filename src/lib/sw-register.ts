"use client"

/**
 * Register the service worker for offline support.
 * Should be called once on app mount (e.g., from a top-level component).
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === "undefined") return null
    if (!("serviceWorker" in navigator)) return null

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
