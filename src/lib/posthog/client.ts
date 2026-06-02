"use client"

import posthog from "posthog-js"
import type { VestaEvent } from "./events"

let initialized = false

export function initPostHog() {
    if (initialized) return
    if (typeof window === "undefined") return
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"
    if (!key) return

    posthog.init(key, {
        api_host: host,
        capture_pageview: true,
        capture_pageleave: true,
        // Privacy: this is a CRM. Mask all inputs in any future
        // session-replay rollout. Session replay is OFF in v1 anyway
        // (we haven't enabled it on the PostHog project), but lock
        // it down here so a dashboard toggle can't surprise us.
        session_recording: {
            maskAllInputs: true,
            maskTextSelector: "[data-ph-no-capture]",
        },
        autocapture: false,
        person_profiles: "identified_only",
    })
    initialized = true
}

export function identifyUser(input: {
    userId: string
    email?: string | null
    name?: string | null
    role?: string | null
    workspaceId?: string | null
    workspaceName?: string | null
    plan?: string | null
    planStatus?: string | null
}) {
    if (!initialized) initPostHog()
    if (typeof window === "undefined") return
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

    posthog.identify(input.userId, {
        email: input.email ?? undefined,
        name: input.name ?? undefined,
        role: input.role ?? undefined,
        workspace_id: input.workspaceId ?? undefined,
        plan: input.plan ?? undefined,
        plan_status: input.planStatus ?? undefined,
    })

    if (input.workspaceId) {
        posthog.group("workspace", input.workspaceId, {
            name: input.workspaceName ?? undefined,
            plan: input.plan ?? undefined,
            plan_status: input.planStatus ?? undefined,
        })
    }
}

export function trackClient(event: VestaEvent) {
    if (!initialized) initPostHog()
    if (typeof window === "undefined") return
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    posthog.capture(event.name, (event.props ?? {}) as Record<string, unknown>)
}

export function resetPostHog() {
    if (typeof window === "undefined") return
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    if (initialized) posthog.reset()
}
