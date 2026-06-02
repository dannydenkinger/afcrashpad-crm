"use client"

import { SessionProvider } from "next-auth/react"
import { useEffect } from "react"
import { PostHogProvider } from "@/components/PostHogProvider"

function ServiceWorkerRegistration() {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/firebase-messaging-sw.js")
                .catch(() => {})
        }
    }, [])
    return null
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ServiceWorkerRegistration />
            <PostHogProvider />
            {children}
        </SessionProvider>
    )
}
