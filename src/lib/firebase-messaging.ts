import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging"
import { app } from "./firebase"

let messagingInstance: Messaging | null = null

function getMessagingInstance(): Messaging | null {
    if (typeof window === "undefined") return null
    if (!app) return null
    if (!messagingInstance) {
        messagingInstance = getMessaging(app)
    }
    return messagingInstance
}

/** True only if push is configured and the browser supports it. */
export function isPushConfigured(): boolean {
    return !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
}

export class PushNotConfiguredError extends Error {
    constructor() {
        super(
            "Push notifications aren't configured for this deployment. The workspace owner must set NEXT_PUBLIC_FIREBASE_VAPID_KEY in environment variables.",
        )
        this.name = "PushNotConfiguredError"
    }
}

/**
 * Request notification permission and get the FCM token.
 * Returns the token string, or null if denied/unsupported.
 * Throws PushNotConfiguredError if VAPID key is missing — callers can
 * catch and surface a clearer message than "permission denied".
 */
export async function requestPushToken(): Promise<string | null> {
    if (!isPushConfigured()) {
        throw new PushNotConfiguredError()
    }

    const messaging = getMessagingInstance()
    if (!messaging) return null

    const permission = await Notification.requestPermission()
    if (permission !== "granted") return null

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js")

    const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
    })

    return token || null
}

/**
 * Listen for foreground FCM messages. Returns an unsubscribe function.
 */
export function onForegroundMessage(
    callback: (data: { title: string; body: string; url?: string }) => void
): () => void {
    const messaging = getMessagingInstance()
    if (!messaging) return () => {}

    return onMessage(messaging, (payload) => {
        const { title, body, url } = payload.data || {}
        if (title) {
            callback({ title, body: body || "", url })
        }
    })
}
