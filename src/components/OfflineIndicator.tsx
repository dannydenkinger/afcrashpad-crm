"use client"

import { useState, useEffect, useRef } from "react"
import { WifiOff, Wifi } from "lucide-react"
import { registerServiceWorker } from "@/lib/sw-register"

export function OfflineIndicator() {
    const [isOffline, setIsOffline] = useState(false)
    const [justReconnected, setJustReconnected] = useState(false)
    const wasOffline = useRef(false)

    // Register service worker on mount
    useEffect(() => {
        registerServiceWorker()
    }, [])

    useEffect(() => {
        const goOffline = () => {
            setIsOffline(true)
            wasOffline.current = true
        }
        const goOnline = () => {
            setIsOffline(false)
            if (wasOffline.current) {
                setJustReconnected(true)
                wasOffline.current = false
                // Show reconnected message for 3 seconds then dismiss
                setTimeout(() => setJustReconnected(false), 3000)
                // Trigger data refresh
                window.dispatchEvent(new CustomEvent("crm:data-update"))
            }
        }

        // Check initial state
        if (!navigator.onLine) {
            setIsOffline(true)
            wasOffline.current = true
        }

        window.addEventListener("offline", goOffline)
        window.addEventListener("online", goOnline)

        return () => {
            window.removeEventListener("offline", goOffline)
            window.removeEventListener("online", goOnline)
        }
    }, [])

    if (justReconnected) {
        return (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg shadow-lg animate-in slide-in-from-bottom-4 duration-300">
                <Wifi className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">Back online — syncing changes</span>
            </div>
        )
    }

    if (!isOffline) return null

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2.5 rounded-lg shadow-lg animate-in slide-in-from-bottom-4 duration-300">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">You&apos;re offline — changes will sync when reconnected</span>
        </div>
    )
}
