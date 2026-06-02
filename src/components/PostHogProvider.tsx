"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { initPostHog, identifyUser, resetPostHog } from "@/lib/posthog/client"

/**
 * Initializes PostHog on mount and keeps identify() in sync with the
 * NextAuth session. Renders nothing.
 *
 * - When the user signs in, we call identify() with their userId + a
 *   workspace group.
 * - When the user signs out (status flips to "unauthenticated"), we
 *   call posthog.reset() so the next anonymous visitor isn't merged
 *   into the previous user's profile.
 *
 * Safe to render unconditionally — does nothing when
 * NEXT_PUBLIC_POSTHOG_KEY is unset.
 */
export function PostHogProvider() {
    const { data: session, status } = useSession()

    useEffect(() => {
        initPostHog()
    }, [])

    useEffect(() => {
        if (status === "authenticated" && session?.user) {
            const u = session.user as {
                id?: string
                email?: string | null
                name?: string | null
                role?: string | null
                workspaceId?: string | null
                workspaceName?: string | null
            }
            if (!u.id) return
            identifyUser({
                userId: u.id,
                email: u.email,
                name: u.name,
                role: u.role,
                workspaceId: u.workspaceId,
                workspaceName: u.workspaceName,
            })
        } else if (status === "unauthenticated") {
            resetPostHog()
        }
    }, [status, session?.user])

    return null
}
