import "server-only"
import { PostHog } from "posthog-node"
import type { VestaEvent } from "./events"

let cached: PostHog | null = null

function getClient(): PostHog | null {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"
    if (!key) return null
    if (!cached) {
        cached = new PostHog(key, {
            host,
            // Lower the flush threshold so events ship promptly from
            // server actions (serverless functions can die before the
            // default batched flush). Cost is more HTTP calls — fine
            // at v1 traffic.
            flushAt: 1,
            flushInterval: 0,
        })
    }
    return cached
}

interface CaptureInput {
    event: VestaEvent
    /** Stable PostHog `distinct_id`. Pass the user's Firestore id for
     *  user-driven events; for system events (Stripe webhooks, cron
     *  triggers) pass `workspaceId` only and we'll derive a stable
     *  `workspace:<id>` synthetic identifier. */
    distinctId?: string
    /** Workspace context — surfaces as a PostHog group. */
    workspaceId?: string | null
}

export async function track(input: CaptureInput): Promise<void> {
    const client = getClient()
    if (!client) return
    const distinctId = input.distinctId || (input.workspaceId ? `workspace:${input.workspaceId}` : null)
    if (!distinctId) return
    try {
        const groups: Record<string, string> = {}
        if (input.workspaceId) groups.workspace = input.workspaceId
        client.capture({
            distinctId,
            event: input.event.name,
            properties: (input.event.props ?? {}) as Record<string, unknown>,
            groups,
        })
        await client.flush()
    } catch {
        // PostHog outage shouldn't break the action that called us.
    }
}
