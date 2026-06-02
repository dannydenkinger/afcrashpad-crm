/**
 * Webhook event names. Adding a new event = add a string here, then call
 * dispatchWebhook(workspaceId, "event.name", payload) from the code path
 * that mutates the resource.
 *
 * Naming convention: `<resource>.<verb>`. Past tense — events describe
 * something that already happened. Keep payloads small (the receiver can
 * call back into the API for full data).
 */
export type WebhookEvent =
    | "contact.created"
    | "contact.updated"
    | "deal.created"
    | "deal.stage_changed"
    | "deal.closed_won"
    | "deal.closed_lost"
    | "task.completed"

export const ALL_WEBHOOK_EVENTS: { event: WebhookEvent; label: string; description: string }[] = [
    { event: "contact.created", label: "Contact created", description: "Fires when a new contact is added to the workspace." },
    { event: "contact.updated", label: "Contact updated", description: "Fires when any field on a contact changes." },
    { event: "deal.created", label: "Deal created", description: "Fires when a new opportunity is created." },
    { event: "deal.stage_changed", label: "Deal stage changed", description: "Fires when a deal moves between pipeline stages." },
    { event: "deal.closed_won", label: "Deal won", description: "Fires when a deal is marked Closed Won." },
    { event: "deal.closed_lost", label: "Deal lost", description: "Fires when a deal is marked Closed Lost." },
    { event: "task.completed", label: "Task completed", description: "Fires when a task is marked complete." },
]

/**
 * Output format for the webhook delivery body.
 *
 *   vesta — our standard envelope { id, event, data, ... }. Receivers
 *           that integrate via the documented spec use this.
 *   slack — Slack-incoming-webhook format: { text, blocks }. The
 *           dispatcher transforms the event into a human-readable
 *           Slack message. Drop this URL into Slack's "Add Incoming
 *           Webhook" flow and you get CRM events in your channel.
 */
export type WebhookFormat = "vesta" | "slack"

/** Stored webhook subscription. */
export interface WebhookSubscription {
    id: string
    workspaceId: string
    url: string
    /** Subset of WebhookEvent the receiver wants to be notified about. */
    events: WebhookEvent[]
    /** HMAC secret used to sign payloads. Receiver verifies with the same. */
    secret: string
    enabled: boolean
    /** Output format for the request body. Defaults to "vesta". */
    format?: WebhookFormat
    createdAt: string // ISO
    updatedAt: string
    /** Timestamp of the last successful delivery, ISO. */
    lastDeliveredAt?: string | null
    /** Last delivery error message, useful for debugging in the UI. */
    lastError?: string | null
    /** Cumulative count of successful deliveries. */
    deliveryCount?: number
    /** Cumulative count of failed deliveries (after retries). */
    failureCount?: number
}
