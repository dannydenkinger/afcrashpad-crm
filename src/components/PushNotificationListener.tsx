"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { onForegroundMessage } from "@/lib/firebase-messaging"
import { useSession } from "next-auth/react"

/**
 * Dispatches a custom "crm:data-update" event when a push notification arrives.
 * Pages can listen for this to auto-refresh their data.
 */
function broadcastDataUpdate(type?: string) {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("crm:data-update", { detail: { type } }))
    }
}

export function PushNotificationListener() {
    const { status } = useSession()

    useEffect(() => {
        if (status !== "authenticated") return

        const unsubscribe = onForegroundMessage(({ title, body, url }) => {
            toast(title, {
                description: body,
                action: url
                    ? { label: "View", onClick: () => (window.location.href = url) }
                    : undefined,
                duration: 6000,
            })
            // Broadcast so open pages can auto-refresh
            broadcastDataUpdate()
        })

        return unsubscribe
    }, [status])

    return null
}
